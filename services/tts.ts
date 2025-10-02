export interface TTSService {
  synthesize(text: string, voiceId?: string, speed?: number): Promise<TTSResult>;
}

export interface TTSResult {
  audioBuffer: Buffer;
  duration: number;
}

export type TTSProvider = 'elevenlabs' | 'gtts';

export class ElevenLabsTTSService implements TTSService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }
  }

  async synthesize(text: string, voiceId: string = 'pNInz6obpgDQGcFmaJgB', speed?: number): Promise<TTSResult> {
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
    
    // Estimate duration (rough calculation)
    const duration = text.length * 0.06; // ~60ms per character

    return {
      audioBuffer,
      duration,
    };
  }
}

export class GTTSService implements TTSService {
  private baseUrl = 'https://translate.google.com/translate_tts';
  private baseUrl = 'https://translate.google.com/translate_tts';

  async synthesize(text: string, voiceId?: string, speed: number = 1.5): Promise<TTSResult> {
    try {
      // Ultra-aggressive text cleaning for GTTS to avoid 400 errors
      const cleanText = text
        .replace(/[\"\"'']/g, '\"') // Normalize quotes
        .replace(/[^\w\s.]/g, ' ') // Only keep words, spaces, and periods
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/['']/g, "'") // Normalize apostrophes
        .replace(/(\w)-(\w)/g, '$1 $2') // Replace hyphens with spaces
        .trim();

      if (!cleanText || cleanText.length < 2) {
        throw new Error('No valid text to synthesize');
      }

      console.log(`🎵 [GTTS] Processing text: "${cleanText.replace(/\s+/g, ' ')}"`);

      // Validate text length for GTTS (they have limits)
      if (cleanText.length > 200) {
        const truncatedText = cleanText.substring(0, 200).replace(/\s+\S*$/, '');
        console.log(`🎵 [GTTS] Text too long, truncating to: "${truncatedText}"`);
        return this.synthesizeText(truncatedText);
      }

      return this.synthesizeText(cleanText);
    } catch (error) {
      console.error('Error synthesizing speech with GTTS:', error);
      
      // If the first attempt fails, try with even simpler text
      try {
        const ultraSimpleText = text
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 50); // Very short fallback
        
        if (ultraSimpleText.trim().length > 2) {
          console.log(`🔄 [GTTS] Trying with ultra-simple text: "${ultraSimpleText}"`);
          return this.synthesizeText(ultraSimpleText);
        }
      } catch (fallbackError) {
        console.error('GTTS fallback also failed:', fallbackError);
      }
      
      throw new Error(`GTTS synthesis failed: ${error}`);
    }
  }

  private async synthesizeText(cleanText: string): Promise<TTSResult> {
    // GTTS parameters optimized for reliability
    const params = new URLSearchParams({
      ie: 'UTF-8',
      q: cleanText,
      tl: 'en-us', // US English for better stability
      client: 'tw-ob',
      textlen: cleanText.length.toString()
    });

    console.log(`🎵 [GTTS] Making request with params:', ${params.toString()}`);

    const response = await fetch(`${this.baseUrl}?${params}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'audio/wav,audio/mpeg,audio/*',
        'Referer': 'https://translate.google.com/',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      console.error(`❌ [GTTS] API Error ${response.status}: ${response.statusText}`);
      console.error(`❌ [GTTS] Error response: ${errorText}`);
      throw new Error(`GTTS API error: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    // Estimate duration (rough calculation for GTTS with 1.5x speed)
    const duration = cleanText.length * 0.04; // ~40ms per character (1.5x speed: 60ms/1.5 = 40ms)

    console.log(`🎵 [GTTS] Generated audio: ${audioBuffer.length} bytes, ${duration.toFixed(2)}s duration`);

    return {
      audioBuffer,
      duration,
    };
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