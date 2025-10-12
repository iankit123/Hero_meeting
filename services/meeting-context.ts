// Service to retrieve relevant past meeting context
import { supabaseContextService } from './supabase-context';

export interface MeetingContext {
  meetingId: string;
  roomName: string;
  date: string;
  transcripts: Array<{
    speaker: string;
    participantName: string;
    message: string;
  }>;
}

class MeetingContextService {
  /**
   * Get relevant past meeting context for an organization
   * This is a simple keyword-based search for now
   * TODO: Upgrade to vector/semantic search with embeddings
   */
  async getRelevantContext(orgName: string, query: string, limit: number = 2): Promise<string> {
    try {
      // Get recent meetings from the org
      const meetings = await supabaseContextService.getMeetingsByOrg(orgName, 10);
      
      if (meetings.length === 0) {
        return '';
      }

      // For now, just return the most recent past meetings
      // In a full RAG implementation, we would:
      // 1. Generate embeddings for the query
      // 2. Do similarity search against stored embeddings
      // 3. Return the most semantically relevant meetings
      
      const contextPieces: string[] = [];
      
      for (const meeting of meetings.slice(0, limit)) {
        try {
          const transcripts = await supabaseContextService.getTranscriptsByMeeting(meeting.id);
          
          if (transcripts.length > 0) {
            const meetingDate = new Date(meeting.started_at).toLocaleDateString();
            let meetingContext = `\n**Previous Meeting (${meetingDate}, Room: ${meeting.room_name})**\n`;
            
            // Format transcripts
            transcripts.forEach((t: any) => {
              const speaker = t.participant_name || t.speaker;
              meetingContext += `- ${speaker}: "${t.message}"\n`;
            });
            
            contextPieces.push(meetingContext);
          }
        } catch (err) {
          console.warn('⚠️ [MEETING-CONTEXT] Error fetching transcripts for meeting:', err);
        }
      }
      
      if (contextPieces.length > 0) {
        return `\n**Context from Previous Meetings:**\n${contextPieces.join('\n')}`;
      }
      
      return '';
    } catch (error) {
      console.error('❌ [MEETING-CONTEXT] Error getting relevant context:', error);
      return '';
    }
  }
}

// Singleton instance
export const meetingContextService = new MeetingContextService();

