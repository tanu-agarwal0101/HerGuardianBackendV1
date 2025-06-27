import { CohereClient } from "cohere-ai";

// const cohere = new CohereClient({ token: process.env.COHERE_API_KEY});

// const chatWithBot = async (req, res) => {
//     try{
//         const {message} = req.body;
//         const prompt = `You are Guardian, a safety assistant for women. Answer the following question kindly and helpfully: "${message}"`;

//         const response = await cohere.generate({
//             model: "command-r-plus",
//             prompt,
//             maxTokens: 200,
//             temperature: 0.7
//         })

//         const answer = response.generations?.[0]?.text?.trim() || "I'm sorry, I don't know the answer."
//         res.status(200).json({answer})
//     } catch(error){
//         console.error("chatbot error", error)
//         res.status(500).json({error: "something went wrong"})
//     }
// }

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

export const getBotReply = async (message) => {
  try {
    console.log("mess", message);
    const prompt = `You are a safety assistant chatbot.
    The user will ask safety related questions.
    Answer concisely, within 200 tokens.
    Use proper formatting:
    Start each point on a new line.
    Use bullet points if possible.
    Keep responses clear and to the point.Avoid unnecessary introductions.
    Answer this: "${message}".
    
    `;

    const response = await cohere.generate({
      model: "command-r-plus",
      prompt,
      maxTokens: 200,
      temperature: 0.7,
    });

    console.log("res", response);
    const reply = response.generations?.[0]?.text?.trim();
    // console.log("botReply", reply)
    return reply || "Sorry, I couldn't answer that.";
  } catch (error) {
    console.error("Cohere API Error", error);
    return "I am having trouble responding right now ";
  }
};
