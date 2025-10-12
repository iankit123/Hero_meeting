// Simple in-memory context storage for meeting conversations
// Now also persists to Supabase when enabled

import { supabaseContextService } from './supabase-context';

interface ConversationEntry {
  id: string;
  timestamp: number;
  speaker: 'user' | 'hero' | 'system';
  message: string;
  roomName: string;
}

class ContextService {
  private conversations: Map<string, ConversationEntry[]> = new Map();
  private maxEntriesPerRoom = 50; // Keep last 50 entries per room
  private useSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? true : false; // Auto-detect Supabase

  // Add a conversation entry
  addEntry(roomName: string, speaker: 'user' | 'hero' | 'system', message: string): void {
    if (!this.conversations.has(roomName)) {
      this.conversations.set(roomName, []);
    }

    const entries = this.conversations.get(roomName)!;
    const entry: ConversationEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      speaker,
      message: message.trim(),
      roomName
    };

    entries.push(entry);

    // Keep only the most recent entries
    if (entries.length > this.maxEntriesPerRoom) {
      entries.splice(0, entries.length - this.maxEntriesPerRoom);
    }

    console.log(`📝 [CONTEXT] Added entry for room ${roomName}: ${speaker} - ${message.substring(0, 50)}...`);

    // ALSO save to Supabase (async, non-blocking)
    if (this.useSupabase) {
      supabaseContextService.addTranscript(roomName, speaker, message).catch(err => {
        console.error('⚠️ [CONTEXT] Failed to save to Supabase:', err);
      });
    }
  }

  // Get conversation history for a room
  getContext(roomName: string, maxEntries: number = 20): string {
    const entries = this.conversations.get(roomName) || [];
    const recentEntries = entries.slice(-maxEntries);
    
    if (recentEntries.length === 0) {
      return '';
    }

    const contextString = recentEntries
      .map(entry => {
        const speakerLabel = entry.speaker === 'user' ? 'User' : 
                           entry.speaker === 'hero' ? 'Hero AI' : 'System';
        return `${speakerLabel}: ${entry.message}`;
      })
      .join('\n');

    console.log(`📖 [CONTEXT] Retrieved ${recentEntries.length} entries for room ${roomName}`);
    return contextString;
  }

  // Get conversation history as structured data
  getConversationHistory(roomName: string, maxEntries: number = 20): ConversationEntry[] {
    const entries = this.conversations.get(roomName) || [];
    return entries.slice(-maxEntries);
  }

  // Clear conversation history for a room
  clearContext(roomName: string): void {
    this.conversations.delete(roomName);
    console.log(`🗑️ [CONTEXT] Cleared context for room ${roomName}`);
  }

  // Get all rooms with active conversations
  getActiveRooms(): string[] {
    return Array.from(this.conversations.keys());
  }

  // Get conversation summary for a room
  getConversationSummary(roomName: string): string {
    const entries = this.conversations.get(roomName) || [];
    if (entries.length === 0) {
      return 'No previous conversation in this meeting.';
    }

    const userMessages = entries.filter(e => e.speaker === 'user').length;
    const heroMessages = entries.filter(e => e.speaker === 'hero').length;
    const totalDuration = entries.length > 0 ? 
      Math.round((entries[entries.length - 1].timestamp - entries[0].timestamp) / 1000 / 60) : 0;

    return `This meeting has ${entries.length} total messages (${userMessages} from users, ${heroMessages} from Hero AI) over approximately ${totalDuration} minutes.`;
  }
}

// Singleton instance
const contextService = new ContextService();

export { contextService };
export type { ConversationEntry };
export default contextService;
