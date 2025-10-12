import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Database types
interface Meeting {
  id: string;
  room_name: string;
  org_name?: string;
  started_at: string;
  ended_at?: string;
  participant_count: number;
  duration_minutes?: number;
  metadata?: any;
}

interface Transcript {
  id: string;
  meeting_id: string;
  room_name: string;
  org_name?: string;
  speaker: string;
  speaker_id?: string;
  message: string;
  timestamp: string;
  metadata?: any;
  embedding?: number[];
}

interface MeetingSummary {
  id: string;
  meeting_id: string;
  room_name: string;
  summary: string;
  key_points: string[];
  action_items: string[];
  participants: string[];
  embedding?: number[];
}

export class SupabaseContextService {
  public supabase: SupabaseClient; // Public for vector search queries
  private activeMeetings: Map<string, string> = new Map(); // roomName -> meetingId
  private isEnabled: boolean = false;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    console.log('🔍 [SUPABASE-INIT] Checking environment variables...');
    console.log('🔍 [SUPABASE-INIT] SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING');
    console.log('🔍 [SUPABASE-INIT] SUPABASE_KEY length:', supabaseKey?.length || 0);

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ [SUPABASE] Missing environment variables - Supabase integration disabled');
      this.isEnabled = false;
      // Create a dummy client to avoid null checks everywhere
      this.supabase = {} as SupabaseClient;
      return;
    }

    try {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          fetch: fetch.bind(globalThis)
        }
      });
      this.isEnabled = true;
      console.log('✅ [SUPABASE] Context service initialized');
      console.log('✅ [SUPABASE] URL:', supabaseUrl);
    } catch (error) {
      console.error('❌ [SUPABASE] Failed to create client:', error);
      this.isEnabled = false;
      this.supabase = {} as SupabaseClient;
    }
  }

  /**
   * Start a new meeting session
   */
  async startMeeting(roomName: string, orgName?: string, metadata?: any): Promise<string | null> {
    if (!this.isEnabled) return null;

    try {
      // Normalize org name to lowercase for case-insensitive matching
      const normalizedOrgName = orgName ? orgName.toLowerCase() : undefined;
      
      const { data, error} = await this.supabase
        .from('meetings')
        .insert({
          room_name: roomName,
          org_name: normalizedOrgName,
          started_at: new Date().toISOString(),
          metadata: metadata || {}
        })
        .select()
        .single();

      if (error) throw error;

      const meetingId = data.id;
      this.activeMeetings.set(roomName, meetingId);
      
      console.log(`✅ [SUPABASE] Meeting started: ${roomName} (${meetingId}) for org: ${orgName} (normalized: ${normalizedOrgName})`);
      return meetingId;
    } catch (error) {
      console.error('❌ [SUPABASE] Error starting meeting:', error);
      return null;
    }
  }

  /**
   * End a meeting and calculate duration
   */
  async endMeeting(roomName: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const meetingId = this.activeMeetings.get(roomName);
      if (!meetingId) {
        console.warn(`⚠️ [SUPABASE] No active meeting found for room: ${roomName}`);
        return;
      }

      // Get meeting start time to calculate duration
      const { data: meeting } = await this.supabase
        .from('meetings')
        .select('started_at')
        .eq('id', meetingId)
        .single();

      const durationMinutes = meeting 
        ? Math.round((Date.now() - new Date(meeting.started_at).getTime()) / 1000 / 60)
        : 0;

      const { error } = await this.supabase
        .from('meetings')
        .update({
          ended_at: new Date().toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('id', meetingId);

      if (error) throw error;

      this.activeMeetings.delete(roomName);
      console.log(`✅ [SUPABASE] Meeting ended: ${roomName} (${durationMinutes} minutes)`);
    } catch (error) {
      console.error('❌ [SUPABASE] Error ending meeting:', error);
    }
  }

  /**
   * Add a transcript entry (called on every message)
   */
  async addTranscript(
    roomName: string,
    speaker: string,
    message: string,
    speakerId?: string,
    metadata?: any,
    orgName?: string
  ): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // Get or create meeting ID
      let meetingId = this.activeMeetings.get(roomName);
      
      if (!meetingId) {
        // Check if meeting exists in DB
        const { data: existingMeeting } = await this.supabase
          .from('meetings')
          .select('id')
          .eq('room_name', roomName)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingMeeting) {
          meetingId = existingMeeting.id;
          this.activeMeetings.set(roomName, meetingId);
        } else {
          // Auto-create meeting if it doesn't exist
          meetingId = await this.startMeeting(roomName, orgName);
          if (!meetingId) return; // Failed to create meeting
        }
      }

      // Normalize org name to lowercase for case-insensitive matching
      const normalizedOrgName = orgName ? orgName.toLowerCase() : undefined;
      
      const { data, error } = await this.supabase
        .from('transcripts')
        .insert({
          meeting_id: meetingId,
          room_name: roomName,
          org_name: normalizedOrgName,
          speaker,
          speaker_id: speakerId,
          message: message.trim(),
          timestamp: new Date().toISOString(),
          metadata: metadata || {}
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`💾 [SUPABASE] Transcript saved: ${speaker} - ${message.substring(0, 50)}...`);

      // Auto-generate embeddings for new transcripts (async, non-blocking)
      if (process.env.HUGGINGFACE_API_KEY && data?.id) {
        // Import at runtime to avoid circular dependencies
        import('./embeddings-hf').then(({ hfEmbeddingsService }) => {
          hfEmbeddingsService.embedTranscript(data.id, message.trim()).catch(err => {
            console.warn('⚠️ [SUPABASE] Failed to auto-embed transcript:', err);
          });
        }).catch(err => {
          console.warn('⚠️ [SUPABASE] Failed to load embeddings service:', err);
        });
      }
    } catch (error) {
      console.error('❌ [SUPABASE] Error saving transcript:', error);
      // Don't throw - we don't want to break the app if DB save fails
    }
  }

  /**
   * Get all transcripts for a meeting
   */
  async getTranscripts(roomName: string, limit: number = 100): Promise<Transcript[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await this.supabase
        .from('transcripts')
        .select('*')
        .eq('room_name', roomName)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      console.log(`✅ [SUPABASE] Retrieved ${data?.length || 0} transcripts for room: ${roomName}`);
      return data || [];
    } catch (error) {
      console.error('❌ [SUPABASE] Error fetching transcripts:', error);
      return [];
    }
  }

  /**
   * Get all transcripts for a meeting by meeting ID
   */
  async getTranscriptsByMeeting(meetingId: string, limit: number = 100): Promise<Transcript[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await this.supabase
        .from('transcripts')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      console.log(`✅ [SUPABASE] Retrieved ${data?.length || 0} transcripts for meeting: ${meetingId}`);
      return data || [];
    } catch (error) {
      console.error('❌ [SUPABASE] Error fetching transcripts by meeting:', error);
      return [];
    }
  }

  /**
   * Get meeting transcript as formatted JSON
   */
  async getMeetingTranscriptJSON(roomName: string): Promise<any> {
    if (!this.isEnabled) {
      return {
        error: 'Supabase not configured',
        meeting: null,
        transcripts: []
      };
    }

    try {
      const { data: meeting } = await this.supabase
        .from('meetings')
        .select('*')
        .eq('room_name', roomName)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const transcripts = await this.getTranscripts(roomName);

      return {
        meeting: meeting ? {
          id: meeting.id,
          roomName: meeting.room_name,
          startedAt: meeting.started_at,
          endedAt: meeting.ended_at,
          durationMinutes: meeting.duration_minutes,
          participantCount: meeting.participant_count
        } : null,
        transcripts: transcripts.map(t => ({
          speaker: t.speaker,
          message: t.message,
          timestamp: t.timestamp
        })),
        metadata: {
          totalMessages: transcripts.length,
          exportedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ [SUPABASE] Error exporting transcript JSON:', error);
      throw error;
    }
  }

  /**
   * Save meeting summary
   */
  async saveMeetingSummary(
    roomName: string,
    summary: string,
    keyPoints: string[] = [],
    actionItems: string[] = [],
    participants: string[] = []
  ): Promise<void> {
    if (!this.isEnabled) return;

    try {
      let meetingId = this.activeMeetings.get(roomName);
      
      if (!meetingId) {
        // Check if meeting exists in DB
        const { data: existingMeeting } = await this.supabase
          .from('meetings')
          .select('id')
          .eq('room_name', roomName)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingMeeting) {
          meetingId = existingMeeting.id;
        } else {
          console.warn(`⚠️ [SUPABASE] No meeting found for summary: ${roomName}`);
          return;
        }
      }

      const { error } = await this.supabase
        .from('meeting_summaries')
        .insert({
          meeting_id: meetingId,
          room_name: roomName,
          summary,
          key_points: keyPoints,
          action_items: actionItems,
          participants
        });

      if (error) throw error;

      console.log(`✅ [SUPABASE] Meeting summary saved for: ${roomName}`);
    } catch (error) {
      console.error('❌ [SUPABASE] Error saving summary:', error);
    }
  }

  /**
   * Get all meetings
   */
  async getAllMeetings(limit: number = 50): Promise<Meeting[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await this.supabase
        .from('meetings')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ [SUPABASE] Error fetching meetings:', error);
      return [];
    }
  }

  /**
   * Get meetings by organization
   */
  async getMeetingsByOrg(orgName: string, limit: number = 50): Promise<Meeting[]> {
    if (!this.isEnabled) {
      console.warn('⚠️ [SUPABASE] Service not enabled - check environment variables');
      return [];
    }

    try {
      // Normalize org name to lowercase for case-insensitive matching
      const normalizedOrgName = orgName.toLowerCase();
      
      console.log(`🔍 [SUPABASE] Query params: org_name = "${normalizedOrgName}", limit = ${limit}`);
      
      const { data, error } = await this.supabase
        .from('meetings')
        .select('*')
        .eq('org_name', normalizedOrgName)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ [SUPABASE] Query error:', error);
        throw error;
      }

      console.log(`✅ [SUPABASE] Retrieved ${data?.length || 0} meetings for org: ${orgName} (normalized: ${normalizedOrgName})`);
      
      // Debug: Log first meeting if exists
      if (data && data.length > 0) {
        console.log(`📊 [SUPABASE] First meeting:`, {
          id: data[0].id,
          room_name: data[0].room_name,
          org_name: data[0].org_name,
          started_at: data[0].started_at
        });
      } else {
        console.warn(`⚠️ [SUPABASE] No meetings found for org_name = "${normalizedOrgName}"`);
        
        // Debug: Check if ANY meetings exist
        const { data: allMeetings } = await this.supabase
          .from('meetings')
          .select('org_name')
          .limit(10);
        console.log(`🔍 [SUPABASE] Sample org_names in database:`, allMeetings?.map(m => `"${m.org_name}"`));
      }
      
      return data || [];
    } catch (error) {
      console.error('❌ [SUPABASE] Error fetching meetings for org:', error);
      return [];
    }
  }

  /**
   * Delete a meeting and all its transcripts
   */
  async deleteMeeting(meetingId: string): Promise<boolean> {
    if (!this.isEnabled) return false;

    try {
      // Delete transcripts first (foreign key constraint)
      const { error: transcriptError } = await this.supabase
        .from('transcripts')
        .delete()
        .eq('meeting_id', meetingId);

      if (transcriptError) throw transcriptError;

      // Delete the meeting
      const { error: meetingError } = await this.supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (meetingError) throw meetingError;

      console.log(`✅ [SUPABASE] Meeting deleted: ${meetingId}`);
      return true;
    } catch (error) {
      console.error('❌ [SUPABASE] Error deleting meeting:', error);
      return false;
    }
  }

  /**
   * Search transcripts by text (basic text search, not vector yet)
   */
  async searchTranscripts(query: string, limit: number = 10): Promise<Transcript[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await this.supabase
        .from('transcripts')
        .select('*')
        .textSearch('message', query)
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ [SUPABASE] Error searching transcripts:', error);
      return [];
    }
  }
}

// Singleton instance
export const supabaseContextService = new SupabaseContextService();

