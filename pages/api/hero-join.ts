import { NextApiRequest, NextApiResponse } from 'next';
import { AccessToken } from 'livekit-server-sdk';
import { createLLMService } from '../../services/llm';
import { createTTSService } from '../../services/tts';
import { contextService } from '../../services/context';
import { meetingContextService } from '../../services/meeting-context';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomName, message, context, action, ttsProvider } = req.body;

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
      
      // Note: User message is already stored by frontend via /api/store-speech
      // So we don't need to store it again here to avoid duplicates
      const { orgName } = req.body;
      
      // Process user message and generate Hero response
      const llmService = createLLMService();
      
      // Use TTS provider from request or fallback to environment variable
      const selectedTtsProvider = ttsProvider || process.env.TTS_PROVIDER as 'elevenlabs' | 'gtts' || 'gtts';
      const ttsService = createTTSService(selectedTtsProvider);
      
      console.log(`🎵 [TTS] Using provider: ${selectedTtsProvider}`);

      // Check for Hero/Hiro trigger phrases (hey hero/hiro, hi hero/hiro, hello hero/hiro, or just hero/hiro)
      const triggerPhrase = /(hey|hi|hello)\s+(hero|hiro)|^\s*(hero|hiro)\b/i;
      console.log('🔍 [API] Checking trigger phrase against:', message);
      
      if (!triggerPhrase.test(message)) {
        console.log('❌ [API] No trigger phrase detected');
        return res.status(200).json({
          success: true,
          message: 'No trigger phrase detected',
        });
      }

      console.log('✅ [API] Hero/Hiro trigger phrase detected!');
      
      // Extract the question after the trigger phrase
      const question = message.replace(triggerPhrase, '').trim();
      
      // If no specific question, provide a default greeting response
      const finalQuestion = question || 'Hello! How can I help you today?';
      
      console.log('❓ [API] Extracted question:', finalQuestion);
      
      // Get conversation context from storage
      const conversationContext = contextService.getContext(roomName, 15);
      const contextSummary = contextService.getConversationSummary(roomName);
      
      console.log('📚 [CONTEXT] Retrieved conversation history:');
      console.log('📚 [CONTEXT] Summary:', contextSummary);
      console.log('📚 [CONTEXT] Recent messages:', conversationContext.substring(0, 200) + '...');
      
      // Get relevant past meeting context if org name is provided
      let pastMeetingContext = '';
      if (orgName) {
        console.log(`🔍 [PAST-MEETINGS] Retrieving past meetings for org: ${orgName}`);
        pastMeetingContext = await meetingContextService.getRelevantContext(orgName, finalQuestion, 2);
        if (pastMeetingContext) {
          console.log(`✅ [PAST-MEETINGS] Retrieved past meeting context (${pastMeetingContext.length} chars)`);
        } else {
          console.log(`ℹ️ [PAST-MEETINGS] No relevant past meetings found`);
        }
      }
      
      // Create enhanced context for the LLM
      let enhancedContext = '';
      if (conversationContext) {
        enhancedContext = `Current Meeting Context:\n${contextSummary}\n\nRecent Conversation:\n${conversationContext}`;
      }
      if (pastMeetingContext) {
        enhancedContext += `\n\n${pastMeetingContext}`;
      }
      if (!enhancedContext) {
        enhancedContext = `Current Question: ${finalQuestion}`;
      } else {
        enhancedContext += `\n\nCurrent Question: ${finalQuestion}`;
      }
      
      console.log('\n🧠 [GEMINI] === SENDING TO LLM ===');
      console.log('📤 [GEMINI] Sending to Gemini AI with context:', finalQuestion);
      console.log('🔍 [DEBUG] Enhanced context being sent:', enhancedContext.substring(0, 500) + '...');

      // Generate LLM response with anti-hallucination prompt
      const hasContext = enhancedContext && enhancedContext.trim().length > 0;
      
      const antiHallucinationPrompt = `You are a helpful AI assistant for meeting discussions. 

CRITICAL RULES:
1. ONLY use information explicitly provided in the context below
2. NEVER make up names, people, or details not mentioned in the context
3. NEVER assume someone participated in a meeting unless explicitly shown
4. If you don't have specific information, say "I don't have that specific information"
5. Do not reference people who are not mentioned in the provided context
6. Be precise and factual - avoid speculation
7. Pay attention to meeting dates and participants - don't assume temporal relationships
8. ${hasContext ? 'Use the context provided below' : 'NO CONTEXT PROVIDED - do not make up any details or names'}

Context: ${enhancedContext || 'NO CONTEXT AVAILABLE'}

Question: ${finalQuestion}

Answer based ONLY on the provided context. ${hasContext ? 'Do not make assumptions about who participated in which meetings.' : 'Since no context is available, only provide general information without mentioning specific people or meetings.'}`;

      const llmResponse = await llmService.generateResponse(antiHallucinationPrompt, '');
      
      console.log('📥 [GEMINI] Received response from Gemini:');
      console.log('📥 [GEMINI] Response length:', llmResponse.text?.length || 0, 'characters');
      console.log('📥 [GEMINI] Response preview:', llmResponse.text?.substring(0, 100) + '...');
      
      // Clean the response text for TTS (remove markdown formatting)
      const cleanTextForTTS = llmResponse.text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
        .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
        .replace(/#{1,6}\s*/g, '') // Remove headers
        .replace(/`(.*?)`/g, '$1') // Remove code backticks
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
        .replace(/\n{2,}/g, '. ') // Replace multiple newlines with periods
        .replace(/\n/g, ' ') // Replace single newlines with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      console.log('\n🎵 [ELEVENLABS] === SENDING TO TTS ===');
      console.log('🧹 [TTS] Original text:', llmResponse.text.substring(0, 100) + '...');
      console.log('🧹 [TTS] Cleaned text:', cleanTextForTTS.substring(0, 100) + '...');
      console.log('📤 [ELEVENLABS] Sending text to TTS:', cleanTextForTTS?.substring(0, 50) + '...');

      // Generate TTS audio with fallback
      let ttsResult;
      try {
        ttsResult = await ttsService.synthesize(cleanTextForTTS);
        console.log('✅ [TTS] Successfully generated audio');
      } catch (ttsError) {
        console.error('❌ [TTS] Initial TTS failed:', ttsError);
        
        // Try with simpler text as fallback
        const fallbackText = llmResponse.text
          .replace(/[^\w\s.]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 100);
        
        console.log(`🔄 [TTS] Trying fallback text: "${fallbackText}"`);
        ttsResult = await ttsService.synthesize(fallbackText);
        console.log('✅ [TTS] Fallback audio generated successfully');
      }
      
      console.log('📥 [ELEVENLABS] Received audio from TTS:');
      console.log('📥 [ELEVENLABS] Audio buffer size:', ttsResult.audioBuffer?.length || 0, 'bytes');
      console.log('📥 [ELEVENLABS] Audio duration:', ttsResult.duration, 'seconds');
      
      // Store the Hero response in context (use original text for context, cleaned text for TTS)
      contextService.addEntry(roomName, 'hero', llmResponse.text, orgName);
      
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
      const fallbackResponse = "I'm Hero, your AI meeting assistant! I'm having trouble connecting to my AI brain right now due to high usage, but I can hear you clearly. Please try again in a moment when the AI service is available again.";
      
      // Store the fallback response in context too
      if (req.body.roomName) {
        const { orgName } = req.body;
        contextService.addEntry(req.body.roomName, 'hero', fallbackResponse, orgName);
      }
      
      res.status(200).json({
        success: true,
        response: fallbackResponse,
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
