export interface TTSResult {
  audioBuffer: Buffer;
  duration: number;
}

export interface TTSService {
  synthesize(text: string, voiceId?: string): Promise<TTSResult>;
}

export type TTSProvider = 'elevenlabs' | 'gtts';

export class ElevenLabsTTSService implements TTSService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable is required');
    }
    this.apiKey = apiKey;
  }

  async synthesize(text: string, voiceId: string = 'pNInz6obpgDQGcFmaJgB'): Promise<TTSResult> {
    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      
      // Estimate duration (rough calculation for ElevenLabs)
      const duration = text.length * 0.08; // ~80ms per character

      return {
        audioBuffer,
        duration,
      };
    } catch (error) {
      console.error('Error synthesizing speech with ElevenLabs:', error);
      throw new Error(`TTS synthesis failed: ${error}`);
    }
  }
}

export class GTTSService implements TTSService {
  private baseUrl = 'https://translate.google.com/translate_tts';

  async synthesize(text: string, voiceId?: string): Promise<TTSResult> {
    try {
      // Clean text for GTTS (remove special characters that might cause issues)
      const cleanText = text
        .replace(/[^\w\s.,!?;:]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      if (!cleanText) {
        throw new Error('No valid text to synthesize');
      }

      // GTTS parameters
      const params = new URLSearchParams({
        ie: 'UTF-8',
        q: cleanText,
        tl: 'en', // English
        client: 'tw-ob',
        total: '1',
        idx: '0',
        textlen: cleanText.length.toString()
      });

      const response = await fetch(`${this.baseUrl}?${params}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`GTTS API error: ${response.status} ${response.statusText}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      
      // Estimate duration (rough calculation for GTTS)
      const duration = cleanText.length * 0.06; // ~60ms per character

      console.log(`🎵 [GTTS] Generated audio: ${audioBuffer.length} bytes, ${duration.toFixed(2)}s duration`);

      return {
        audioBuffer,
        duration,
      };
    } catch (error) {
      console.error('Error synthesizing speech with GTTS:', error);
      throw new Error(`GTTS synthesis failed: ${error}`);
    }
  }
}

// Factory function to create TTS service (easily swappable)
export function createTTSService(provider: TTSProvider = 'elevenlabs'): TTSService {
  switch (provider) {
    case 'gtts':
      return new GTTSService();
    case 'elevenlabs':
    default:
      return new ElevenLabsTTSService();
  }
}
