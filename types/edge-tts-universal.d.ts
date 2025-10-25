declare module 'edge-tts-universal' {
  export class EdgeTTS {
    constructor(text: string, voice?: string);
    synthesize(): Promise<{ audio: Blob; meta?: unknown }>;
  }
}


