export interface TTSService {
  synthesize(text: string, voiceId?: string, speed?: number): Promise<TTSResult>;
}

export interface TTSResult {
  audioBuffer: Buffer;
  duration: number;
}

export type TTSProvider = 'elevenlabs' | 'gtts' | 'edgetts';

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

// -------------------- EDGE TTS --------------------
export class EdgeTTSService implements TTSService {
  async synthesize(text: string, voiceId: string = 'en-US-AndrewNeural', speed: number = 1.1): Promise<TTSResult> {
    console.log('🎙️ [EDGE-TTS] === SYNTHESIZE START ===');
    console.log('🎙️ [EDGE-TTS] Text length:', text.length);
    console.log('🎙️ [EDGE-TTS] Voice:', voiceId);
    console.log('🎙️ [EDGE-TTS] Speed:', speed);
    
    const sanitizedText = sanitizeText(text);
    console.log('🧹 [EDGE-TTS] Sanitized text:', sanitizedText.substring(0, 100) + '...');

    if (!sanitizedText || sanitizedText.length < 2) {
      console.error('❌ [EDGE-TTS] Invalid text - too short');
      throw new Error('No valid text to synthesize');
    }

    try {
      console.log('🌐 [EDGE-TTS] === SYNTHESIZE START ===');
      console.log('🌐 [EDGE-TTS] Text length:', sanitizedText.length);
      console.log('🌐 [EDGE-TTS] Voice:', voiceId);
      console.log('🌐 [EDGE-TTS] Speed:', speed);
      console.log('🌐 [EDGE-TTS] Environment:', typeof window === 'undefined' ? 'SERVER' : 'CLIENT');
      
      // For server-side usage, we need to use a different approach
      // Import the edge-tts functionality directly instead of making HTTP calls
      if (typeof window === 'undefined') {
        console.log('🌐 [EDGE-TTS] Running on server-side, attempting Edge TTS...');
        // Server-side: try edge-tts CLI first, fallback to HTTP API, then Google TTS
        try {
          const { spawn } = await import('child_process');
          const { join } = await import('path');
          const { tmpdir } = await import('os');
          const { readFileSync, unlinkSync } = await import('fs');
          
          const tempFile = join(tmpdir(), `edge-tts-${Date.now()}.wav`);
          console.log('🌐 [EDGE-TTS] Server-side: trying CLI directly, temp file:', tempFile);
          
          // Use edge-tts CLI to generate audio
          const edgeTtsProcess = spawn('edge-tts', [
            '--text', sanitizedText,
            '--voice', voiceId,
            '--rate', `+${Math.round((speed - 1) * 100)}%`,
            '--write-media', tempFile
          ], {
            stdio: ['pipe', 'pipe', 'pipe']
          });

          // Wait for the process to complete
          await new Promise((resolve, reject) => {
            edgeTtsProcess.on('close', (code) => {
              if (code === 0) {
                resolve(code);
              } else {
                reject(new Error(`edge-tts process exited with code ${code}`));
              }
            });
            
            edgeTtsProcess.on('error', (error) => {
              reject(error);
            });
          });

          // Read the generated audio file
          const audioBuffer = readFileSync(tempFile);
          
          // Clean up temporary file
          try {
            unlinkSync(tempFile);
          } catch (cleanupError) {
            console.warn('⚠️ [EDGE-TTS] Failed to clean up temp file:', cleanupError);
          }

          // Estimate duration (rough calculation: ~150 words per minute)
          const wordCount = sanitizedText.split(' ').length;
          const estimatedDuration = (wordCount / 150) * 60 / speed;
          
          console.log('✅ [EDGE-TTS] Audio generated, size:', audioBuffer.length, 'bytes');
          console.log('✅ [EDGE-TTS] Estimated duration:', estimatedDuration, 'seconds');
          console.log('✅ [EDGE-TTS] === SYNTHESIZE COMPLETE ===\n');

          return {
            audioBuffer: audioBuffer,
            duration: estimatedDuration,
          };
          
        } catch (cliError) {
          console.error('❌ [EDGE-TTS] CLI failed:', cliError instanceof Error ? cliError.message : 'Unknown error');
          console.error('❌ [EDGE-TTS] CLI error details:', {
            name: cliError instanceof Error ? cliError.name : 'Unknown',
            message: cliError instanceof Error ? cliError.message : 'Unknown error',
            stack: cliError instanceof Error ? cliError.stack : 'No stack trace'
          });
          
          // Try Netlify function as second fallback
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://heromeet.netlify.app';
            const functionUrl = `${baseUrl}/.netlify/functions/edge-tts`;
            
            console.log('🌐 [EDGE-TTS] Trying Netlify function:', functionUrl);
            console.log('🌐 [EDGE-TTS] Request payload:', {
              text: sanitizedText.substring(0, 50) + '...',
              voice: voiceId,
              speed: speed
            });
            
            const response = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: sanitizedText,
                voice: voiceId,
                speed: speed
              }),
            });

            console.log('🌐 [EDGE-TTS] Netlify function response status:', response.status);
            console.log('🌐 [EDGE-TTS] Netlify function response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
              const errorText = await response.text();
              console.error('❌ [EDGE-TTS] Netlify function error response:', errorText);
              throw new Error(`Netlify function failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('🌐 [EDGE-TTS] Netlify function response data:', {
              success: result.success,
              duration: result.duration,
              size: result.size,
              audioBufferLength: result.audioBuffer ? result.audioBuffer.length : 'undefined'
            });
            
            if (!result.success) {
              console.error('❌ [EDGE-TTS] Netlify function returned error:', result.error);
              throw new Error(result.error || 'Unknown Netlify function error');
            }

            // Convert base64 back to buffer
            const finalBuffer = Buffer.from(result.audioBuffer, 'base64');
            
            console.log('✅ [EDGE-TTS] Netlify function audio generated, size:', finalBuffer.length, 'bytes');
            console.log('✅ [EDGE-TTS] Duration:', result.duration, 'seconds');
            console.log('✅ [EDGE-TTS] === SYNTHESIZE COMPLETE ===\n');

            return {
              audioBuffer: finalBuffer,
              duration: result.duration,
            };
            
          } catch (functionError) {
            console.error('❌ [EDGE-TTS] Netlify function failed:', functionError instanceof Error ? functionError.message : 'Unknown error');
            console.error('❌ [EDGE-TTS] Function error stack:', functionError instanceof Error ? functionError.stack : 'No stack trace');
            
            // Final fallback to Google TTS
            console.log('🔄 [EDGE-TTS] All Edge TTS methods failed, falling back to Google TTS...');
            const gttsService = new GTTSService();
            const fallbackResult = await gttsService.synthesize(sanitizedText, undefined, speed);
            console.log('✅ [EDGE-TTS] Google TTS fallback successful, size:', fallbackResult.audioBuffer.length, 'bytes');
            return fallbackResult;
          }
        }
      } else {
        // Client-side: use real Edge TTS
        console.log('🌐 [EDGE-TTS] Client-side: using real Edge TTS...');
        console.log('🌐 [EDGE-TTS] Request payload:', {
          text: sanitizedText.substring(0, 50) + '...',
          voice: voiceId,
          speed: speed
        });
        
        // Import Edge TTS dynamically to avoid SSR issues
        const { EdgeTTS } = await import('@andresaya/edge-tts');
        const tts = new EdgeTTS();
        
        // Synthesize speech
        await tts.synthesize(sanitizedText, voiceId);
        const audioBuffer = tts.toBuffer();
        
        // Estimate duration (rough calculation: ~150 words per minute)
        const wordCount = sanitizedText.split(' ').length;
        const estimatedDuration = (wordCount / 150) * 60 / speed;
        
        console.log('✅ [EDGE-TTS] Real Edge TTS successful, size:', audioBuffer.length, 'bytes');
        console.log('✅ [EDGE-TTS] Duration:', estimatedDuration, 'seconds');
        console.log('✅ [EDGE-TTS] === SYNTHESIZE COMPLETE ===\n');

        return {
          audioBuffer: Buffer.from(audioBuffer),
          duration: estimatedDuration,
        };
      }
      
    } catch (error) {
      console.error('❌ [EDGE-TTS] === SYNTHESIS FAILED ===');
      console.error('❌ [EDGE-TTS] Error:', error);
      console.error('❌ [EDGE-TTS] Error type:', typeof error);
      console.error('❌ [EDGE-TTS] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      // Final fallback to Google TTS
      console.log('🔄 [EDGE-TTS] Final fallback to Google TTS...');
      try {
        const gttsService = new GTTSService();
        const fallbackResult = await gttsService.synthesize(sanitizedText, undefined, speed);
        console.log('✅ [EDGE-TTS] Google TTS fallback successful, size:', fallbackResult.audioBuffer.length, 'bytes');
        return fallbackResult;
      } catch (fallbackError) {
        console.error('❌ [EDGE-TTS] Google TTS fallback also failed:', fallbackError);
        throw new Error(`Edge TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
}

// -------------------- FACTORY --------------------
export function createTTSService(provider: TTSProvider = 'edgetts'): TTSService {
  console.log(`🎵 [TTS-FACTORY] Creating TTS service for provider: ${provider}`);
  
  switch (provider) {
    case 'gtts':
      console.log(`🎵 [TTS-FACTORY] Creating Google TTS service`);
      return new GTTSService();
    case 'edgetts':
      console.log(`🎵 [TTS-FACTORY] Creating Edge TTS service`);
      return new EdgeTTSService();
    case 'elevenlabs':
    default:
      console.log(`🎵 [TTS-FACTORY] Creating ElevenLabs TTS service`);
      return new ElevenLabsTTSService();
  }
}
