import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, voice = 'en-US-AriaNeural' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }

  console.log('🎙️ [EDGE-TTS/API] === SYNTHESIZE START ===');
  console.log('🎙️ [EDGE-TTS/API] Text length:', text.length);
  console.log('🎙️ [EDGE-TTS/API] Voice:', voice);

  try {
    // Sanitize
    const clean = text
      .replace(/\*\*/g, '')
      .replace(/[*_~`#<>[\]{}|]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\x00-\x7F]/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,!?;:])/g, '$1')
      .trim();

    if (!clean || clean.length < 2) {
      return res.status(400).json({ error: 'No valid text to synthesize' });
    }

    // 1) Get auth token from Edge
    console.log('🔑 [EDGE-TTS/API] Fetching Edge auth token...');
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0';
    const tokenResp = await fetch('https://edge.microsoft.com/translate/auth', {
      method: 'GET',
      headers: {
        'User-Agent': ua,
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
      },
    });

    if (!tokenResp.ok) {
      const t = await tokenResp.text().catch(() => '');
      console.error('❌ [EDGE-TTS/API] Auth token fetch failed:', tokenResp.status, t);
      return res.status(500).json({ error: 'Edge auth token fetch failed', status: tokenResp.status, body: t });
    }
    const token = await tokenResp.text();
    console.log('✅ [EDGE-TTS/API] Token acquired');

    // 2) Build SSML
    const ssml = `<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="${voice}">
    ${clean}
  </voice>
</speak>`;

    // 3) Request audio
    const synthUrl = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${encodeURIComponent(
      token,
    )}`;
    console.log('🌐 [EDGE-TTS/API] Synthesizing via:', synthUrl);
    const synthResp = await fetch(synthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': ua,
        'Accept': '*/*',
        'Origin': 'https://speech.microsoft.com',
        'Referer': 'https://speech.microsoft.com/',
        'Cache-Control': 'no-cache',
      },
      body: ssml,
    });

    if (!synthResp.ok) {
      const errTxt = await synthResp.text().catch(() => '');
      console.error('❌ [EDGE-TTS/API] Synthesis failed:', synthResp.status, errTxt);
      return res.status(500).json({ error: 'Edge synthesis failed', status: synthResp.status, body: errTxt });
    }

    const audioBuffer = Buffer.from(await synthResp.arrayBuffer());
    // Basic duration estimate (~60ms/char)
    const duration = Math.max(0.5, clean.length * 0.06);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length.toString());
    res.setHeader('X-Duration', duration.toString());
    console.log('✅ [EDGE-TTS/API] Audio ok, bytes:', audioBuffer.length);
    res.send(audioBuffer);

  } catch (error) {
    console.error('❌ [EDGE-TTS/API] Error:', error);
    res.status(500).json({ 
      error: 'Edge TTS generation failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}