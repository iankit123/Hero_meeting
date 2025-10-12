import React, { useState } from 'react';
import { useRouter } from 'next/router';

const MeetingsTab: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleStartNewMeeting = async () => {
    setIsCreating(true);
    
    try {
      // Generate a unique room name
      const roomName = `meeting-${Date.now()}`;
      
      console.log(`🚀 [MEETINGS] Starting new meeting: ${roomName}`);
      
      // Navigate to the meeting room
      router.push(`/meeting/${roomName}`);
    } catch (error) {
      console.error('Error creating meeting:', error);
      setIsCreating(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: '#1a1a1a',
          marginBottom: '8px'
        }}>
          Meetings
        </h1>
        <p style={{ fontSize: '16px', color: '#6b7280' }}>
          Start a new AI-powered meeting with Hero assistant
        </p>
      </div>

      {/* Main Content */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '24px',
        padding: '60px 40px',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(102, 126, 234, 0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Pattern */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.1,
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(255,255,255,0.3) 0%, transparent 50%)
          `
        }}></div>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Icon */}
          <div style={{
            width: '100px',
            height: '100px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 30px auto',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255,255,255,0.3)'
          }}>
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>

          <h2 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: 'white',
            marginBottom: '16px'
          }}>
            Ready to Start Your Meeting?
          </h2>

          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.9)',
            marginBottom: '40px',
            maxWidth: '500px',
            margin: '0 auto 40px auto',
            lineHeight: '1.6'
          }}>
            Click the button below to create a new meeting room with AI-powered transcription and Hero assistant
          </p>

          {/* Start Meeting Button */}
          <button
            onClick={handleStartNewMeeting}
            disabled={isCreating}
            style={{
              padding: '18px 40px',
              fontSize: '18px',
              fontWeight: '600',
              color: '#667eea',
              backgroundColor: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              opacity: isCreating ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!isCreating) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 30px rgba(0,0,0,0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
            }}
          >
            {isCreating ? (
              <>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '3px solid #667eea',
                  borderTop: '3px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Creating Meeting...
              </>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                Start New Meeting
              </>
            )}
          </button>

          {/* Features */}
          <div style={{
            marginTop: '60px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '30px',
            maxWidth: '800px',
            margin: '60px auto 0 auto'
          }}>
            {[
              { icon: '🎙️', title: 'Real-time Transcription', desc: 'Automatic speech-to-text' },
              { icon: '🤖', title: 'Hero AI Assistant', desc: 'Answer questions instantly' },
              { icon: '💾', title: 'Auto-Save Transcripts', desc: 'All conversations saved' }
            ].map((feature, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: '16px',
                  padding: '24px',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}
              >
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>{feature.icon}</div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '6px'
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.8)',
                  margin: 0
                }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div style={{
        marginTop: '40px',
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '30px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#1a1a1a',
          marginBottom: '20px'
        }}>
          💡 Quick Tips
        </h3>
        <ul style={{
          margin: 0,
          padding: '0 0 0 20px',
          color: '#6b7280',
          lineHeight: '1.8'
        }}>
          <li>Say <strong>"Hey Hero"</strong> or <strong>"Hi Hero"</strong> to activate the AI assistant</li>
          <li>All conversations are automatically transcribed and saved</li>
          <li>You can view past meeting transcripts in the "Past Meetings" tab</li>
          <li>Share the meeting link with others to invite them</li>
        </ul>
      </div>

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
};

export default MeetingsTab;

