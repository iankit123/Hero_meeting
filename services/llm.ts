// @ts-ignore
const { GoogleGenerativeAI } = require("@google/generative-ai");
// Use global fetch available in Node 18+ and Next.js runtime
const fetchFn: typeof fetch = (global as any).fetch;

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
      ? `You are *Hero*, an intelligent AI meeting attendee. 
      You are present in this meeting to actively listen, understand the discussion, 
      and provide clear, concise, and context-aware answers when addressed.
      
      Meeting Context:
      ${context}
      
      The participant just asked you:
      ${prompt}
      
      Guidelines for your response:
      - Speak as if you are an active participant in the meeting (natural, conversational, and professional).
      - Use the meeting context above to ground your answer. If relevant past meeting information is provided in the context, reference it with participants and date "like meeting on 2nd Oct between XYZ and ABC".
      - When referencing information, mention specific participants and what they said (e.g., "Matt mentioned that...").
      - If the context does not contain enough details, make a reasonable, helpful suggestion without inventing irrelevant facts. Keep it short as 1 line if need to ask just for clarification.
      - Keep answers short, focused and concise (1–3 sentences is usually enough). If possible, provide the answers in bullet points.
      - If asked for explanation, provide structured clarity (e.g., short bullets or examples).
      - If asked in hindi, respond in hindi. If asked in english, respond in english.
      - If previous meeting just had questions or summary asks, then do not reference it.
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

export class GroqLLMService implements LLMService {
  private apiKey: string;
  private model: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is required");
    }
    this.apiKey = apiKey;
    this.model = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
  }

  async generateResponse(prompt: string, context?: string): Promise<LLMResponse> {
    const system = context
      ? `You are Hero, an AI meeting assistant. Use ONLY the provided meeting context. If the context doesn't contain the answer, reply: "I don't have that in my meeting notes."\n\nContext:\n${context}`
      : 'You are Hero, an AI assistant.';

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
    } as any;

    const res = await fetchFn('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq API error: ${res.status} - ${text}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return { text };
  }
}

// Factory function to create LLM service (easily swappable)
export function createLLMService(): LLMService {
  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
  try {
    if (provider === 'groq') {
      return new GroqLLMService();
    }
    return new GeminiLLMService();
  } catch (e) {
    // Fallback: if selected provider fails to init, try the other one
    if (provider === 'groq') {
      return new GeminiLLMService();
    }
    return new GroqLLMService();
  }
}
