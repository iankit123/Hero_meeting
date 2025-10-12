// @ts-ignore
const { GoogleGenerativeAI } = require("@google/generative-ai");

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMService {
  generateResponse(prompt: string, context?: string): Promise<LLMResponse>;
}

export class GeminiLLMService implements LLMService {
  private genAI: any;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",
    });
  }

  // gemini-2.0-flash-lite
  // gemini-2.5-flash

  async generateResponse(
    prompt: string,
    context?: string,
  ): Promise<LLMResponse> {
    try {
      const fullPrompt = context
      ? `You are **Hero**, an intelligent AI meeting attendee. 
      You are present in this meeting to actively listen, understand the discussion, 
      and provide clear, concise, and context-aware answers when addressed.
      
      Meeting Context:
      ${context}
      
      The participant just asked you:
      ${prompt}
      
      Guidelines for your response:
      - Speak as if you are an active participant in the meeting (natural, conversational, and professional).
      - Use the meeting context above to ground your answer. If relevant past meeting information is provided in the context, reference it naturally.
      - When referencing information, mention specific participants and what they said (e.g., "Matt mentioned that...").
      - If the context does not contain enough details, make a reasonable, helpful suggestion without inventing irrelevant facts. Keep it short as 1 line if need to ask just for clarification.
      - Keep answers focused and concise (1–3 sentences is usually enough).
      - If asked for explanation, provide structured clarity (e.g., short bullets or examples).
      - If asked in hindi, respond in hindi. If asked in english, respond in english.
      - Stay neutral and factual — do not roleplay as other participants.`      
        : prompt;

      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      return {
        text,
        usage: {
          promptTokens: 0, // Gemini doesn't provide detailed token usage in this API
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      console.error("Error generating LLM response:", error);
      throw new Error(`LLM generation failed: ${error}`);
    }
  }
}

// Factory function to create LLM service (easily swappable)
export function createLLMService(): LLMService {
  return new GeminiLLMService();
}
