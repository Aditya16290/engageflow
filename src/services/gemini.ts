import { GoogleGenAI, Type } from "@google/genai";

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
        systemInstruction: `You are ${botName || 'EngageFlow AI'}. Your purpose is: ${botPurpose || 'Helpful business assistant'}. 
        You specialize in customer service and business automation. 
        Always stay in character. If the purpose is specific (e.g., "coffee shop support"), focus on that industry.
        Keep responses concise, professional, and helpful. Use a friendly tone.`
      }
    });
    return { text: response.text };
  },

  generateWebsite: async (type: string, theme: string) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Design a high-converting website architecture for a "${type}" business using a "${theme}" aesthetic.
      
      Provide:
      1. A bold, punchy headline.
      2. A compelling subheadline.
      3. Three main service blocks with titles and descriptions.
      4. A "Why Choose Us" section.
      5. A clear Call to Action (CTA).
      
      The tone should match the "${theme}" style (e.g., if "Minimal", be brief; if "Futuristic", use tech-forward language).`,
    });
    return { text: response.text };
  },

  generateBlogContent: async (topic: string) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a professional, high-quality blog post about: ${topic}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            excerpt: { type: Type.STRING },
            content: { type: Type.STRING },
            tag: { type: Type.STRING }
          },
          required: ["title", "excerpt", "content", "tag"]
        }
      }
    });

    if (!response.text) throw new Error("No content received");
    return JSON.parse(response.text);
  },

  generateBlog: async (topic: string) => {
    // Legacy mapping or simple version
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Write a short, engaging professional blog post about "${topic}".`,
    });
    return { text: response.text };
  }
};
