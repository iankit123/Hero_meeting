import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseContextService } from '../../../services/supabase-context';
import { createLLMService } from '../../../services/llm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { roomName } = req.body;

    if (!roomName) {
      return res.status(400).json({ success: false, error: 'Room name is required' });
    }

    console.log(`🧠 [SUMMARY] Generating summary for meeting: ${roomName}`);

    // First, find the meeting by room name to get the UUID
    const { data: meeting, error: meetingError } = await supabaseContextService.supabase
      .from('meetings')
      .select('id')
      .eq('room_name', roomName)
      .single();

    if (meetingError || !meeting) {
      console.error('❌ [SUMMARY] Meeting not found:', meetingError);
      return res.status(404).json({ 
        success: false, 
        error: 'Meeting not found' 
      });
    }

    console.log(`✅ [SUMMARY] Found meeting with ID: ${meeting.id}`);

    // Get transcripts for this meeting using the UUID
    const transcripts = await supabaseContextService.getTranscriptsByMeeting(meeting.id);
    
    if (transcripts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No transcripts found for this meeting' 
      });
    }

    // Format transcripts for LLM
    const transcriptText = transcripts
      .map((t: any) => `${t.speaker}: ${t.message}`)
      .join('\n');

    // Generate summary using improved prompt with anti-hallucination rules
    const llmService = createLLMService();
    
    // Extract actual speakers from transcripts to prevent hallucination
    const actualSpeakers = Array.from(new Set(transcripts.map((t: any) => t.speaker).filter(Boolean)));
    const summaryPrompt = `
You are "Hero", the AI meeting assistant for Hero Meeting — an AI-powered meeting platform.

Your task is to generate a clear, factual, and well-structured summary of the meeting using **only** the information in the provided transcript.

🧠 STRICT RULES:
1. Only refer to people who are explicitly listed as speakers: ${actualSpeakers.join(', ')}.
2. Never make up facts, names, or context not present in the transcript.
3. Summarize in a professional, neutral tone.
4. If something is unclear or incomplete, note it instead of speculating.
5. Keep the output concise but information-rich — avoid repetition.
6. Use bullet points where appropriate.
7. Do not include generic filler like “everyone agreed” unless it’s clearly stated.

🎯 OUTPUT FORMAT (Markdown):

## Meeting Overview
A short 2–4 sentence overview describing the meeting’s purpose and overall discussion themes.

## Key Discussion Points
- List the major topics covered.
- Summarize ideas, issues, or explanations raised by participants.

## Decisions & Conclusions
- Record any conclusions, agreements, or decisions made during the meeting.

## Action Items
- List specific follow-ups, owners (if mentioned), and deadlines (if mentioned).

## Next Steps
- Mention any clear next steps, future plans, or recommendations discussed.

## Key Quotes or Highlights
- Include 2–3 short quotes or notable remarks that represent the tone or focus of the meeting.

## Participants
${actualSpeakers.join(', ')}

---

Transcript:
${transcriptText}
`;

//     const summaryPrompt = `Generate a factual summary of this meeting based ONLY on the provided transcript. 

// CRITICAL RULES:
// 1. ONLY mention people who are explicitly listed as speakers: ${actualSpeakers.join(', ')}
// 2. NEVER make up names, people, or details not in the transcript
// 3. Base all information strictly on what was actually said
// 4. If information is unclear, don't speculate
// 5. Write in third person perspective (e.g., "Hero said...", "Matt reported...")

// Please structure your response as follows:
// 1. *Meeting Overview*: Brief 1-3 sentence summary of what was discussed
// 2. *Key Takeaways*: Main points and decisions made
// 3. *Action Items*: Specific tasks or follow-ups identified
// 4. *Next Steps*: Clear next steps or recommendations
// 5. *Key Quotes*: Important quotes that capture the essence of discussions

// Meeting Transcript:
// ${transcriptText}`;
    
    const summaryResponse = await llmService.generateResponse(summaryPrompt, '');
    const summary = summaryResponse.text;

    // Save summary to database
    await supabaseContextService.saveMeetingSummary(
      roomName,
      summary,
      [], // keyPoints - could be extracted from summary
      [], // actionItems - could be extracted from summary  
      []  // participants - could be extracted from transcripts
    );

    console.log(`✅ [SUMMARY] Summary generated and saved for: ${roomName}`);

    res.status(200).json({
      success: true,
      summary,
      transcriptCount: transcripts.length
    });

  } catch (error) {
    console.error('❌ [SUMMARY] Error generating summary:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate summary' 
    });
  }
}
