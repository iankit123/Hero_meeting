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
      // Pipeline start (condensed logging)
      console.log('\n🎯 [API] HERO pipeline start');
      console.log('📥 [API] Message:', message);
      
      // Note: User message is already stored by frontend via /api/store-speech
      // So we don't need to store it again here to avoid duplicates
      const { orgName } = req.body;
      
      // Process user message and generate Hero response
      const llmService = createLLMService();
      
      // Use TTS provider from request or fallback to environment variable
      const selectedTtsProvider = ttsProvider || process.env.TTS_PROVIDER as 'elevenlabs' | 'gtts' || 'gtts';
      const ttsService = createTTSService(selectedTtsProvider);
      
      console.log(`🎵 [TTS] Provider: ${selectedTtsProvider}`);

      // Check for Hero/Hiro trigger phrases (hey hero/hiro, hi hero/hiro, hello hero/hiro, or just hero/hiro)
      const triggerPhrase = /(hey|hi|hello)\s+(hero|hiro)|^\s*(hero|hiro)\b/i;
      // Trigger detection
      
      if (!triggerPhrase.test(message)) {
        console.log('❌ [API] No trigger phrase');
        return res.status(200).json({
          success: true,
          message: 'No trigger phrase detected',
        });
      }

      console.log('✅ [API] Trigger detected');
      
      // Extract the question after the trigger phrase
      const question = message.replace(triggerPhrase, '').trim();
      
      // If no specific question, provide a default greeting response
      const finalQuestion = question || 'Hello! How can I help you today?';
      
      console.log('❓ [API] Question:', finalQuestion);
      
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
      
      console.log('\n🧠 [GEMINI] Send');
      // console.debug('🔍 [DEBUG] Enhanced context:', enhancedContext.substring(0, 500) + '...');

      // === General vs Meeting heuristic ===
      const qLower = finalQuestion.toLowerCase();
      const mentionsMeeting = /(meeting|minutes|notes|summary|agenda|discussion|action items|participants|org|organization|project|ticket|sprint|retro|standup|call|yesterday|last time)/i.test(qLower);
      const genericFacty = /(capital|who is|what is|when is|define|explain|country|math|formula|weather|distance|population|president|prime minister|news|time in|how to|why)/i.test(qLower);
      const hasPastContext = !!pastMeetingContext && pastMeetingContext.trim().length > 0;
      
      const classifyAsMeeting = hasPastContext && (mentionsMeeting || (!genericFacty && qLower.length < 400));
      const classifyAsGeneral = genericFacty || (!hasPastContext && !mentionsMeeting);

      // Build prompts for both modes
      const meetingPrompt = `You are Hero, an AI assistant participating in meetings. Respond as Hero using first person ("I", "me", "my").

RULES (MEETING MODE):
- Use ONLY the meeting context below. Do not invent people, dates, or decisions.
- If context lacks the answer, say: "I don't have that in my meeting notes."
- Keep answers concise; use bullet points for multiple items.

Context:
${enhancedContext || 'NO CONTEXT AVAILABLE'}

Question: ${finalQuestion}

Answer as Hero based strictly on the meeting context.`;

      const generalPrompt = `You are Hero, an AI assistant. Respond as Hero using first person ("I", "me", "my").

RULES (GENERAL KNOWLEDGE MODE):
- Provide a direct, accurate answer using general knowledge.
- Be concise and practical; use a short paragraph or bullets.
- If useful, add 1-2 clarifying facts.
- Do NOT reference internal meetings unless explicitly asked.

Question: ${finalQuestion}`;

      // Choose prompt
      const promptToUse = classifyAsMeeting ? meetingPrompt : generalPrompt;
      const llmResponse = await llmService.generateResponse(promptToUse, '');
      
      console.log('📥 [GEMINI] Received');
      
      // If model still refuses on a general ask, retry once in general mode
      const refusalLike = /i\s+do\s+not\s+have|i\s+don['’]t\s+have|no\s+information|not\s+in\s+my\s+records/i;
      if (classifyAsGeneral && refusalLike.test(llmResponse.text || '')) {
        console.log('🔁 [GEMINI] Retrying in strict general mode due to refusal');
        const retry = await llmService.generateResponse(generalPrompt, '');
        if ((retry.text || '').trim().length > 0) {
          llmResponse.text = retry.text;
        }
      }

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

      console.log('\n🎵 [TTS] Generate audio');

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
        console.log('✅ [TTS] Fallback audio generated');
      }
      
      console.log('📥 [TTS] Audio ready:', ttsResult.duration, 's');
      
      // Store the Hero response in context (use original text for context, cleaned text for TTS)
      contextService.addEntry(roomName, 'hero', llmResponse.text, orgName);
      
      console.log('\n✅ [API] HERO pipeline complete');

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
