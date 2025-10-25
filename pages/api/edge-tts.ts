import { NextApiRequest, NextApiResponse } from 'next';
import { unlinkSync } from 'fs';
import { EdgeTTS } from 'edge-tts-universal';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice = 'en-US-AriaNeural', speed = 1.0 } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('🎙️ [EDGE-TTS-API] === SYNTHESIZE START ===');
    console.log('🎙️ [EDGE-TTS-API] Text length:', text.length);
    console.log('🎙️ [EDGE-TTS-API] Voice:', voice);
    console.log('🎙️ [EDGE-TTS-API] Speed:', speed);

    // Sanitize text
    const sanitizedText = text
      .replace(/\*\*/g, "") // remove bold markdown (**text**)
      .replace(/\*/g, "") // remove italic markdown (*text*)
      .replace(/#/g, "") // remove headers (# Header)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // remove links [text](url) -> text
      .replace(/`([^`]+)`/g, "$1") // remove code blocks `code` -> code
      .replace(/\n+/g, " ") // replace newlines with spaces
      .trim();

    if (!sanitizedText || sanitizedText.length < 2) {
      console.error('❌ [EDGE-TTS-API] Invalid text - too short');
      return res.status(400).json({ error: 'No valid text to synthesize' });
    }

    console.log('🌐 [EDGE-TTS-API] Generating audio using edge-tts-universal...');
    const tts = new EdgeTTS(sanitizedText, voice);
    const result: any = await tts.synthesize();
    const arrayBuffer = await result.audio.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = sanitizedText.split(' ').length;
    const estimatedDuration = (wordCount / 150) * 60 / speed;

    console.log('✅ [EDGE-TTS-API] Audio generated, size:', audioBuffer.length, 'bytes');
    console.log('✅ [EDGE-TTS-API] Estimated duration:', estimatedDuration, 'seconds');
    console.log('✅ [EDGE-TTS-API] === SYNTHESIZE COMPLETE ===\n');

    // Return the audio buffer as base64
    res.status(200).json({
      success: true,
      audioBuffer: audioBuffer.toString('base64'),
      duration: estimatedDuration,
      size: audioBuffer.length
    });

  } catch (error) {
    console.error('❌ [EDGE-TTS-API] Error:', error);
    
    res.status(500).json({ 
      error: `Edge TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
}
