import React, { useState, useEffect, useCallback } from 'react';

interface Transcript {
  id: string;
  speaker: string;
  message: string;
  timestamp: string;
}

interface TranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: {
    id: string;
    room_name: string;
    started_at: string;
    ended_at?: string;
    duration_minutes?: number;
    summary?: string;
  } | null;
  transcripts: Transcript[];
}

const TranscriptModal: React.FC<TranscriptModalProps> = ({ isOpen, onClose, meeting, transcripts }) => {
  const [summary, setSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const generateSummary = useCallback(async () => {
    if (isGeneratingSummary || !meeting) return;
    
    setIsGeneratingSummary(true);
    try {
      const response = await fetch('/api/meetings/generate-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: meeting.room_name
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSummary(data.summary);
        setShowSummary(true);
      } else {
        console.error('Failed to generate summary:', data.error);
      }
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [isGeneratingSummary, meeting]);

  // Load existing summary or generate new one
  useEffect(() => {
    if (isOpen && meeting) {
      if (meeting.summary) {
        setSummary(meeting.summary);
        setShowSummary(true);
      } else {
        // Generate summary if not exists
        generateSummary();
      }
    }
  }, [isOpen, meeting, generateSummary]);

  if (!isOpen || !meeting) return null;

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

  const formatSpeakerName = (speaker: string) => {
    if (!speaker) return 'Unknown Speaker';
    if (speaker === 'hero-bot' || speaker.toLowerCase().includes('hero')) return 'Hero AI';
    
    // Handle generic 'user' or 'system' labels
    if (speaker === 'user') return 'Participant';
    if (speaker === 'system') return 'System';
    
    // Extract name from identity format: "Name-uuid"
    const nameMatch = speaker.match(/^(.+?)-[a-f0-9]{8}$/i);
    if (nameMatch) {
      return nameMatch[1].replace(/_/g, ' ');
    }
    
    return speaker;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(5px)',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.4)',
          animation: 'slideUp 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '30px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1a1a1a',
              marginBottom: '8px'
            }}>
              Meeting Transcript
            </h2>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              <div style={{ marginBottom: '4px' }}>
                <strong>Room:</strong> {meeting.room_name}
              </div>
              <div style={{ marginBottom: '4px' }}>
                <strong>Started:</strong> {formatDateTime(meeting.started_at)}
              </div>
              {meeting.ended_at && (
                <div style={{ marginBottom: '4px' }}>
                  <strong>Ended:</strong> {formatDateTime(meeting.ended_at)}
                </div>
              )}
              {meeting.duration_minutes && (
                <div>
                  <strong>Duration:</strong> {meeting.duration_minutes} minutes
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              marginLeft: '20px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Summary Section */}
        {showSummary && (
          <div style={{
            padding: '20px 30px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f8fafc'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1a1a1a',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>📋</span>
                Meeting Summary
              </h3>
              <button
                onClick={() => setShowSummary(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  color: '#6b7280',
                  fontSize: '12px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Hide
              </button>
            </div>
            <div style={{
              fontSize: '14px',
              color: '#374151',
              lineHeight: '1.6',
              backgroundColor: 'white',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              {summary.split('\n').map((line, index) => {
                // Handle bullet points
                if (line.trim().startsWith('* ')) {
                  return (
                    <div key={index} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <span style={{ color: '#6b7280', marginRight: '8px', marginTop: '2px' }}>•</span>
                      <span>{line.trim().substring(2)}</span>
                    </div>
                  );
                }
                // Handle numbered lists
                if (line.trim().match(/^\d+\.\s/)) {
                  return (
                    <div key={index} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <span style={{ color: '#6b7280', marginRight: '8px', marginTop: '2px' }}>{line.trim().match(/^\d+/)?.[0]}.</span>
                      <span>{line.trim().replace(/^\d+\.\s/, '')}</span>
                    </div>
                  );
                }
                // Handle bold headers (e.g., **Meeting Overview**)
                if (line.trim().match(/^\*\*(.*?)\*\*:/)) {
                  const headerText = line.trim().match(/^\*\*(.*?)\*\*:/)?.[1];
                  return (
                    <h4 key={index} style={{ 
                      fontWeight: '600', 
                      color: '#1f2937', 
                      margin: index > 0 ? '16px 0 8px 0' : '0 0 8px 0',
                      fontSize: '16px'
                    }}>
                      {headerText}:
                    </h4>
                  );
                }
                // Handle regular lines
                return (
                  <p key={index} style={{ margin: index > 0 ? '8px 0 0 0' : '0' }}>
                    {line}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {/* Generate Summary Button */}
        {!showSummary && !isGeneratingSummary && (
          <div style={{
            padding: '20px 30px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f8fafc'
          }}>
            <button
              onClick={generateSummary}
              style={{
                padding: '12px 24px',
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
                gap: '8px'
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
              <span>📋</span>
              Generate Meeting Summary
            </button>
          </div>
        )}

        {/* Loading Summary */}
        {isGeneratingSummary && (
          <div style={{
            padding: '20px 30px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f8fafc',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '14px',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #e5e7eb',
                borderTop: '2px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Generating meeting summary...
            </div>
          </div>
        )}

        {/* Transcript Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '30px'
        }}>
          {transcripts.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#9ca3af'
            }}>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ margin: '0 auto 20px auto', display: 'block' }}
              >
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>No transcripts available</p>
              <p style={{ fontSize: '14px' }}>This meeting has no recorded conversations</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {transcripts.map((transcript, idx) => {
                const isHero = transcript.speaker === 'hero-bot' || transcript.speaker.toLowerCase().includes('hero');
                return (
                  <div
                    key={transcript.id || idx}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      animation: `fadeIn 0.3s ease-out ${idx * 0.05}s both`
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: isHero ? '#667eea' : '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '16px'
                    }}>
                      {isHero ? '🤖' : formatSpeakerName(transcript.speaker).charAt(0).toUpperCase()}
                    </div>

                    {/* Message */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '12px',
                        marginBottom: '6px'
                      }}>
                        <span style={{
                          fontSize: '15px',
                          fontWeight: '600',
                          color: '#1a1a1a'
                        }}>
                          {formatSpeakerName(transcript.speaker)}
                        </span>
                        <span style={{
                          fontSize: '12px',
                          color: '#9ca3af'
                        }}>
                          {new Date(transcript.timestamp).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div style={{
                        margin: 0,
                        fontSize: '15px',
                        color: '#374151',
                        lineHeight: '1.6'
                      }}>
                        {transcript.message.split('\n').map((line, index) => {
                          // Handle bullet points
                          if (line.trim().startsWith('* ')) {
                            return (
                              <div key={index} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}>
                                <span style={{ color: '#6b7280', marginRight: '8px', marginTop: '2px' }}>•</span>
                                <span>{line.trim().substring(2)}</span>
                              </div>
                            );
                          }
                          // Handle numbered lists
                          if (line.trim().match(/^\d+\.\s/)) {
                            return (
                              <div key={index} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}>
                                <span style={{ color: '#6b7280', marginRight: '8px', marginTop: '2px' }}>{line.trim().match(/^\d+/)?.[0]}.</span>
                                <span>{line.trim().replace(/^\d+\.\s/, '')}</span>
                              </div>
                            );
                          }
                          // Handle regular lines
                          return (
                            <p key={index} style={{ margin: index > 0 ? '8px 0 0 0' : '0' }}>
                              {line}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 30px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'white',
              backgroundColor: '#667eea',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
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
            Close
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateX(-10px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `
      }} />
    </div>
  );
};

export default TranscriptModal;

