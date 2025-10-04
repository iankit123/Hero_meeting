export interface STTResult {
  text: string;
  speaker?: string;
  confidence: number;
  timestamp: number;
}

export interface STTService {
  startTranscription(audioStream?: MediaStream): Promise<void>;
  stopTranscription(): void;
  onTranscript(callback: (result: STTResult) => void): void;
}

export class WebSpeechSTTService implements STTService {
  private recognition: any;
  private transcriptCallback?: (result: STTResult) => void;
  private isListening = false;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private speechTimeout: NodeJS.Timeout | null = null;
  private lastSpeechTime = Date.now();

  constructor() {
    // Check if browser supports speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported in this browser. Try using Chrome or Edge.');
    }

    this.recognition = new SpeechRecognition();
    this.setupRecognition();
  }

  private setupRecognition(): void {
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    
    // Improve speech recognition stability
    this.recognition.maxAlternatives = 1;
    this.recognition.serviceURI = '';
    
    // Set more conservative settings for better stability
    if ('webkitSpeechRecognition' in window) {
      (this.recognition as any).continuous = true;
      (this.recognition as any).interimResults = true;
      (this.recognition as any).maxAlternatives = 1;
      (this.recognition as any).maxSpeechTimeout = 10000;
      (this.recognition as any).maxSilenceTimeout = 5000;
    }

    this.recognition.onstart = () => {
      console.log('🎤 [WEBSPEECH] Recognition started - listening for voice input');
      this.isListening = true;
      
      // Start keepalive interval
      this.keepAliveInterval = setInterval(() => {
        if (this.isListening) {
          const timeSinceLastSpeech = Date.now() - this.lastSpeechTime;
          console.log('💓 [WEBSPEECH] Keepalive - still listening...', `(${Math.round(timeSinceLastSpeech/1000)}s since last speech)`);
          
          // If no speech detected for 30 seconds, force restart recognition
          if (timeSinceLastSpeech > 30000) {
            console.log('⚠️ [WEBSPEECH] No speech detected for 30s - forcing restart...');
            try {
              this.recognition.stop();
            } catch (e) {
              console.log('🔄 [WEBSPEECH] Recognition already stopped, restarting...');
              setTimeout(() => {
                try {
                  this.recognition.start();
                  this.lastSpeechTime = Date.now();
                } catch (restartError) {
                  console.error('❌ [WEBSPEECH] Force restart failed:', restartError);
                }
              }, 1000);
            }
          }
        }
      }, 10000);
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Show final transcript
      if (finalTranscript.trim()) {
        console.log('🎤 [WEBSPEECH] Raw transcript received:', finalTranscript.trim());
        this.lastSpeechTime = Date.now();
        
        if (this.transcriptCallback) {
          this.transcriptCallback({
            text: finalTranscript.trim(),
            speaker: 'user',
            confidence: 0.8, // Web Speech API doesn't provide confidence
            timestamp: Date.now()
          });
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('❌ [WEBSPEECH] Recognition error:', event.error);
      if (event.error === 'aborted') {
        console.log('⚠️ [WEBSPEECH] Recognition aborted - this is normal, will restart automatically');
      } else if (event.error === 'network') {
        console.warn('🌐 [WEBSPEECH] Network error in speech recognition - connection issues');
      } else if (event.error === 'no-speech') {
        console.log('🔇 [WEBSPEECH] No speech detected - timeout reached');
      } else if (event.error === 'audio-capture') {
        console.warn('🎤 [WEBSPEECH] Audio capture error - microphone may be in use');
      } else if (event.error === 'service-not-allowed') {
        console.warn('🚫 [WEBSPEECH] Speech recognition service not allowed');
      }
    };

    this.recognition.onend = () => {
      console.log('🔴 [WEBSPEECH] Recognition ended - preparing to restart');
      this.isListening = false;
      
      // Clear keepalive interval
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
      }
      
      // Clear speech timeout
      if (this.speechTimeout) {
        clearTimeout(this.speechTimeout);
        this.speechTimeout = null;
      }
      
      // Restart recognition
      setTimeout(() => {
        try {
          if (!this.isListening) {
            console.log('🔄 [WEBSPEECH] Restarting speech recognition...');
            this.lastSpeechTime = Date.now();
            this.recognition.start();
          }
        } catch (error) {
          console.warn('⚠️ [WEBSPEECH] Recognition restart failed:', error instanceof Error ? error.message : 'Unknown error');
          // Retry after a longer delay
          setTimeout(() => {
            if (!this.isListening) {
              try {
                console.log('🔄 [WEBSPEECH] Retry restarting speech recognition...');
                this.lastSpeechTime = Date.now();
                this.recognition.start();
              } catch (retryError) {
                console.error('❌ [WEBSPEECH] Retry restart also failed:', retryError);
              }
            }
          }, 300);
        }
      }, 100);
    };
  }

  async startTranscription(audioStream?: MediaStream): Promise<void> {
    try {
      console.log('🎤 [WEBSPEECH] Starting Web Speech API transcription...');
      this.recognition.start();
    } catch (error) {
      console.error('❌ [WEBSPEECH] Error starting transcription:', error);
      throw error;
    }
  }

  stopTranscription(): void {
    console.log('🛑 [WEBSPEECH] Stopping Web Speech API transcription...');
    this.isListening = false;
    
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
    
    try {
      this.recognition.stop();
    } catch (error) {
      console.warn('⚠️ [WEBSPEECH] Error stopping recognition:', error);
    }
  }

  onTranscript(callback: (result: STTResult) => void): void {
    this.transcriptCallback = callback;
  }
}

export class DeepgramSTTService implements STTService {
  private websocket?: WebSocket;
  private transcriptCallback?: (result: STTResult) => void;
  private audioContext?: AudioContext;
  private processor?: ScriptProcessorNode;
  private mediaStream?: MediaStream;
  private isConnected = false;
  private keepAliveInterval?: NodeJS.Timeout;

  constructor() {
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error("NEXT_PUBLIC_DEEPGRAM_API_KEY environment variable is required");
    }
    console.log('🎤 [DEEPGRAM] DeepgramSTTService initialized with API key');
  }

  async startTranscription(audioStream?: MediaStream): Promise<void> {
    try {
      console.log('🎤 [DEEPGRAM] Starting Deepgram WebSocket transcription...');
      
      // Get audio stream if not provided
      if (!audioStream) {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
          },
        });
      }
      
      this.mediaStream = audioStream;

      // Create WebSocket connection to Deepgram
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY;
      if (!apiKey) {
        throw new Error("Deepgram API key not found");
      }
      
      // Build WebSocket URL with proper encoding parameters
      const wsUrl = `wss://api.deepgram.com/v1/listen?` +
        `model=nova-2` +
        `&language=en-US` +
        `&encoding=linear16` +
        `&sample_rate=48000` +
        `&channels=1` +
        `&smart_format=true` +
        `&interim_results=true` +
        `&punctuate=true` +
        `&vad_events=true`;
      
      console.log('🔗 [DEEPGRAM] Connecting to:', wsUrl.split('?')[0]);
      this.websocket = new WebSocket(wsUrl, ['token', apiKey]);
      
      this.websocket.onopen = () => {
        console.log('🔗 [DEEPGRAM] WebSocket connected');
        this.isConnected = true;
        this.setupAudioProcessing();
        
        // Start keep-alive ping every 30 seconds
        this.keepAliveInterval = setInterval(() => {
          if (this.websocket && this.isConnected) {
            console.log('💓 [DEEPGRAM] Sending keep-alive ping');
            this.websocket.send(JSON.stringify({ type: 'KeepAlive' }));
          }
        }, 30000);
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different message types
          if (data.type === 'Results' && data.channel?.alternatives?.[0]?.transcript) {
            const alternative = data.channel.alternatives[0];
            const transcript = alternative.transcript.trim();
            const isFinal = data.is_final || data.speech_final || false;
            
            // Only process FINAL transcripts to avoid duplicates
            if (transcript && isFinal && this.transcriptCallback) {
              const result: STTResult = {
                text: transcript,
                speaker: alternative.words?.[0]?.speaker?.toString() || 'user',
                confidence: alternative.confidence || 0.8,
                timestamp: Date.now(),
              };
              
              console.log('🎤 [DEEPGRAM] Final transcript received:', result.text);
              this.transcriptCallback(result);
            } else if (transcript && !isFinal) {
              console.log('💬 [DEEPGRAM] Interim result (not saved):', transcript);
            }
          } else if (data.type === 'Metadata') {
            console.log('📊 [DEEPGRAM] Connection metadata received');
          } else if (data.type === 'UtteranceEnd') {
            console.log('🔚 [DEEPGRAM] Utterance ended');
          }
        } catch (error) {
          console.error('❌ [DEEPGRAM] Error parsing message:', error);
        }
      };

      this.websocket.onerror = (error) => {
        console.error('❌ [DEEPGRAM] WebSocket error:', error);
      };

      this.websocket.onclose = (event) => {
        console.log('🔴 [DEEPGRAM] WebSocket closed:', event.code, event.reason);
        this.isConnected = false;
        
        // Reconnect if it wasn't a normal closure
        if (event.code !== 1000) {
          console.log('🔄 [DEEPGRAM] Attempting to reconnect...');
          setTimeout(() => {
            if (!this.isConnected) {
              this.startTranscription(this.mediaStream);
            }
          }, 2000);
        }
      };

    } catch (error) {
      console.error("❌ [DEEPGRAM] Error starting transcription:", error);
      throw error;
    }
  }

  private setupAudioProcessing(): void {
    if (!this.mediaStream || !this.websocket) {
      console.error('❌ [DEEPGRAM] Cannot setup audio: missing stream or websocket');
      return;
    }

    try {
      // Use default sample rate and let browser handle resampling
      this.audioContext = new AudioContext();
      console.log('🎧 [DEEPGRAM] AudioContext created with sample rate:', this.audioContext.sampleRate);
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 2.0; // Boost volume for better recognition

      // Use larger buffer size for more stable audio processing
      this.processor = this.audioContext.createScriptProcessor(8192, 1, 1);

      // Connect audio graph
      source.connect(gainNode);
      gainNode.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      let audioChunkCount = 0;
      
      // Process audio and send to Deepgram
      this.processor.onaudioprocess = (event) => {
        if (this.websocket && this.isConnected) {
          const audioData = event.inputBuffer.getChannelData(0);
          
          // Check if audio has actual content (not silence)
          const hasSound = audioData.some(sample => Math.abs(sample) > 0.01);
          
          if (hasSound) {
            audioChunkCount++;
            if (audioChunkCount % 50 === 0) {
              console.log(`🎙️ [DEEPGRAM] Sent ${audioChunkCount} audio chunks`);
            }
          }
          
          const pcmData = this.convertFloat32ToPCM(audioData);
          
          try {
            if (this.websocket.readyState === WebSocket.OPEN) {
              this.websocket.send(pcmData);
            } else {
              console.warn('⚠️ [DEEPGRAM] WebSocket not open, state:', this.websocket.readyState);
            }
          } catch (sendError) {
            console.error('❌ [DEEPGRAM] Error sending audio:', sendError);
          }
        }
      };

      console.log('🎵 [DEEPGRAM] Audio processing setup complete');
      console.log('🎧 [DEEPGRAM] Audio graph: MicStream -> Gain -> Processor -> Deepgram WebSocket');
    } catch (error) {
      console.error('❌ [DEEPGRAM] Error setting up audio processing:', error);
    }
  }

  stopTranscription(): void {
    console.log('🛑 [DEEPGRAM] Stopping Deepgram transcription...');
    
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = undefined;
    }
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = undefined;
    }
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = undefined;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = undefined;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = undefined;
    }
    
    this.isConnected = false;
  }

  onTranscript(callback: (result: STTResult) => void): void {
    this.transcriptCallback = callback;
  }

  private convertFloat32ToPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    
    return buffer;
  }
}

// Factory function
export function createSTTService(provider: 'webspeech' | 'deepgram' = 'webspeech'): STTService {
  console.log(`🎤 [STT] Creating STT service with provider: ${provider}`);
  
  switch (provider) {
    case 'deepgram':
      return new DeepgramSTTService();
    case 'webspeech':
    default:
      return new WebSpeechSTTService();
  }
}