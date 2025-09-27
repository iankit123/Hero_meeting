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
      console.log('\n🎯 [API] === HERO PIPELINE START ===');
      console.log('📥 [API] Received message:', message);
      console.log('📝 [API] Context provided:', context?.substring(0, 100) + '...');
      
      // Process user message and generate Hero response
      const llmService = createLLMService();
      const ttsService = createTTSService();

      // Check for Hero trigger phrases (hey hero, hi hero, etc.)
      const triggerPhrase = /(hey|hi|hello)\s+hero/i;
      console.log('🔍 [API] Checking trigger phrase against:', message);
      
      if (!triggerPhrase.test(message)) {
        console.log('❌ [API] No trigger phrase detected');
        return res.status(200).json({
          success: true,
          message: 'No trigger phrase detected',
        });
      }

      console.log('✅ [API] Hero trigger phrase detected!');
      
      // Extract the question after the trigger phrase
      const question = message.replace(triggerPhrase, '').trim();
      
      // If no specific question, provide a default greeting response
      const finalQuestion = question || 'Hello! How can I help you today?';
      
      console.log('❓ [API] Extracted question:', finalQuestion);
      console.log('\n🧠 [GEMINI] === SENDING TO LLM ===');
      console.log('📤 [GEMINI] Sending to Gemini AI:', finalQuestion);

      // Generate LLM response
      const llmResponse = await llmService.generateResponse(finalQuestion, context);
      
      console.log('📥 [GEMINI] Received response from Gemini:');
      console.log('📥 [GEMINI] Response length:', llmResponse.text?.length || 0, 'characters');
      console.log('📥 [GEMINI] Response preview:', llmResponse.text?.substring(0, 100) + '...');
      
      console.log('\n🎵 [ELEVENLABS] === SENDING TO TTS ===');
      console.log('📤 [ELEVENLABS] Sending text to TTS:', llmResponse.text?.substring(0, 50) + '...');
      
      // Generate TTS audio
      const ttsResult = await ttsService.synthesize(llmResponse.text);
      
      console.log('📥 [ELEVENLABS] Received audio from TTS:');
      console.log('📥 [ELEVENLABS] Audio buffer size:', ttsResult.audioBuffer?.length || 0, 'bytes');
      console.log('📥 [ELEVENLABS] Audio duration:', ttsResult.duration, 'seconds');
      
      console.log('\n✅ [API] === HERO PIPELINE COMPLETE ===\n');

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
    console.error('\n❌ [API] === HERO PIPELINE ERROR ===');
    console.error('❌ [API] Error details:', error instanceof Error ? error.message : 'Unknown error');
    
    // If it's an AI service error, provide a fallback response
    if (error instanceof Error && (error.message.includes('Service Unavailable') || error.message.includes('429') || error.message.includes('quota'))) {
      console.log('⚠️ [API] AI service temporarily unavailable - sending fallback response');
      res.status(200).json({
        success: true,
        response: "I'm Hero, your AI meeting assistant! I'm having trouble connecting to my AI brain right now due to high usage, but I can hear you clearly. Please try again in a moment when the AI service is available again.",
      });
    } else {
      console.error('💥 [API] Unexpected error - sending error response');
      res.status(500).json({ 
        error: 'Failed to process Hero bot request',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    console.error('❌ [API] === PIPELINE ERROR END ===\n');
  }
}
