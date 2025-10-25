export interface TTSService {
  synthesize(text: string, voiceId?: string, speed?: number): Promise<TTSResult>;
}

export interface TTSResult {
  audioBuffer: Buffer;
  duration: number;
}

export type TTSProvider = 'edge' | 'elevenlabs' | 'gtts';

// Text sanitization function to clean text for TTS
function sanitizeText(text: string): string {
  return text
    .replace(/\*\*/g, "") // remove bold markdown (**text**)
    .replace(/[*_~`#<>[\]{}|]/g, "") // remove markdown and special chars
    .replace(/https?:\/\/\S+/g, "") // remove links
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\x00-\x7F]/g, "") // remove emojis and non-ASCII
    .replace(/\s{2,}/g, " ") // collapse multiple spaces
    .replace(/\s+([.,!?;:])/g, "$1") // clean space before punctuation
    .trim();
}

// -------------------- EDGE TTS --------------------
export class EdgeTTSService implements TTSService {
  private baseUrl: string;
  
  constructor() {
    // Use full URL for server-side, relative URL for client-side
    if (typeof window === 'undefined') {
      // Server-side (API routes running in Vercel/Netlify/etc.) need an absolute URL
      const candidates = [
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.NEXT_PUBLIC_SITE_URL,
        process.env.SITE_URL,          // Netlify
        process.env.URL,               // Netlify (primary site URL)
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
      ].filter(Boolean) as string[];

      const origin = candidates.length > 0 ? candidates[0] : undefined;

      if (origin) {
        this.baseUrl = `${origin.replace(/\/$/, '')}/api/tts-edge`;
      } else {
        // Fallback to relative path for environments that can resolve it, otherwise throw helpful error at runtime
        this.baseUrl = '/api/tts-edge';
      }
    } else {
      // Client-side can use relative URL
      this.baseUrl = '/api/tts-edge';
    }
  }

  async synthesize(text: string, voiceId: string = 'en-US-AriaNeural', speed?: number): Promise<TTSResult> {
    console.log('🎙️ [EDGE-TTS] === SYNTHESIZE START ===');
    console.log('🎙️ [EDGE-TTS] Text length:', text.length);
    console.log('🎙️ [EDGE-TTS] Voice:', voiceId);
    
    const sanitizedText = sanitizeText(text);
    console.log('🧹 [EDGE-TTS] Sanitized text:', sanitizedText.substring(0, 100) + '...');

    if (!sanitizedText || sanitizedText.length < 2) {
      console.error('❌ [EDGE-TTS] Invalid text - too short');
      throw new Error('No valid text to synthesize');
    }

    try {
      if (typeof window === 'undefined') {
        // Direct library call on serverless to avoid HTTP hop and CORS/base URL issues
        const { EdgeTTS } = require('@andresaya/edge-tts');
        const tts = new EdgeTTS();
        await tts.synthesize(sanitizedText, voiceId);
        const audioBuffer: Buffer = tts.toBuffer();
        const duration: number = tts.getDuration();
        console.log('✅ [EDGE-TTS] Audio generated (server), size:', audioBuffer.length, 'bytes', 'duration:', duration);
        console.log('✅ [EDGE-TTS] === SYNTHESIZE COMPLETE ===\n');
        return { audioBuffer, duration };
      }

      // Client-side fallback path (not typically used)
      console.log('🌐 [EDGE-TTS] Sending request to Edge TTS API (client fallback)...');
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sanitizedText, voice: voiceId }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ [EDGE-TTS] API error response:', errorText);
        throw new Error(`Edge TTS API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      const durationHeader = response.headers.get('X-Duration');
      const duration = durationHeader ? parseFloat(durationHeader) : sanitizedText.length * 0.06;
      console.log('✅ [EDGE-TTS] Audio buffer received (client), size:', audioBuffer.length, 'bytes');
      return { audioBuffer, duration };
    } catch (error) {
      console.error('❌ [EDGE-TTS] Error:', error);
      throw error;
    }
  }
}

// -------------------- ELEVEN LABS --------------------
export class ElevenLabsTTSService implements TTSService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
    console.log('🔑 [ELEVENLABS] Initializing with API key:', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'MISSING');
    if (!this.apiKey) {
      console.error('❌ [ELEVENLABS] API key not found in environment');
      throw new Error('ElevenLabs API key is required. Set ELEVENLABS_API_KEY in .env.local');
    }
    console.log('✅ [ELEVENLABS] API key found and configured');
  }

  async synthesize(
    text: string,
    voiceId: string = 'UzYWd2rD2PPFPjXRG3Ul', //Mohit - indian english
    speed?: number
  ): Promise<TTSResult> {
    console.log('🎙️ [ELEVENLABS] === SYNTHESIZE START ===');
    console.log('🎙️ [ELEVENLABS] Text length:', text.length);
    console.log('🎙️ [ELEVENLABS] Voice ID:', voiceId);
    console.log('🎙️ [ELEVENLABS] API Key present:', !!this.apiKey);
    
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    console.log('🌐 [ELEVENLABS] API URL:', url);
    
    const sanitizedText = sanitizeText(text);
    console.log('🧹 [ELEVENLABS] Sanitized text:', sanitizedText.substring(0, 100) + '...');
    
    const requestBody = {
      text: sanitizedText,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        ...(speed && { speed })
      }
    };

    console.log('📤 [ELEVENLABS] Sending request to ElevenLabs API...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📡 [ELEVENLABS] API response status:', response.status);
    console.log('📡 [ELEVENLABS] API response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [ELEVENLABS] API error response:', errorText);
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    console.log('✅ [ELEVENLABS] Audio buffer received, size:', audioBuffer.length, 'bytes');
    
    // Estimate duration (~60ms per character)
    const duration = sanitizedText.length * 0.06;
    console.log('✅ [ELEVENLABS] Estimated duration:', duration, 'seconds');

    console.log('✅ [ELEVENLABS] === SYNTHESIZE COMPLETE ===\n');
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
    console.log('🎙️ [GTTS] === SYNTHESIZE START ===');
    console.log('🎙️ [GTTS] Text length:', text.length);
    console.log('🎙️ [GTTS] Speed:', speed);
    
    const sanitizedText = sanitizeText(text);
    console.log('🧹 [GTTS] Sanitized text:', sanitizedText.substring(0, 100) + '...');

    if (!sanitizedText || sanitizedText.length < 2) {
      console.error('❌ [GTTS] Invalid text - too short');
      throw new Error('No valid text to synthesize');
    }

    // Split into 200-char safe chunks (GTTS limit is ~200–250 chars)
    const chunks = this.splitIntoChunks(sanitizedText, 200);
    console.log('📦 [GTTS] Split into', chunks.length, 'chunk(s)');

    const buffers: Buffer[] = [];
    let totalDuration = 0;

    for (const chunk of chunks) {
      console.log(`🌐 [GTTS] Fetching audio for chunk ${buffers.length + 1}/${chunks.length}...`);
      const result = await this.synthesizeText(chunk, speed);
      buffers.push(result.audioBuffer);
      totalDuration += result.duration;
    }

    const finalBuffer = Buffer.concat(buffers);
    console.log('✅ [GTTS] All chunks combined, size:', finalBuffer.length, 'bytes');
    console.log('✅ [GTTS] Total duration:', totalDuration, 'seconds');
    console.log('✅ [GTTS] === SYNTHESIZE COMPLETE ===\n');

    return {
      audioBuffer: finalBuffer,
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
export function createTTSService(provider: TTSProvider = 'edge'): TTSService {
  switch (provider) {
    case 'edge':
      return new EdgeTTSService();
    case 'gtts':
      return new GTTSService();
    case 'elevenlabs':
      return new ElevenLabsTTSService();
    default:
      return new EdgeTTSService();
  }
}