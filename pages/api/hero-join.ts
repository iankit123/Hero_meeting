import { NextApiRequest, NextApiResponse } from 'next';
import { AccessToken } from 'livekit-server-sdk';
import { createLLMService } from '../../services/llm';
import { createTTSService } from '../../services/tts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomName, message, context, action } = req.body;

    if (action === 'join') {
      // Hero bot joining the room
      const livekitApiKey = process.env.LIVEKIT_API_KEY;
      const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

      if (!livekitApiKey || !livekitApiSecret) {
        return res.status(500).json({ 
          error: 'LiveKit configuration missing' 
        });
      }

      // Create access token for Hero bot
      const token = new AccessToken(livekitApiKey, livekitApiSecret, {
        identity: 'hero-bot',
        name: 'Hero AI Assistant',
      });

      token.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      });

      const jwt = await token.toJwt();

      res.status(200).json({
        success: true,
        token: jwt,
        message: 'Hero bot ready to join',
      });

    } else if (message) {
      // Process user message and generate Hero response
      const llmService = createLLMService();
      const ttsService = createTTSService();

      // Check for "hey hero" trigger phrase
      const triggerPhrase = /hey\s+hero/i;
      if (!triggerPhrase.test(message)) {
        return res.status(200).json({
          success: true,
          message: 'No trigger phrase detected',
        });
      }

      // Extract the question after the trigger phrase
      const question = message.replace(triggerPhrase, '').trim();
      if (!question) {
        return res.status(200).json({
          success: true,
          message: 'No question detected after trigger phrase',
        });
      }

      // Generate LLM response
      const llmResponse = await llmService.generateResponse(question, context);
      
      // Generate TTS audio
      const ttsResult = await ttsService.synthesize(llmResponse.text);

      res.status(200).json({
        success: true,
        response: llmResponse.text,
        audioBuffer: ttsResult.audioBuffer.toString('base64'),
        duration: ttsResult.duration,
      });

    } else {
      return res.status(400).json({ 
        error: 'Missing required parameters' 
      });
    }

  } catch (error) {
    console.error('Error in hero-join API:', error);
    res.status(500).json({ 
      error: 'Failed to process Hero bot request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
