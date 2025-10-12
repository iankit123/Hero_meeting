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
   * Get relevant past meeting context using vector/semantic search
   * Now with Hugging Face embeddings!
   */
  async getRelevantContext(orgName: string, query: string, limit: number = 5): Promise<string> {
    try {
      // Check if embeddings are configured
      if (!hfEmbeddingsService.isConfigured()) {
        console.warn('⚠️ [RAG] Hugging Face not configured, falling back to recent meetings');
        return this.getRecentContext(orgName, 2);
      }

      console.log(`🔍 [RAG] Searching for context: "${query.substring(0, 50)}..."`);
      
      // Generate embedding for the query
      const queryEmbedding = await hfEmbeddingsService.generateEmbedding(query);
      
      // Search for similar transcripts using pgvector
      const { data: results, error } = await supabaseContextService.supabase
        .rpc('search_transcripts_by_similarity', {
          query_embedding: queryEmbedding,
          org_filter: orgName.toLowerCase(),
          match_threshold: 0.5,
          match_count: limit
        });

      if (error) {
        console.error('❌ [RAG] Vector search error:', error);
        throw error;
      }

      if (!results || results.length === 0) {
        console.log('ℹ️ [RAG] No relevant past meetings found, falling back to recent');
        return this.getRecentContext(orgName, 2);
      }

      console.log(`✅ [RAG] Found ${results.length} relevant transcripts`);

      // Format context for LLM
      let context = '\n**Relevant Context from Past Meetings:**\n';
      
      results.forEach((result: any, idx: number) => {
        const similarity = (result.similarity * 100).toFixed(0);
        const date = new Date(result.created_at).toLocaleDateString();
        const speaker = result.speaker || 'Unknown';
        
        context += `\n${idx + 1}. [${similarity}% relevant] ${speaker}: "${result.message}"\n`;
        context += `   (Meeting: ${result.room_name}, Date: ${date})\n`;
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

