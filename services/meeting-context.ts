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
   * @param excludeRoomName - Exclude this room from the search (current meeting)
   */
  async getRelevantContext(orgName: string, query: string, limit: number = 10, excludeRoomName?: string): Promise<string> {
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
          const formattedDate = new Date(meeting.started_at).toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric' 
          });
          
          // Skip meetings that only contain questions or inquiries (no substantive discussion)
          const summary = meeting.summary?.toLowerCase() || '';
          const summaryOriginal = meeting.summary || '';
          
          // FILTER 1: Exclude Hero-centric summaries (summaries primarily about Hero's actions)
          const heroMentions = [
            'hero reviewed', 'hero reported', 'hero investigated', 'hero checked',
            'hiro reviewed', 'hiro reported', 'hiro investigated',
            ' i reviewed', ' i reported', ' i investigated', ' i checked',
            'it was decided that i', 'it was decided that hero', 'it was decided that hiro',
            'hero would investigate', 'hiro would investigate', 'i would investigate',
            'i, hero or hiro', 'i, hiro or hero', 'hero or hiro would'
          ];
          
          const hasHeroActions = heroMentions.some(phrase => summary.includes(phrase));
          
          // Count Hero actions vs participant actions
          // Hero actions: Hero/Hiro/I reviewed/reported/investigated
          const heroActionMatches = summary.match(/(hero|hiro|\bi\b)\s+(reviewed|reported|investigated|checked|would investigate|will investigate)/gi) || [];
          
          // Participant actions: exclude "reported" when it's Hero reporting
          const participantVerbs = summary.match(/\b(discussed|suggested|agreed|decided|proposed|identified|addressed|resolved|implemented|tracked|monitored)\b/gi) || [];
          
          // Count "reported" only if it's not Hero reporting (check context)
          const reportedMatches = summary.match(/\breported\b/gi) || [];
          const heroReportedMatches = summary.match(/(hero|hiro|\bi\b)\s+reported/gi) || [];
          const participantReportedCount = reportedMatches.length - heroReportedMatches.length;
          
          const participantActionMatches = [...participantVerbs];
          if (participantReportedCount > 0) {
            // Add participant-reported matches separately
            for (let i = 0; i < participantReportedCount; i++) {
              participantActionMatches.push('reported');
            }
          }
          
          // If summary is primarily about Hero's actions (more Hero actions than participant actions), exclude it
          const isHeroCentric = hasHeroActions && heroActionMatches.length >= participantActionMatches.length;
          
          if (isHeroCentric) {
            console.log(`🔇 [RAG-TIER1] Filtering out Hero-centric summary (${heroActionMatches.length} Hero actions, ${participantActionMatches.length} participant actions): "${summaryOriginal.substring(0, 100)}..."`);
            return; // Skip this summary
          }
          
          // FILTER 2: Skip summaries that are only questions or inquiries
          const hasSubstantiveContent = summary.includes('discussed') || summary.includes('reported') || 
            summary.includes('suggested') || summary.includes('agreed') || summary.includes('decided') || 
            summary.includes('proposed') || summary.includes('centered on') || summary.includes('focused on') ||
            summary.includes('identified') || summary.includes('addressed') || summary.includes('resolved') ||
            summary.includes('implemented') || summary.includes('tracked') || summary.includes('monitored');
          
          const isOnlyQuestions = summary.includes('asked') || summary.includes('inquired') || summary.includes('summarized') ||
            (summary.includes('what') || summary.includes('how') || summary.includes('when') || summary.includes('where')) &&
            !hasSubstantiveContent;
          
          // FILTER 3: Exclude summaries that are primarily questions asked to Hero
          const heroQuestionPatterns = [
            'asked hero', 'asked hiro', 'asked if hero', 'questioned hero',
            'hero was asked', 'hiro was asked', 'hero answered', 'hiro answered'
          ];
          const isHeroQuestionSummary = heroQuestionPatterns.some(pattern => summary.includes(pattern)) &&
            !hasSubstantiveContent;
          
          if (hasSubstantiveContent && !isOnlyQuestions && !isHeroQuestionSummary) {
            // Sanitize summary to remove Hero self-references while keeping participant discussions
            let sanitizedSummary = summaryOriginal;
            
            // Remove Hero self-reference phrases but keep participant discussions
            sanitizedSummary = sanitizedSummary
              .replace(/\b(i|hero|hiro)\s+(reviewed|reported|investigated|checked|would investigate|will investigate)\s+/gi, '')
              .replace(/\bit\s+was\s+decided\s+that\s+(i|hero|hiro)\s+(would|will)\s+/gi, 'it was decided that ')
              .replace(/\b(i,?\s+)?(hero|hiro)\s+(or\s+)?(hero|hiro|i)\s*,?\s+(would|will|should)\s+/gi, '')
              .replace(/\b(hero|hiro)\s+(or\s+)?(hero|hiro|i)\s*,?\s+(would|will|should)\s+/gi, '')
              .replace(/\b(i|hero|hiro)\s+(also\s+)?(reviewed|reported|investigated)\s+/gi, '')
              .replace(/\bwhere\s+(i|hero|hiro)\s+(reported|reviewed|investigated)\s+/gi, 'where ')
              .replace(/\s+/g, ' ') // Clean up multiple spaces
              .trim();
            
            // Only include if there's still substantive content after sanitization
            if (sanitizedSummary.length > 20) {
              context += `\n${idx + 1}. Meeting on ${formattedDate} [${similarity}% relevant]\n`;
              context += `   Summary: ${sanitizedSummary}\n`;
            } else {
              console.log(`🔇 [RAG-TIER1] Summary became too short after sanitization, excluding: "${summaryOriginal.substring(0, 100)}..."`);
            }
          }
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
              
              // Apply filtering: exclude Hero responses and questions-only
              const filteredTier2Transcripts = relevantTranscripts.filter((result: any) => {
                const speaker = result.speaker || 'Unknown';
                const speakerLower = speaker.toLowerCase();
                
                // Filter 1: Exclude Hero responses
                const isHeroResponse = speakerLower.includes('hero') || 
                                     speakerLower === 'system' || 
                                     speakerLower === 'hero ai' ||
                                     speakerLower.includes('hiro');
                
                if (isHeroResponse) {
                  console.log(`🔇 [RAG-TIER2] Filtering out Hero response: "${result.message.substring(0, 50)}..."`);
                  return false;
                }
                
                // Filter 2: Exclude questions-only (without substantive content)
                const message = result.message?.toLowerCase() || '';
                const isQuestion = message.includes('?') || 
                                  message.trim().startsWith('what ') || 
                                  message.trim().startsWith('how ') ||
                                  message.trim().startsWith('when ') ||
                                  message.trim().startsWith('where ') ||
                                  message.trim().startsWith('who ') ||
                                  message.trim().startsWith('why ') ||
                                  message.includes('do you') || 
                                  message.includes('can you') || 
                                  message.includes('could you') ||
                                  message.includes('would you') ||
                                  message.includes('have we') ||
                                  message.includes('did we');
                
                const hasSubstantiveContent = message.includes('discussed') || 
                  message.includes('reported') || 
                  message.includes('suggested') || 
                  message.includes('agreed') || 
                  message.includes('decided') || 
                  message.includes('proposed') ||
                  message.includes('identified') || 
                  message.includes('addressed') || 
                  message.includes('resolved') ||
                  message.includes('implemented') || 
                  message.includes('tracked') || 
                  message.includes('monitored') ||
                  message.includes('decreased') || 
                  message.includes('increased') || 
                  message.includes('failed') ||
                  message.includes('success') || 
                  message.includes('rate') || 
                  message.includes('transaction') ||
                  message.includes('mentioned') ||
                  message.includes('explained') ||
                  message.includes('noted') ||
                  message.includes('said');
                
                // Exclude if it's ONLY a question without substantive content
                if (isQuestion && !hasSubstantiveContent) {
                  console.log(`❓ [RAG-TIER2] Filtering out question-only: "${result.message.substring(0, 50)}..."`);
                  return false;
                }
                
                // Only include substantive content
                return hasSubstantiveContent;
              });
              
              if (filteredTier2Transcripts.length > 0) {
                filteredTier2Transcripts.forEach((result: any, idx: number) => {
                  const similarity = (result.similarity * 100).toFixed(0);
                  const formattedDate = new Date(result.created_at).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric' 
                  });
                  const speaker = result.speaker || 'Unknown';
                  context += `\n- [${similarity}%] ${speaker}: "${result.message}" (from meeting on ${formattedDate})\n`;
                });
              } else {
                console.log(`⚠️ [RAG-TIER2] All transcripts filtered out (Hero responses or questions-only)`);
              }
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
      
      // Filter out transcripts from the current meeting if excludeRoomName is provided
      const filteredTranscripts = excludeRoomName 
        ? transcriptResults.filter((t: any) => t.room_name !== excludeRoomName)
        : transcriptResults;
      
      if (filteredTranscripts.length === 0) {
        console.log('ℹ️ [RAG] No relevant context found (all results were from current meeting), falling back to recent');
        return this.getRecentContext(orgName, 2);
      }
      
      console.log(`✅ [RAG] Using ${filteredTranscripts.length} transcripts after filtering out current meeting`);

      // Extract and validate speaker names to prevent hallucination (exclude Hero)
      const validSpeakers = new Set(
        filteredTranscripts
          .map((t: any) => t.speaker)
          .filter((speaker: string) => {
            if (!speaker) return false;
            const speakerLower = speaker.toLowerCase();
            // Exclude Hero from valid speakers list
            return !speakerLower.includes('hero') && 
                   speakerLower !== 'system' && 
                   speakerLower !== 'hero ai' &&
                   !speakerLower.includes('hiro');
          })
      );
      console.log(`🔍 [RAG] Valid speakers found: ${Array.from(validSpeakers).join(', ')}`);

      // Format context for LLM with speaker validation and temporal awareness
      context = '\n**Relevant Context from Past Meetings:**\n';
      context += `**Note: Only the following people are mentioned in our records: ${Array.from(validSpeakers).join(', ')}**\n`;
      context += `**IMPORTANT: Do not assume people participated in meetings unless explicitly shown below.**\n\n`;
      
      filteredTranscripts.forEach((result: any, idx: number) => {
        const similarity = (result.similarity * 100).toFixed(0);
        const formattedDate = new Date(result.created_at).toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric' 
        });
        const speaker = result.speaker || 'Unknown';
        
        // FILTER 1: Exclude Hero's responses from previous meetings
        const speakerLower = speaker.toLowerCase();
        const isHeroResponse = speakerLower.includes('hero') || 
                               speakerLower === 'system' || 
                               speakerLower === 'hero ai' ||
                               speakerLower.includes('hiro');
        
        if (isHeroResponse) {
          console.log(`🔇 [RAG] Filtering out Hero response: "${result.message.substring(0, 50)}..."`);
          return; // Skip this transcript
        }
        
        // FILTER 2: Skip messages that are only questions without substantive content
        const message = result.message?.toLowerCase() || '';
        
        // Check if it's a question
        const isQuestion = message.includes('?') || 
                          message.trim().startsWith('what ') || 
                          message.trim().startsWith('how ') ||
                          message.trim().startsWith('when ') ||
                          message.trim().startsWith('where ') ||
                          message.trim().startsWith('who ') ||
                          message.trim().startsWith('why ') ||
                          message.includes('do you') || 
                          message.includes('can you') || 
                          message.includes('could you') ||
                          message.includes('would you') ||
                          message.includes('have we') ||
                          message.includes('did we');
        
        // Check for substantive content (actual discussion/decisions, not just questions)
        const hasSubstantiveContent = message.includes('discussed') || 
          message.includes('reported') || 
          message.includes('suggested') || 
          message.includes('agreed') || 
          message.includes('decided') || 
          message.includes('proposed') || 
          message.includes('centered on') || 
          message.includes('focused on') ||
          message.includes('identified') || 
          message.includes('addressed') || 
          message.includes('resolved') ||
          message.includes('implemented') || 
          message.includes('tracked') || 
          message.includes('monitored') ||
          message.includes('decreased') || 
          message.includes('increased') || 
          message.includes('failed') ||
          message.includes('success') || 
          message.includes('rate') || 
          message.includes('transaction') ||
          message.includes('mentioned') ||
          message.includes('explained') ||
          message.includes('noted') ||
          message.includes('said');
        
        // Exclude if it's ONLY a question without substantive content
        if (isQuestion && !hasSubstantiveContent) {
          console.log(`❓ [RAG] Filtering out question-only: "${result.message.substring(0, 50)}..."`);
          return; // Skip this transcript
        }
        
        // Include only substantive content (not just questions)
        if (hasSubstantiveContent) {
          context += `\n${idx + 1}. [${similarity}% relevant] ${speaker}: "${result.message}"\n`;
          context += `   (From meeting on ${formattedDate})\n`;
        }
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
      console.log(`🔍 [RAG-FALLBACK] Getting recent meetings for org: "${orgName}" (limit: 5)`);
      const meetings = await supabaseContextService.getMeetingsByOrg(orgName, 5);
      
      console.log(`📊 [RAG-FALLBACK] Found ${meetings.length} meetings for org "${orgName}"`);
      if (meetings.length === 0) {
        console.warn(`⚠️ [RAG-FALLBACK] No meetings found for org "${orgName}" - returning empty context`);
        return '';
      }

      const contextPieces: string[] = [];
      
      for (const meeting of meetings.slice(0, limit)) {
        try {
          console.log(`📖 [RAG-FALLBACK] Fetching transcripts for meeting ${meeting.id} (${meeting.room_name})`);
          const transcripts = await supabaseContextService.getTranscriptsByMeeting(meeting.id);
          
          console.log(`📊 [RAG-FALLBACK] Found ${transcripts.length} transcripts for meeting ${meeting.id}`);
          if (transcripts.length > 0) {
            const meetingDate = new Date(meeting.started_at).toLocaleDateString();
            let meetingContext = `\n**Previous Meeting (${meetingDate})**\n`;
            
            // Filter transcripts: exclude Hero responses and questions-only
            const filteredTranscripts = transcripts.filter((t: any) => {
              const speaker = t.speaker || 'Unknown';
              const speakerLower = speaker.toLowerCase();
              
              // Filter 1: Exclude Hero responses
              const isHeroResponse = speakerLower.includes('hero') || 
                                   speakerLower === 'system' || 
                                   speakerLower === 'hero ai' ||
                                   speakerLower.includes('hiro');
              
              if (isHeroResponse) {
                return false;
              }
              
              // Filter 2: Exclude questions-only (without substantive content)
              const message = t.message?.toLowerCase() || '';
              const isQuestion = message.includes('?') || 
                                message.trim().startsWith('what ') || 
                                message.trim().startsWith('how ') ||
                                message.trim().startsWith('when ') ||
                                message.trim().startsWith('where ') ||
                                message.trim().startsWith('who ') ||
                                message.trim().startsWith('why ') ||
                                message.includes('do you') || 
                                message.includes('can you') || 
                                message.includes('could you') ||
                                message.includes('would you') ||
                                message.includes('have we') ||
                                message.includes('did we');
              
              const hasSubstantiveContent = message.includes('discussed') || 
                message.includes('reported') || 
                message.includes('suggested') || 
                message.includes('agreed') || 
                message.includes('decided') || 
                message.includes('proposed') ||
                message.includes('identified') || 
                message.includes('addressed') || 
                message.includes('resolved') ||
                message.includes('implemented') || 
                message.includes('tracked') || 
                message.includes('monitored') ||
                message.includes('decreased') || 
                message.includes('increased') || 
                message.includes('failed') ||
                message.includes('success') || 
                message.includes('rate') || 
                message.includes('transaction') ||
                message.includes('mentioned') ||
                message.includes('explained') ||
                message.includes('noted') ||
                message.includes('said');
              
              // Exclude if it's ONLY a question without substantive content
              if (isQuestion && !hasSubstantiveContent) {
                return false;
              }
              
              // Only include substantive content
              return hasSubstantiveContent;
            });
            
            // Limit to first 5 filtered transcripts to avoid context overflow
            if (filteredTranscripts.length > 0) {
              filteredTranscripts.slice(0, 5).forEach((t: any) => {
                const speaker = t.speaker || 'Unknown';
                meetingContext += `- ${speaker}: "${t.message}"\n`;
              });
              
              contextPieces.push(meetingContext);
              console.log(`✅ [RAG-FALLBACK] Added context from meeting ${meeting.id} (${filteredTranscripts.length} substantive transcripts)`);
            } else {
              console.log(`⚠️ [RAG-FALLBACK] No substantive transcripts in meeting ${meeting.id} (filtered out Hero responses and questions-only)`);
            }
          }
        } catch (err) {
          console.warn('⚠️ [RAG-FALLBACK] Error fetching transcripts:', err);
        }
      }
      
      if (contextPieces.length > 0) {
        const finalContext = `\n**Context from Recent Meetings:**\n${contextPieces.join('\n')}`;
        console.log(`✅ [RAG-FALLBACK] Returning ${contextPieces.length} meeting contexts (${finalContext.length} chars total)`);
        return finalContext;
      }
      
      console.warn(`⚠️ [RAG-FALLBACK] No context pieces generated - returning empty`);
      return '';
    } catch (error) {
      console.error('❌ [RAG-FALLBACK] Error getting recent context:', error);
      return '';
    }
  }
}

// Singleton instance
export const meetingContextService = new MeetingContextService();

