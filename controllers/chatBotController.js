import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

// Provide a prioritized list of Cohere chat-capable models. The removed 'command-r-plus' is excluded.
// Allow override via COHERE_MODEL env; if provided it will be tried first.
const envModel = process.env.COHERE_MODEL && process.env.COHERE_MODEL.trim();
// Update this list as Cohere publishes replacements. Example plausible successors.
const MODEL_CANDIDATES = [
  ...(envModel ? [envModel] : []),
  // Current general chat / reasoning capable models (example names; adjust to actual Cohere catalog)
  "command-r", // Faster, balanced model
  "command-r-plus-08-2024", // Larger, slower
  "command-r-08-2025",
  "command",
];

// Normalize any Cohere chat style response to plain text
function extractReply(resp) {
  if (!resp) return null;
  if (resp.text && typeof resp.text === "string" && resp.text.trim())
    return resp.text.trim();
  // Some SDK versions put final content under response.message.content[]
  if (Array.isArray(resp.message?.content)) {
    const combined = resp.message.content
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join(" ")
      .trim();
    if (combined) return combined;
  }
  // Older or alternative structure: response.output_text
  if (resp.output_text) return String(resp.output_text).trim();
  return null;
}

export const getBotReply = async (userMessage) => {
  const safetySystem =
    "You are Guardian, a concise women's safety assistant. Provide practical, calm, safety-oriented guidance. Use short bullet points when listing steps.";
  const formattingGuidance = `User question: "${userMessage}"\nInstructions: Be concise, <=200 tokens. New line per bullet. Avoid fluff.`;

  try {
    const errorsPerModel = [];

    for (const model of MODEL_CANDIDATES) {
      if (!model) continue;
      // Attempt variant A: single 'message'
      try {
        const single = await cohere.chat({
          model,
          message: `${safetySystem}\n${formattingGuidance}`,
          max_tokens: 200,
          temperature: 0.7,
        });
        const singleReply = extractReply(single);
        if (singleReply) {
          return singleReply;
        } else {
          // Empty reply — fall through to messages[] variant
        }
      } catch (variantErr) {
        const codeLike = variantErr?.status || variantErr?.code || "n/a";
        const msg =
          variantErr?.message || JSON.stringify(variantErr?.errors || {});

        // If 404 model removed, continue to next model immediately
        if (msg?.includes("was removed") || codeLike === 404) {
          errorsPerModel.push({ model, variant: "single", removed: true, msg });
          continue; // proceed to next model without trying messages[]
        }
        errorsPerModel.push({ model, variant: "single", msg });
      }

      // Attempt variant B: messages array
      try {
        const multi = await cohere.chat({
          model,
          messages: [
            { role: "system", content: safetySystem },
            { role: "user", content: formattingGuidance },
          ],
          max_tokens: 200,
          temperature: 0.7,
        });
        const multiReply = extractReply(multi);
        if (multiReply) {
          return multiReply;
        } else {

          errorsPerModel.push({
            model,
            variant: "messages",
            msg: "empty reply",
          });
        }
      } catch (multiErr) {
        const codeLike = multiErr?.status || multiErr?.code || "n/a";
        const msg = multiErr?.message || JSON.stringify(multiErr?.errors || {});

        errorsPerModel.push({ model, variant: "messages", msg });
        if (msg?.includes("was removed")) {
          continue; // next model
        }
      }
    }

    // All model candidates failed
    return "Sorry, I couldn't generate a response just now.";
  } catch (error) {

    return "I am having trouble responding right now.";
  }
};
