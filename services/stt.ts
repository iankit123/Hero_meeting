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
  onInterimResult?(callback: (text: string) => void): void;
}

export class WebSpeechSTTService implements STTService {
  private recognition: any;
  private transcriptCallback?: (result: STTResult) => void;
  private interimCallback?: (text: string) => void;
  private isListening = false;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private speechTimeout: NodeJS.Timeout | null = null;
  private lastSpeechTime = Date.now();
  private isStopping = false; // Flag to prevent restart loops
  private lastTranscriptText = '';
  private lastTranscriptTime = 0;

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
    
    // Improve speech recognition sensitivity and stability
    this.recognition.maxAlternatives = 3; // Allow more alternatives for better accuracy
    this.recognition.serviceURI = '';
    
    // Enhanced settings for better sensitivity and continuous listening
    if ('webkitSpeechRecognition' in window) {
      const webkitRecognition = this.recognition as any;
      webkitRecognition.continuous = true;
      webkitRecognition.interimResults = true;
      webkitRecognition.maxAlternatives = 3;
      
      // More sensitive timeout settings
      webkitRecognition.maxSpeechTimeout = 15000; // Increased from 10s to 15s
      webkitRecognition.maxSilenceTimeout = 3000; // Reduced from 5s to 3s for faster response
      
      // Additional sensitivity settings
      // Note: grammars property requires SpeechGrammarList, not null
      // We'll skip setting grammars to avoid restrictions
    }

    this.recognition.onstart = () => {
      console.log('🎤 [WEBSPEECH] Recognition started - listening for voice input');
      this.isListening = true;
      
      // Reset deduplication state on new session
      this.lastTranscriptText = '';
      this.lastTranscriptTime = 0;
      
      // Start more aggressive keepalive interval
      this.keepAliveInterval = setInterval(() => {
        if (this.isListening) {
          const timeSinceLastSpeech = Date.now() - this.lastSpeechTime;
          console.log('💓 [WEBSPEECH] Keepalive - still listening...', `(${Math.round(timeSinceLastSpeech/1000)}s since last speech)`);
          
          // More aggressive restart strategy for better sensitivity
          if (timeSinceLastSpeech > 20000) { // Reduced from 30s to 20s
            console.log('⚠️ [WEBSPEECH] No speech detected for 20s - forcing restart for better sensitivity...');
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
              }, 500); // Reduced delay from 1000ms to 500ms
            }
          }
        }
      }, 5000); // Check every 5 seconds instead of 10 for more responsive monitoring
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
        const now = Date.now();
        const text = finalTranscript.trim();
        
        // Deduplicate: Skip if same text was sent within last 2 seconds
        const isDuplicate = (
          text === this.lastTranscriptText && 
          (now - this.lastTranscriptTime) < 2000
        );
        
        if (isDuplicate) {
          console.log('🔄 [WEBSPEECH] Duplicate transcript detected, skipping:', text);
          return;
        }
        
        console.log('🎤 [WEBSPEECH] Raw transcript received:', text);
        this.lastSpeechTime = now;
        this.lastTranscriptText = text;
        this.lastTranscriptTime = now;
        
        if (this.transcriptCallback) {
          this.transcriptCallback({
            text: text,
            speaker: 'user',
            confidence: 0.8, // Web Speech API doesn't provide confidence
            timestamp: now
          });
        }
      }
      
      // Also update speech time for interim results to improve sensitivity
      if (interimTranscript.trim()) {
        console.log('🎤 [WEBSPEECH] Interim transcript:', interimTranscript.trim());
        this.lastSpeechTime = Date.now(); // Update speech time even for interim results
        
        // Call interim callback if registered
        if (this.interimCallback) {
          this.interimCallback(interimTranscript.trim());
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('❌ [WEBSPEECH] Recognition error:', event.error);
      if (event.error === 'aborted') {
        if (this.isStopping) {
          console.log('✅ [WEBSPEECH] Recognition aborted during intentional stop - not restarting');
          return; // Don't restart if we're intentionally stopping
        }
        console.log('⚠️ [WEBSPEECH] Recognition aborted - this is normal, will restart automatically');
      } else if (event.error === 'network') {
        console.warn('🌐 [WEBSPEECH] Network error in speech recognition - connection issues');
      } else if (event.error === 'no-speech') {
        console.log('🔇 [WEBSPEECH] No speech detected - timeout reached, restarting for better sensitivity');
        // Guard: avoid InvalidStateError by ensuring recognition is actually stopped before starting
        setTimeout(() => {
          if (!this.isStopping) {
            try {
              // Explicitly stop first (safe to call if already stopped), then start.
              try { this.recognition.stop(); } catch {}
              console.log('🔄 [WEBSPEECH] Restarting after no-speech timeout...');
              this.recognition.start();
              this.lastSpeechTime = Date.now();
            } catch (restartError) {
              console.warn('⚠️ [WEBSPEECH] Restart after no-speech failed:', restartError);
            }
          }
        }, 150);
      } else if (event.error === 'audio-capture') {
        console.warn('🎤 [WEBSPEECH] Audio capture error - microphone may be in use');
      } else if (event.error === 'service-not-allowed') {
        console.warn('🚫 [WEBSPEECH] Speech recognition service not allowed');
      }
    };

    this.recognition.onend = () => {
      console.log('🔴 [WEBSPEECH] Recognition ended - preparing to restart');
      this.isListening = false;
      
      // Don't restart if we're intentionally stopping
      if (this.isStopping) {
        console.log('✅ [WEBSPEECH] Recognition ended during intentional stop - not restarting');
        return;
      }
      
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
      
      // More aggressive restart for better sensitivity
      setTimeout(() => {
        try {
          if (!this.isListening && !this.isStopping) {
            console.log('🔄 [WEBSPEECH] Restarting speech recognition for better sensitivity...');
            this.lastSpeechTime = Date.now();
            this.recognition.start();
          }
        } catch (error) {
          console.warn('⚠️ [WEBSPEECH] Recognition restart failed:', error instanceof Error ? error.message : 'Unknown error');
          // More aggressive retry with shorter delay
          setTimeout(() => {
            if (!this.isListening && !this.isStopping) {
              try {
                console.log('🔄 [WEBSPEECH] Retry restarting speech recognition...');
                this.lastSpeechTime = Date.now();
                this.recognition.start();
              } catch (retryError) {
                console.error('❌ [WEBSPEECH] Retry restart also failed:', retryError);
              }
            }
          }, 200); // Reduced from 300ms to 200ms for faster recovery
        }
      }, 50); // Reduced from 100ms to 50ms for faster restart
    };
  }

  async startTranscription(audioStream?: MediaStream): Promise<void> {
    try {
      console.log('🎤 [WEBSPEECH] Starting Web Speech API transcription...');
      this.isStopping = false; // Reset stopping flag when starting
      // Ensure clean start to reduce initial clipping of first words
      try { this.recognition.stop(); } catch {}
      this.recognition.start();
    } catch (error) {
      console.error('❌ [WEBSPEECH] Error starting transcription:', error);
      throw error;
    }
  }

  stopTranscription(): void {
    console.log('🛑 [WEBSPEECH] Stopping Web Speech API transcription...');
    this.isListening = false;
    this.isStopping = true; // Set flag to prevent restart loops
    
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
    
    try {
      // More aggressive stopping
      this.recognition.stop();
      this.recognition.abort(); // Force abort any ongoing recognition
      console.log('✅ [WEBSPEECH] Recognition stopped and aborted');
    } catch (error) {
      console.warn('⚠️ [WEBSPEECH] Error stopping recognition:', error);
    }
    
    // Clear deduplication state
    this.lastTranscriptText = '';
    this.lastTranscriptTime = 0;
    
    // Clear any pending callbacks
    this.transcriptCallback = undefined;
    this.interimCallback = undefined;
  }

  onTranscript(callback: (result: STTResult) => void): void {
    this.transcriptCallback = callback;
  }

  onInterimResult(callback: (text: string) => void): void {
    this.interimCallback = callback;
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
    
    // Clear any pending callbacks
    this.transcriptCallback = undefined;
    
    console.log('✅ [DEEPGRAM] Deepgram transcription stopped and cleaned up');
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

export class VoskSTTService implements STTService {
  private model: any = null;
  private recognizer: any = null;
  private transcriptCallback?: (result: STTResult) => void;
  private interimCallback?: (text: string) => void;
  private audioContext?: AudioContext;
  private processor?: ScriptProcessorNode;
  private mediaStream?: MediaStream;
  private isListening = false;
  private isInitialized = false;
  private isInitializing = false;
  private modelRef: any = null;
  private recognizerRef: any = null;

  private readonly MODEL_URL = '/vosk-model-small-en-us-0.15.tar.gz';

  constructor() {
    console.log('🎤 [VOSK] VoskSTTService initialized');
  }

  async initializeModel(): Promise<void> {
    if (this.isInitialized) {
      console.log('🎤 [VOSK] Model already initialized');
      return;
    }

    if (this.isInitializing) {
      console.log('🎤 [VOSK] Model initialization already in progress');
      return;
    }

    this.isInitializing = true;

    try {
      console.log('🎤 [VOSK] Loading Vosk model (this may take a moment)...');
      
      // Dynamically import vosk-browser to avoid SSR issues
      const { createModel } = await import('vosk-browser');
      
      // Load the Vosk model
      const model = await createModel(this.MODEL_URL);
      this.model = model;
      this.modelRef = model;
      
      console.log('✅ [VOSK] Model loaded successfully');
      this.isInitialized = true;
      this.isInitializing = false;
    } catch (error) {
      console.error('❌ [VOSK] Error loading model:', error);
      this.isInitializing = false;
      throw error;
    }
  }

  async startTranscription(audioStream?: MediaStream): Promise<void> {
    try {
      console.log('🎤 [VOSK] Starting Vosk transcription...');

      // Initialize model if not already done
      if (!this.isInitialized) {
        await this.initializeModel();
      }

      // Get audio stream if not provided
      if (!audioStream) {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          }
        });
      }

      this.mediaStream = audioStream;

      // Create audio context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      console.log('🎧 [VOSK] AudioContext created with sample rate:', this.audioContext.sampleRate);

      // Create audio source from microphone
      const source = this.audioContext.createMediaStreamSource(audioStream);

      // Create recognizer
      const recognizer = new this.model.KaldiRecognizer(16000);
      recognizer.setWords(true);
      this.recognizer = recognizer;
      this.recognizerRef = recognizer;

      // ✅ CRITICAL: Use event listeners for results
      recognizer.on('result', (message: any) => {
        if (message.result && message.result.text) {
          const text = message.result.text.trim();
          if (text && this.transcriptCallback) {
            console.log('🎤 [VOSK] Final transcript received:', text);
            this.transcriptCallback({
              text: text,
              speaker: 'user',
              confidence: 0.9, // Vosk doesn't provide confidence, use default
              timestamp: Date.now()
            });
          }
        }
      });

      recognizer.on('partialresult', (message: any) => {
        // Optionally show partial results
        if (message.result && message.result.partial) {
          const partialText = message.result.partial.trim();
          if (partialText && this.interimCallback) {
            this.interimCallback(partialText);
          }
        }
      });

      // Create script processor for audio processing
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.isListening) return;

        try {
          // ✅ CRITICAL: acceptWaveform expects AudioBuffer, not Int16Array
          recognizer.acceptWaveform(event.inputBuffer);
        } catch (error) {
          console.error('❌ [VOSK] acceptWaveform failed:', error);
        }
      };

      // Connect audio nodes
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isListening = true;
      console.log('✅ [VOSK] Vosk transcription started');
    } catch (error) {
      console.error('❌ [VOSK] Error starting transcription:', error);
      throw error;
    }
  }

  stopTranscription(): void {
    console.log('🛑 [VOSK] Stopping Vosk transcription...');
    
    this.isListening = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = undefined;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
      this.audioContext = undefined;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = undefined;
    }

    // Clear any pending callbacks
    this.transcriptCallback = undefined;
    this.interimCallback = undefined;

    console.log('✅ [VOSK] Vosk transcription stopped');
  }

  onTranscript(callback: (result: STTResult) => void): void {
    this.transcriptCallback = callback;
  }

  onInterimResult(callback: (text: string) => void): void {
    this.interimCallback = callback;
  }

  // Helper method to preload model (called from landing page)
  static async preloadModel(): Promise<void> {
    try {
      console.log('🔄 [VOSK] Preloading model...');
      const { createModel } = await import('vosk-browser');
      await createModel('/vosk-model-small-en-us-0.15.tar.gz');
      console.log('✅ [VOSK] Model preloaded successfully');
    } catch (error) {
      console.error('❌ [VOSK] Error preloading model:', error);
      // Don't throw - preloading is optional
    }
  }
}

// Factory function
export function createSTTService(provider: 'webspeech' | 'deepgram' | 'vosk' = 'webspeech'): STTService {
  console.log(`🎤 [STT] Creating STT service with provider: ${provider}`);
  
  switch (provider) {
    case 'deepgram':
      return new DeepgramSTTService();
    case 'vosk':
      return new VoskSTTService();
    case 'webspeech':
    default:
      return new WebSpeechSTTService();
  }
}