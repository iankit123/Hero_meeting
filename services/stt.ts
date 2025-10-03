// @ts-ignore
const Deepgram = require('deepgram').default;

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

export class DeepgramSTTService implements STTService {
  private deepgram: any;
  private connection: any;
  private transcriptCallback?: (result: STTResult) => void;
  private audioContext?: AudioContext;
  private processor?: ScriptProcessorNode;

  constructor() {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPGRAM_API_KEY environment variable is required");
    }
    this.deepgram = new Deepgram(apiKey);
  }

  async startTranscription(audioStream?: MediaStream): Promise<void> {
    try {
      // If no stream passed in, request mic with recommended constraints
      if (!audioStream) {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }

      this.audioContext = new AudioContext();

      // Create nodes
      const source = this.audioContext.createMediaStreamSource(audioStream);
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 2.0; // boost quiet voices

      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      // Connect graph: mic -> gain -> processor -> destination
      source.connect(gainNode);
      gainNode.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Deepgram connection
      this.connection = this.deepgram.listen.live({
        model: "nova-2",
        language: "en-US",
        smart_format: true,
        diarize: true,
        interim_results: true,
        vad_turnoff: 500, // tweak if cutoff happens
        punctuate: true,
      });

      // Handle transcripts
      this.connection.on("Transcript", (data: any) => {
        if (this.transcriptCallback && data.channel?.alternatives?.[0]) {
          const alternative = data.channel.alternatives[0];
          const result: STTResult = {
            text: alternative.transcript,
            speaker: alternative.words?.[0]?.speaker?.toString(),
            confidence: alternative.confidence || 0,
            timestamp: Date.now(),
          };
          this.transcriptCallback(result);
        }
      });

      // Send audio chunks
      this.processor.onaudioprocess = (event) => {
        const audioData = event.inputBuffer.getChannelData(0);
        const pcmData = this.convertFloat32ToPCM(audioData);
        if (this.connection) {
          this.connection.send(pcmData);
        }
      };
    } catch (error) {
      console.error("Error starting Deepgram transcription:", error);
      throw error;
    }
  }

  stopTranscription(): void {
    if (this.connection) {
      this.connection.finish();
      this.connection = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = undefined;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = undefined;
    }
  }

  onTranscript(callback: (result: STTResult) => void): void {
    this.transcriptCallback = callback;
  }

  private convertFloat32ToPCM(float32Array: Float32Array): Buffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return Buffer.from(buffer);
  }
}

// Factory function
export function createSTTService(): STTService {
  return new DeepgramSTTService();
}