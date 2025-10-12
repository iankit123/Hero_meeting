import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseContextService } from '../../../services/supabase-context';
import { createLLMService } from '../../../services/llm';
import { hfEmbeddingsService } from '../../../services/embeddings-hf';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgName } = req.body;
    
    if (!orgName) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    console.log(`📊 [SUMMARIES] Generating missing summaries for org: ${orgName}`);

    // 1. Find meetings without summaries
    const { data: meetingsWithoutSummaries, error } = await supabaseContextService.supabase
      .from('meetings')
      .select('id, room_name, started_at, ended_at')
      .eq('org_name', orgName.toLowerCase())
      .or('summary.is.null,summary.eq.')  // NULL or empty string
      .order('started_at', { ascending: false })
      .limit(5);  // Process max 5 at a time to avoid timeout

    if (error) throw error;

    if (!meetingsWithoutSummaries || meetingsWithoutSummaries.length === 0) {
      console.log(`ℹ️ [SUMMARIES] No meetings need summaries for org: ${orgName}`);
      return res.status(200).json({ 
        success: true, 
        message: 'All meetings have summaries',
        count: 0
      });
    }

    console.log(`🔄 [SUMMARIES] Found ${meetingsWithoutSummaries.length} meetings without summaries`);

    // 2. Generate summaries (async, process in sequence to avoid rate limits)
    const results = [];
    
    for (const meeting of meetingsWithoutSummaries) {
      try {
        // Get transcripts for this meeting
        const transcripts = await supabaseContextService.getTranscriptsByMeeting(meeting.id);
        
        if (transcripts.length === 0) {
          console.log(`⚠️ [SUMMARIES] No transcripts for meeting ${meeting.room_name}`);
          results.push({ meetingId: meeting.id, success: false, reason: 'No transcripts' });
          continue;
        }

        // Format transcripts for LLM
        const transcriptText = transcripts
          .map((t: any) => `${t.speaker}: ${t.message}`)
          .join('\n');

        // Generate summary using LLM
        const llmService = createLLMService();
        const summaryPrompt = `Summarize this meeting in 2-3 concise sentences. Focus on key decisions, action items, and important discussions. Be specific about who said what:\n\n${transcriptText}`;
        
        console.log(`🧠 [SUMMARIES] Generating summary for meeting: ${meeting.room_name}`);
        const summaryResponse = await llmService.generateResponse(summaryPrompt, '');
        const summary = summaryResponse.text;

        // Generate embedding for the summary (for hybrid search)
        let summaryEmbedding = null;
        if (hfEmbeddingsService.isConfigured()) {
          try {
            summaryEmbedding = await hfEmbeddingsService.generateEmbedding(summary);
            console.log(`✅ [SUMMARIES] Generated embedding for summary (${summaryEmbedding.length} dimensions)`);
          } catch (embErr) {
            console.warn(`⚠️ [SUMMARIES] Failed to generate embedding:`, embErr);
          }
        }

        // Store summary in database
        const updateData: any = { 
          summary,
          ended_at: meeting.ended_at || new Date().toISOString()  // Mark as ended if not already
        };
        
        if (summaryEmbedding) {
          updateData.summary_embedding = summaryEmbedding;
        }

        await supabaseContextService.supabase
          .from('meetings')
          .update(updateData)
          .eq('id', meeting.id);

        console.log(`✅ [SUMMARIES] Generated summary for meeting: ${meeting.room_name}`);
        results.push({ meetingId: meeting.id, success: true });
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error(`❌ [SUMMARIES] Failed for meeting ${meeting.room_name}:`, err);
        results.push({ meetingId: meeting.id, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    const successCount = results.filter(r => r.success).length;

    console.log(`✅ [SUMMARIES] Generated ${successCount}/${meetingsWithoutSummaries.length} summaries`);

    res.status(200).json({
      success: true,
      message: `Generated ${successCount} summaries`,
      total: meetingsWithoutSummaries.length,
      successful: successCount,
      details: results
    });

  } catch (error) {
    console.error('❌ [SUMMARIES] Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate summaries',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

