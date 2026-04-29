import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is missing. AI features will not work.");
}

export const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export const api = {
  chat: async (message: string, botName: string, botPurpose: string, history: any[] = []) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: `You are ${botName || 'EngageFlow AI'}. Your purpose is: ${botPurpose || 'Helpful business assistant'}. You specialize in customer service and business automation. Keep responses concise and professional.`
      }
    });
    return { text: response.text };
  },

  generateWebsite: async (type: string, theme: string) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Create a structured website sample for a "${type}" business using the "${theme}" design style. 
      Include headline, 3 key features, and a call to action. 
      For "${theme}", use appropriate tone and formatting instructions. 
      Format it nicely with clear section headers.`,
    });
    return { text: response.text };
  },

  generateBlog: async (topic: string) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Write a short, engaging professional blog post about "${topic}" in the context of business automation and AI. Include a catchy title and 3 key takeaways.`,
    });
    return { text: response.text };
  }
};
