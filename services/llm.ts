// @ts-ignore
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async generateResponse(prompt: string, context?: string): Promise<LLMResponse> {
    try {
      const fullPrompt = context 
        ? `Context: ${context}\n\nQuestion: ${prompt}\n\nPlease provide a helpful and concise answer.`
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
      console.error('Error generating LLM response:', error);
      throw new Error(`LLM generation failed: ${error}`);
    }
  }
}

// Factory function to create LLM service (easily swappable)
export function createLLMService(): LLMService {
  return new GeminiLLMService();
}
