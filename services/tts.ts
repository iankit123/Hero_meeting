export interface TTSService {
  synthesize(text: string, voiceId?: string, speed?: number): Promise<TTSResult>;
}

export interface TTSResult {
  audioBuffer: Buffer;
  duration: number;
}

export type TTSProvider = 'elevenlabs' | 'gtts';

// -------------------- ELEVEN LABS --------------------
export class ElevenLabsTTSService implements TTSService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }
  }

  async synthesize(
    text: string,
    voiceId: string = 'pNInz6obpgDQGcFmaJgB',
    speed?: number
  ): Promise<TTSResult> {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    
    const requestBody = {
      text: text.trim(),
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        ...(speed && { speed })
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    // Estimate duration (~60ms per character)
    const duration = text.length * 0.06;

    return {
      audioBuffer,
      duration,
    };
  }
}

// -------------------- GOOGLE TTS (GTTS) --------------------
export class GTTSService implements TTSService {
  private baseUrl = 'https://translate.google.com/translate_tts';

  async synthesize(text: string, voiceId?: string, speed: number = 1.5): Promise<TTSResult> {
    const cleanText = text.replace(/\s+/g, ' ').trim();

    if (!cleanText || cleanText.length < 2) {
      throw new Error('No valid text to synthesize');
    }

    // Split into 200-char safe chunks (GTTS limit is ~200–250 chars)
    const chunks = this.splitIntoChunks(cleanText, 200);

    const buffers: Buffer[] = [];
    let totalDuration = 0;

    for (const chunk of chunks) {
      const result = await this.synthesizeText(chunk, speed);
      buffers.push(result.audioBuffer);
      totalDuration += result.duration;
    }

    return {
      audioBuffer: Buffer.concat(buffers),
      duration: totalDuration,
    };
  }

  private splitIntoChunks(text: string, maxLength: number): string[] {
    const words = text.split(' ');
    const chunks: string[] = [];
    let current = '';

    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxLength) {
        chunks.push(current.trim());
        current = word;
      } else {
        current += ' ' + word;
      }
    }
    if (current) chunks.push(current.trim());
    return chunks;
  }

  private async synthesizeText(cleanText: string, speed: number = 1.5): Promise<TTSResult> {
    const params = new URLSearchParams({
      ie: 'UTF-8',
      q: cleanText,
      tl: 'en-us',
      client: 'tw-ob',
      textlen: cleanText.length.toString()
    });

    const response = await fetch(`${this.baseUrl}?${params}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'audio/wav,audio/mpeg,audio/*',
        'Referer': 'https://translate.google.com/',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`GTTS API error: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    // Estimate duration (1.5x speed = ~40ms per char)
    const duration = cleanText.length * 0.04;

    return {
      audioBuffer,
      duration,
    };
  }
}

// -------------------- FACTORY --------------------
export function createTTSService(provider: TTSProvider = 'elevenlabs'): TTSService {
  switch (provider) {
    case 'gtts':
      return new GTTSService();
    case 'elevenlabs':
    default:
      return new ElevenLabsTTSService();
  }
}
