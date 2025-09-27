export interface TTSResult {
  audioBuffer: Buffer;
  duration: number;
}

export interface TTSService {
  synthesize(text: string, voiceId?: string): Promise<TTSResult>;
}

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

// Factory function to create TTS service (easily swappable)
export function createTTSService(): TTSService {
  return new ElevenLabsTTSService();
}
