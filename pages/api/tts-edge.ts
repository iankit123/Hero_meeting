import { NextApiRequest, NextApiResponse } from 'next';
import { EdgeTTS } from '@andresaya/edge-tts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, voice = 'en-US-AriaNeural' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }

  console.log('🎙️ [EDGE-TTS] === SYNTHESIZE START ===');
  console.log('🎙️ [EDGE-TTS] Text length:', text.length);
  console.log('🎙️ [EDGE-TTS] Voice:', voice);

  try {
    // Sanitize text
    const sanitizedText = text
      .replace(/\*\*/g, "") // remove bold markdown
      .replace(/[*_~`#<>[\]{}|]/g, "") // remove markdown and special chars
      .replace(/https?:\/\/\S+/g, "") // remove links
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\x00-\x7F]/g, "") // remove emojis
      .replace(/\s{2,}/g, " ") // collapse multiple spaces
      .replace(/\s+([.,!?;:])/g, "$1") // clean space before punctuation
      .trim();

    console.log('🧹 [EDGE-TTS] Sanitized text:', sanitizedText.substring(0, 100) + '...');

    if (!sanitizedText || sanitizedText.length < 2) {
      console.error('❌ [EDGE-TTS] Invalid text - too short');
      return res.status(400).json({ error: 'No valid text to synthesize' });
    }

    console.log('🌐 [EDGE-TTS] Generating TTS with Edge TTS...');

    // Create Edge TTS instance
    const tts = new EdgeTTS();
    
    // Synthesize audio
    await tts.synthesize(sanitizedText, voice);
    
    // Get audio buffer
    const audioBuffer = tts.toBuffer();
    
    console.log('✅ [EDGE-TTS] Audio generated, size:', audioBuffer.length, 'bytes');
    
    // Get duration
    const duration = tts.getDuration();
    console.log('✅ [EDGE-TTS] Duration:', duration, 'seconds');

    // Set response headers
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length.toString());
    res.setHeader('X-Duration', duration.toString());

    console.log('✅ [EDGE-TTS] === SYNTHESIZE COMPLETE ===\n');

    // Send the audio buffer
    res.send(audioBuffer);

  } catch (error) {
    console.error('❌ [EDGE-TTS] Error:', error);
    res.status(500).json({ 
      error: 'Edge TTS generation failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}