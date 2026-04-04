import { CohereClient } from "cohere-ai";
import logger from "../utils/logger.js";

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

const envModel = process.env.COHERE_MODEL && process.env.COHERE_MODEL.trim();
const MODEL_CANDIDATES = [
  ...(envModel ? [envModel] : []),
  "command-r",
  "command-r-plus-08-2024",
  "command-r-08-2025",
  "command",
];

function extractReply(resp) {
  if (!resp) return null;
  if (resp.text && typeof resp.text === "string" && resp.text.trim())
    return resp.text.trim();
  if (Array.isArray(resp.message?.content)) {
    const combined = resp.message.content
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join(" ")
      .trim();
    if (combined) return combined;
  }
  if (resp.output_text) return String(resp.output_text).trim();
  return null;
}

export const generateExcuse = async (req, res) => {
  try {
    const { context, tone, timeOfDay, locationType, person } = req.body;

    if (!context) {
      return res.status(400).json({ message: "Context is required" });
    }

    const safetySystem = "You are a women's safety AI assistant. You generate realistic mock messages and excuses. ALWAYS return JSON.";
    const formattingGuidance = `
Context: "${context}"
Person (sender of message): "${person || "someone"}"
Tone: ${tone || "polite"}
Time: ${timeOfDay || "unknown"}
Location: ${locationType || "unknown"}

Task:
1. Generate an incoming mock message FROM the person specified to the user.
2. Generate a matching excuse the USER can give to people present.

IMPORTANT constraints:
- DO NOT start the message with "Hey, [Person] here" or "It's [Person]".
- The message should be natural. The sender assumes you know who they are.
- Ensure the message content is logical based on the relationship (e.g., a "boss" asks about work/office, a "mom" asks about home/family).

Return ONLY a JSON object with this exact structure:
{
  "message": "the text from the person",
  "excuse": "the text for the user to say"
}
No other text, no quotes around the JSON.
`;

    const errorsPerModel = [];
    for (const model of MODEL_CANDIDATES) {
      if (!model) continue;

      try {
        const single = await cohere.chat({
          model,
          message: `${safetySystem}\n${formattingGuidance}`,
          max_tokens: 250,
          temperature: 0.8,
        });
        const singleReply = extractReply(single);
        if (singleReply) {
          const cleaned = singleReply.replace(/```json|```/g, "").trim();
          try {
            const parsed = JSON.parse(cleaned);
            if (parsed.message && parsed.excuse) {
              logger.info({ model, variant: "single" }, "AI Excuse Generated Successfully");
              return res.status(200).json(parsed);
            }
          } catch (pe) {
            logger.warn({ model, variant: "single", error: pe.message }, "AI returned non-JSON");
          }
        }
      } catch (err) {
        const msg = err?.message || "Unknown error";
        logger.debug({ model, variant: "single", error: msg }, "Variant A failed");
        if (msg.includes("was removed") || err?.status === 404) continue;
        errorsPerModel.push({ model, variant: "single", error: msg });
      }

      try {
        const multi = await cohere.chat({
          model,
          messages: [
            { role: "system", content: safetySystem },
            { role: "user", content: formattingGuidance },
          ],
          max_tokens: 250,
          temperature: 0.8,
        });

        const multiReply = extractReply(multi);
        if (multiReply) {
          const cleaned = multiReply.replace(/```json|```/g, "").trim();
          try {
            const parsed = JSON.parse(cleaned);
            if (parsed.message && parsed.excuse) {
              logger.info({ model, variant: "multi" }, "AI Excuse Generated Successfully (Multi-turn)");
              return res.status(200).json(parsed);
            }
          } catch (pe) {
            logger.warn({ model, variant: "multi", error: pe.message }, "AI Multi-turn returned non-JSON");
          }
        }
      } catch (multiErr) {
        const msg = multiErr?.message || "Unknown error";
        logger.debug({ model, variant: "multi", error: msg }, "Variant B failed");
        errorsPerModel.push({ model, variant: "multi", error: msg });
      }
    }

    if (errorsPerModel.length > 0) {
      logger.error({ errors: errorsPerModel }, "AI Excuse Generation: All models failed");
    }

    const fallbackPerson = person || "Mom";
    const pLower = fallbackPerson.toLowerCase();
    
    let fallbackMessage = `Please come home ASAP! I need your help with something.`;
    let fallbackExcuse = `I'm sorry, my ${pLower} just sent an urgent message, I need to head out.`;

    if (pLower.includes("boss") || pLower.includes("work") || pLower.includes("office") || pLower.includes("manager") || pLower.includes("colleague")) {
      fallbackMessage = `URGENT: There's an issue with the project that needs your immediate attention. Please check your email or join the meeting.`;
      fallbackExcuse = `I'm so sorry, my ${pLower} just notified me of an urgent work issue. I really need to handle this right away.`;
    }

    return res.status(200).json({
      message: fallbackMessage,
      excuse: fallbackExcuse
    });
  } catch (error) {
    console.error("AI Excuse Generation Error:", error);
    res.status(500).json({ message: "Failed to generate excuse" });
  }
};
