'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, RemoteParticipant, RemoteTrack, Track } from 'livekit-client';
import ChatPanel, { ChatMessage } from './ChatPanel';

interface MeetingPageProps {
  roomName: string;
}

export default function MeetingPage({ roomName }: MeetingPageProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    initializeRoom();
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [roomName]); // eslint-disable-line react-hooks/exhaustive-deps

  const initializeRoom = async () => {
    try {
      setIsLoading(true);
      
      // Get join token from backend
      const response = await fetch('/api/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomName }),
      });

      if (!response.ok) {
        throw new Error('Failed to get join token');
      }

      const { token } = await response.json();

      // Create LiveKit room
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Set up event listeners
      newRoom.on(RoomEvent.Connected, () => {
        console.log('Connected to room');
        setIsConnected(true);
        setIsLoading(false);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from room');
        setIsConnected(false);
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log('Participant connected:', participant.identity);
        setParticipants(prev => [...prev, participant]);
        
        // Add welcome message for Hero bot
        if (participant.identity === 'hero-bot') {
          addMessage({
            id: Date.now().toString(),
            text: 'Hero AI assistant has joined the meeting! Say "Hey Hero" to ask questions.',
            isHero: true,
            timestamp: Date.now(),
          });
        }
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('Participant disconnected:', participant.identity);
        setParticipants(prev => prev.filter(p => p.identity !== participant.identity));
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: any, participant: RemoteParticipant) => {
        console.log('Track subscribed:', track.kind, participant.identity);
        
        if (track.kind === Track.Kind.Video) {
          const videoElement = track.attach();
          if (videoRef.current) {
            videoRef.current.appendChild(videoElement);
          }
        } else if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          if (audioRef.current) {
            audioRef.current.srcObject = audioElement.srcObject;
            audioRef.current.play();
          }
        }
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach();
      });

      // Connect to room
      await newRoom.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);
      setRoom(newRoom);

    } catch (error) {
      console.error('Error initializing room:', error);
      setError(error instanceof Error ? error.message : 'Failed to join meeting');
      setIsLoading(false);
    }
  };

  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };

  const handleSendMessage = async (message: string) => {
    if (!room) return;

    // Add user message to chat
    addMessage({
      id: Date.now().toString(),
      text: message,
      timestamp: Date.now(),
    });

    // Send message to backend for Hero bot processing
    try {
      await fetch('/api/hero-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          message,
          context: messages.slice(-5).map(m => m.text).join(' '), // Last 5 messages as context
        }),
      });
    } catch (error) {
      console.error('Error sending message to Hero bot:', error);
    }
  };

  const copyMeetingLink = async () => {
    const meetingLink = window.location.href;
    try {
      await navigator.clipboard.writeText(meetingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const toggleAudio = async () => {
    if (!room) return;
    
    try {
      const audioTrack = room.localParticipant.audioTrackPublications.values().next().value;
      if (audioTrack && audioTrack.track) {
        (audioTrack.track as any).setEnabled(!(audioTrack.track as any).isEnabled);
      }
    } catch (error) {
      console.error('Error toggling audio:', error);
    }
  };

  const toggleVideo = async () => {
    if (!room) return;
    
    try {
      const videoTrack = room.localParticipant.videoTrackPublications.values().next().value;
      if (videoTrack && videoTrack.track) {
        (videoTrack.track as any).setEnabled(!(videoTrack.track as any).isEnabled);
      }
    } catch (error) {
      console.error('Error toggling video:', error);
    }
  };

  const leaveMeeting = async () => {
    if (room) {
      await room.disconnect();
    }
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            border: '4px solid #374151', 
            borderTop: '4px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 24px auto'
          }}></div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'white', marginBottom: '8px' }}>
            Joining Meeting Room
          </h2>
          <p style={{ color: '#9ca3af' }}>Please wait while we connect you...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#dc2626',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px auto'
          }}>
            <span style={{ color: 'white', fontSize: '24px' }}>!</span>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>
            Connection Failed
          </h2>
          <p style={{ color: '#9ca3af', marginBottom: '24px' }}>{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="btn btn-primary"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-container">
      {/* Main Video Area */}
      <div className="video-area">
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          backgroundColor: '#1f2937',
          borderBottom: '1px solid #374151'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'white', fontSize: '18px', fontWeight: '600' }}>
              room: {roomName}
            </span>
            <span style={{ color: '#60a5fa', fontSize: '14px' }}>
              {participants.length + 1} participants
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={leaveMeeting} className="btn btn-secondary" style={{ fontSize: '14px' }}>
              Exit Interview
            </button>
            <button 
              onClick={copyMeetingLink}
              className="copy-link-btn"
            >
              {copied ? 'Copied!' : 'Copy Candidate Link'}
            </button>
          </div>
        </div>

        {/* Main Video Content */}
        <div className="waiting-message">
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              backgroundColor: '#374151',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p>Waiting for candidate to join...</p>
          </div>
        </div>

        {/* Video Preview */}
        <div className="video-preview" ref={videoRef}>
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            fontSize: '14px'
          }}>
            You
          </div>
        </div>

        {/* Controls */}
        <div className="controls">
          <button onClick={toggleAudio} className="control-btn">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          
          <button onClick={toggleVideo} className="control-btn">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          
          <button className="control-btn">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
          </button>
          
          <button className="control-btn">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0' }}>
              Follow-Up Suggestions
            </h3>
            <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
              Get Questions
            </button>
          </div>
          <div style={{
            backgroundColor: '#374151',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '14px',
            color: '#d1d5db'
          }}>
            Custom Instructions
            <br />
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
              e.g., Ask more technical questions...
            </span>
          </div>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                backgroundColor: '#22c55e',
                borderRadius: '50%'
              }}></div>
              <h3>Live Transcription</h3>
              <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }}>
                ON
              </button>
            </div>
            
            <div style={{
              backgroundColor: '#374151',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#4b5563',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0' }}>
                No transcript yet...
              </p>
              <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', margin: '4px 0 0 0' }}>
                Live transcription will start when there is audio
              </p>
            </div>

            {messages.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      backgroundColor: message.isHero ? '#1e40af' : '#374151',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      marginBottom: '8px',
                      fontSize: '14px'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <span style={{ fontWeight: '600', fontSize: '12px' }}>
                        {message.isHero ? 'Hero AI' : 'You'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                        {new Date(message.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <p style={{ margin: '0', color: 'white' }}>{message.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} autoPlay />
      
      {/* CSS Animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
