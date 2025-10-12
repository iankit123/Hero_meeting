// Service to retrieve relevant past meeting context using vector search
import { supabaseContextService } from './supabase-context';
import { hfEmbeddingsService } from './embeddings-hf';

export interface MeetingContext {
  meetingId: string;
  roomName: string;
  date: string;
  transcripts: Array<{
    speaker: string;
    participantName: string;
    message: string;
    similarity?: number;
  }>;
}

class MeetingContextService {
  /**
   * Get relevant past meeting context using HYBRID search
   * Tier 1: Search meeting summaries (fast, broad context)
   * Tier 2: Search transcripts from relevant meetings (detailed, specific)
   */
  async getRelevantContext(orgName: string, query: string, limit: number = 10): Promise<string> {
    try {
      // Check if embeddings are configured
      if (!hfEmbeddingsService.isConfigured()) {
        console.warn('⚠️ [RAG] Hugging Face not configured, falling back to recent meetings');
        return this.getRecentContext(orgName, 2);
      }

      console.log(`🔍 [RAG-HYBRID] Searching for context: "${query.substring(0, 50)}..."`);
      
      // Generate embedding for the query
      const queryEmbedding = await hfEmbeddingsService.generateEmbedding(query);
      
      // TIER 1: Search meeting summaries first (broad, fast)
      console.log('🎯 [RAG-TIER1] Searching meeting summaries...');
      const { data: summaryResults, error: summaryError } = await supabaseContextService.supabase
        .rpc('search_meeting_summaries_by_similarity', {
          query_embedding: queryEmbedding,
          org_filter: orgName.toLowerCase(),
          match_threshold: 0.4,  // 40% threshold for summaries
          match_count: 3  // Top 3 most relevant meetings
        });

      if (summaryError) {
        console.warn('⚠️ [RAG-TIER1] Summary search error:', summaryError);
        // Fall through to transcript search
      }

      let context = '';
      
      // If we found relevant meeting summaries, use them
      if (summaryResults && summaryResults.length > 0) {
        console.log(`✅ [RAG-TIER1] Found ${summaryResults.length} relevant meetings via summaries`);
        
        // Add summary-level context with speaker validation
        context += '\n**Relevant Past Meetings:**\n';
        
        // Collect all speakers from relevant meetings for validation
        const allSpeakers = new Set();
        summaryResults.forEach((meeting: any) => {
          // Extract speaker names from summary (basic pattern matching)
          const speakerMatches = meeting.summary?.match(/([A-Z][a-z]+(?:-[A-Za-z0-9]+)?)/g) || [];
          speakerMatches.forEach((speaker: string) => {
            if (speaker.length > 2 && !speaker.match(/^(Meeting|Summary|Date|Relevant)$/)) {
              allSpeakers.add(speaker);
            }
          });
        });
        
        if (allSpeakers.size > 0) {
          context += `**Note: People mentioned in these meetings: ${Array.from(allSpeakers).join(', ')}**\n`;
          context += `**IMPORTANT: Do not assume people participated in meetings unless explicitly shown below.**\n\n`;
        }
        
        summaryResults.forEach((meeting: any, idx: number) => {
          const similarity = (meeting.similarity * 100).toFixed(0);
          const date = new Date(meeting.started_at).toLocaleDateString();
          const formattedDate = new Date(meeting.started_at).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          context += `\n${idx + 1}. Meeting on ${formattedDate} [${similarity}% relevant]\n`;
          context += `   Summary: ${meeting.summary}\n`;
        });
        
        // TIER 2: Get detailed transcripts from the top relevant meetings
        const topMeetingIds = summaryResults.slice(0, 2).map((m: any) => m.id);  // Top 2 meetings
        
        if (topMeetingIds.length > 0) {
          console.log('🎯 [RAG-TIER2] Drilling down to transcripts from relevant meetings...');
          
          // Search transcripts, but ONLY from these relevant meetings
          const { data: transcriptResults, error: transcriptError } = await supabaseContextService.supabase
            .rpc('search_transcripts_by_similarity', {
              query_embedding: queryEmbedding,
              org_filter: orgName.toLowerCase(),
              match_threshold: 0.5,  // Higher threshold for transcripts (more specific)
              match_count: 5  // Top 5 specific quotes
            });

          if (!transcriptError && transcriptResults && transcriptResults.length > 0) {
            // Filter to only include transcripts from our relevant meetings
            const relevantTranscripts = transcriptResults.filter((t: any) => 
              summaryResults.some((m: any) => m.room_name === t.room_name)
            );
            
            if (relevantTranscripts.length > 0) {
              console.log(`✅ [RAG-TIER2] Found ${relevantTranscripts.length} specific quotes from relevant meetings`);
              context += '\n**Specific Details:**\n';
              relevantTranscripts.forEach((result: any, idx: number) => {
                const similarity = (result.similarity * 100).toFixed(0);
                const formattedDate = new Date(result.created_at).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                });
                const speaker = result.speaker || 'Unknown';
                context += `\n- [${similarity}%] ${speaker}: "${result.message}" (from meeting on ${formattedDate})\n`;
              });
            }
          }
        }
        
        return context;
      }
      
      // Fallback: If no summaries found, search transcripts directly
      console.log('ℹ️ [RAG-TIER1] No meeting summaries found, searching transcripts directly...');
      const { data: transcriptResults, error: transcriptError } = await supabaseContextService.supabase
        .rpc('search_transcripts_by_similarity', {
          query_embedding: queryEmbedding,
          org_filter: orgName.toLowerCase(),
          match_threshold: 0.4,
          match_count: limit
        });

      if (transcriptError) {
        console.error('❌ [RAG] Transcript search error:', transcriptError);
        throw transcriptError;
      }

      if (!transcriptResults || transcriptResults.length === 0) {
        console.log('ℹ️ [RAG] No relevant context found, falling back to recent');
        return this.getRecentContext(orgName, 2);
      }

      console.log(`✅ [RAG] Found ${transcriptResults.length} relevant transcripts`);

      // Extract and validate speaker names to prevent hallucination
      const validSpeakers = new Set(transcriptResults.map((t: any) => t.speaker).filter(Boolean));
      console.log(`🔍 [RAG] Valid speakers found: ${Array.from(validSpeakers).join(', ')}`);

      // Format context for LLM with speaker validation and temporal awareness
      context = '\n**Relevant Context from Past Meetings:**\n';
      context += `**Note: Only the following people are mentioned in our records: ${Array.from(validSpeakers).join(', ')}**\n`;
      context += `**IMPORTANT: Do not assume people participated in meetings unless explicitly shown below.**\n\n`;
      
      transcriptResults.forEach((result: any, idx: number) => {
        const similarity = (result.similarity * 100).toFixed(0);
        const formattedDate = new Date(result.created_at).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        const speaker = result.speaker || 'Unknown';
        
        context += `\n${idx + 1}. [${similarity}% relevant] ${speaker}: "${result.message}"\n`;
        context += `   (From meeting on ${formattedDate})\n`;
      });

      return context;
    } catch (error) {
      console.error('❌ [RAG] Error getting relevant context:', error);
      
      // Fallback to recent meetings if vector search fails
      console.log('⚠️ [RAG] Falling back to recent meetings...');
      return this.getRecentContext(orgName, 2);
    }
  }

  /**
   * Fallback: Get recent meetings without vector search
   */
  private async getRecentContext(orgName: string, limit: number = 2): Promise<string> {
    try {
      const meetings = await supabaseContextService.getMeetingsByOrg(orgName, 5);
      
      if (meetings.length === 0) return '';

      const contextPieces: string[] = [];
      
      for (const meeting of meetings.slice(0, limit)) {
        try {
          const transcripts = await supabaseContextService.getTranscriptsByMeeting(meeting.id);
          
          if (transcripts.length > 0) {
            const meetingDate = new Date(meeting.started_at).toLocaleDateString();
            let meetingContext = `\n**Previous Meeting (${meetingDate})**\n`;
            
            // Limit to first 5 transcripts to avoid context overflow
            transcripts.slice(0, 5).forEach((t: any) => {
              const speaker = t.speaker || 'Unknown';
              meetingContext += `- ${speaker}: "${t.message}"\n`;
            });
            
            contextPieces.push(meetingContext);
          }
        } catch (err) {
          console.warn('⚠️ [RAG] Error fetching transcripts:', err);
        }
      }
      
      if (contextPieces.length > 0) {
        return `\n**Context from Recent Meetings:**\n${contextPieces.join('\n')}`;
      }
      
      return '';
    } catch (error) {
      console.error('❌ [RAG] Error getting recent context:', error);
      return '';
    }
  }
}

// Singleton instance
export const meetingContextService = new MeetingContextService();

