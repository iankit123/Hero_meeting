import { NextApiRequest, NextApiResponse } from 'next';
import { createTTSService } from '../../services/tts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🧪 [TTS-TEST] === TESTING EDGE TTS ===');
    
    const { text = 'Hello world', provider = 'edgetts' } = req.body;
    
    console.log(`🧪 [TTS-TEST] Provider: ${provider}`);
    console.log(`🧪 [TTS-TEST] Text: ${text}`);
    
    const ttsService = createTTSService(provider as any);
    console.log(`🧪 [TTS-TEST] Service created: ${ttsService.constructor.name}`);
    
    console.log(`🧪 [TTS-TEST] Calling synthesize...`);
    const result = await ttsService.synthesize(text);
    
    console.log(`🧪 [TTS-TEST] Success! Audio size: ${result.audioBuffer.length} bytes`);
    console.log(`🧪 [TTS-TEST] Duration: ${result.duration} seconds`);
    
    res.status(200).json({
      success: true,
      provider: provider,
      serviceType: ttsService.constructor.name,
      audioSize: result.audioBuffer.length,
      duration: result.duration,
      audioBuffer: result.audioBuffer.toString('base64')
    });
    
  } catch (error) {
    console.error('🧪 [TTS-TEST] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
