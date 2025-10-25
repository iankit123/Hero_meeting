import React, { useState, useEffect, useCallback } from 'react';
import TranscriptModal from './TranscriptModal';

interface Meeting {
  id: string;
  room_name: string;
  org_name?: string;
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
  participant_count: number;
  summary?: string;
  participant_names?: string[]; // Add participant names
}

interface Transcript {
  id: string;
  speaker: string;
  message: string;
  timestamp: string;
}

const PastMeetingsTab: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [selectedTranscripts, setSelectedTranscripts] = useState<Transcript[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load cached data immediately, then refresh in background
  useEffect(() => {
    loadCachedMeetings();
    loadMeetings(true); // Background refresh
  }, [loadMeetings]);

  // Load cached meetings from localStorage
  const loadCachedMeetings = () => {
    try {
      const orgName = localStorage.getItem('hero_meeting_org');
      if (!orgName) return;

      const cacheKey = `meetings_cache_${orgName}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        const cacheAge = Date.now() - parsedData.timestamp;
        const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes
        
        if (cacheAge < MAX_CACHE_AGE) {
          console.log('📦 Loading cached meetings...');
          setMeetings(parsedData.meetings);
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error loading cached meetings:', error);
    }
  };

  // Save meetings to cache
  const saveMeetingsToCache = (meetings: Meeting[]) => {
    try {
      const orgName = localStorage.getItem('hero_meeting_org');
      if (!orgName) return;

      const cacheKey = `meetings_cache_${orgName}`;
      const cacheData = {
        meetings,
        timestamp: Date.now()
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log('💾 Meetings cached successfully');
    } catch (error) {
      console.error('Error caching meetings:', error);
    }
  };

  const loadMeetings = useCallback(async (background = false) => {
    if (!background) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    
    try {
      const orgName = localStorage.getItem('hero_meeting_org');
      if (!orgName) return;

      const response = await fetch(`/api/meetings/by-org?orgName=${encodeURIComponent(orgName)}`);
      const data = await response.json();

      if (data.success) {
        // Fetch participant names for each meeting
        const meetingsWithNames = await Promise.all(
          (data.meetings || []).map(async (meeting: Meeting) => {
            try {
              const transcriptResponse = await fetch(`/api/meetings/export-transcript?roomName=${encodeURIComponent(meeting.room_name)}`);
              const transcriptData = await transcriptResponse.json();
              
              if (transcriptData.transcripts && Array.isArray(transcriptData.transcripts)) {
                // Extract unique participant names (excluding system messages and 'hero')
                const uniqueNames = Array.from(
                  new Set(
                    transcriptData.transcripts
                      .filter((t: Transcript) => t.speaker && t.speaker !== 'system' && t.speaker !== 'Hero AI' && t.speaker.toLowerCase() !== 'hero')
                      .map((t: Transcript) => t.speaker)
                  )
                );
                return { ...meeting, participant_names: uniqueNames };
              }
            } catch (error) {
              console.error('Error fetching participant names:', error);
            }
            return { ...meeting, participant_names: [] };
          })
        );
        
        setMeetings(meetingsWithNames);
        saveMeetingsToCache(meetingsWithNames);
      }
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleViewTranscript = async (meeting: Meeting) => {
    try {
      const response = await fetch(`/api/meetings/export-transcript?roomName=${encodeURIComponent(meeting.room_name)}`);
      const data = await response.json();

      // Include summary if available
      const meetingWithSummary = {
        ...meeting,
        summary: meeting.summary || undefined
      };

      setSelectedMeeting(meetingWithSummary);
      setSelectedTranscripts(data.transcripts || []);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error loading transcript:', error);
      alert('Failed to load transcript');
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const response = await fetch(`/api/meetings/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId })
      });

      const data = await response.json();

      if (data.success) {
        // Remove from list
        setMeetings(meetings.filter(m => m.id !== meetingId));
        setDeleteConfirmId(null);
        console.log('✅ Meeting deleted');
      } else {
        alert('Failed to delete meeting');
      }
    } catch (error) {
      console.error('Error deleting meeting:', error);
      alert('Failed to delete meeting');
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '60px auto 20px auto'
        }}></div>
        <p style={{ color: '#6b7280' }}>Loading meetings...</p>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `
        }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#1a1a1a',
            marginBottom: '8px'
          }}>
            Past Meetings
          </h1>
          <p style={{ fontSize: '16px', color: '#6b7280' }}>
            View and manage your previous meeting transcripts
          </p>
        </div>
        <button
          onClick={() => loadMeetings(false)}
          disabled={isRefreshing}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#667eea',
            backgroundColor: 'white',
            border: '2px solid #667eea',
            borderRadius: '8px',
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: isRefreshing ? 0.5 : 1
          }}
          onMouseEnter={(e) => {
            if (!isRefreshing) {
              e.currentTarget.style.backgroundColor = '#667eea';
              e.currentTarget.style.color = 'white';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRefreshing) {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.color = '#667eea';
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Meetings List */}
      {meetings.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1.5"
            style={{ margin: '0 auto 20px auto', display: 'block' }}
          >
            <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
            <path d="M9 22V12h6v10" />
            <path d="M12 2v7" />
            <circle cx="12" cy="9" r="1" />
          </svg>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1a1a1a',
            marginBottom: '8px'
          }}>
            No past meetings
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>
            Start your first meeting to see it here
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                border: '1px solid #e5e7eb'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: '#ede9fe',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2">
                        <path d="M23 7l-7 5 7 5V7z" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                    </div>
                    <div>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1a1a1a',
                        marginBottom: '4px'
                      }}>
                        Meeting on {formatDateTime(meeting.started_at).split(',')[0]}
                      </h3>
                      <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                        Room: {meeting.room_name}
                      </p>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '24px',
                    fontSize: '14px',
                    color: '#6b7280',
                    marginTop: '16px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>{formatDateTime(meeting.started_at)}</span>
                    </div>
                    {meeting.duration_minutes && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>{meeting.duration_minutes} minutes</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span>
                        {meeting.participant_count} participant{meeting.participant_count !== 1 ? 's' : ''}
                        {meeting.participant_names && meeting.participant_names.length > 0 && (
                          <span style={{ marginLeft: '8px', color: '#667eea', fontWeight: '500' }}>
                            ({meeting.participant_names.join(', ')})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginLeft: '20px' }}>
                  <button
                    onClick={() => handleViewTranscript(meeting)}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: 'white',
                      backgroundColor: '#667eea',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#5568d3';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#667eea';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    View Transcript
                  </button>

                  {deleteConfirmId === meeting.id ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleDeleteMeeting(meeting.id)}
                        style={{
                          padding: '10px 16px',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: 'white',
                          backgroundColor: '#ef4444',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        style={{
                          padding: '10px 16px',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#6b7280',
                          backgroundColor: '#f3f4f6',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(meeting.id)}
                      style={{
                        padding: '10px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#ef4444',
                        backgroundColor: 'transparent',
                        border: '2px solid #ef4444',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#ef4444';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transcript Modal */}
      <TranscriptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        meeting={selectedMeeting}
        transcripts={selectedTranscripts}
      />
    </div>
  );
};

export default PastMeetingsTab;

