'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, RemoteParticipant, RemoteTrack, Track, createLocalVideoTrack, createLocalAudioTrack, LocalTrack } from 'livekit-client';
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
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalTrack | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
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
      
      // Enable user's camera and microphone
      await enableLocalMedia(newRoom);
      
      // Start transcription
      startTranscription(newRoom);

    } catch (error) {
      console.error('Error initializing room:', error);
      setError(error instanceof Error ? error.message : 'Failed to join meeting');
      setIsLoading(false);
    }
  };

  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };
  
  const addTranscript = (message: ChatMessage) => {
    setTranscript(prev => [...prev, message]);
    // Also add to general messages for context
    addMessage({ ...message, isTranscript: true });
  };
  
  const enableLocalMedia = async (room: Room) => {
    try {
      // Create and publish video track
      const videoTrack = await createLocalVideoTrack();
      await room.localParticipant.publishTrack(videoTrack);
      setLocalVideoTrack(videoTrack);
      
      // Attach video to local preview
      if (localVideoRef.current) {
        videoTrack.attach(localVideoRef.current);
      }
      
      // Create and publish audio track
      const audioTrack = await createLocalAudioTrack();
      await room.localParticipant.publishTrack(audioTrack);
      setLocalAudioTrack(audioTrack);
      
    } catch (error) {
      console.error('Error enabling local media:', error);
    }
  };
  
  const startTranscription = async (room: Room) => {
    try {
      // Check if browser supports speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.warn('Speech recognition not supported in this browser');
        addTranscript({
          id: Date.now().toString(),
          text: 'Speech recognition not supported in this browser. Try using Chrome or Edge.',
          speaker: 'system',
          timestamp: Date.now(),
          isTranscript: true
        });
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let isListening = false;

      recognition.onstart = () => {
        console.log('🎤 [SPEECH] Recognition started - listening for voice input');
        isListening = true;
        addTranscript({
          id: Date.now().toString(),
          text: '🎤 Listening for speech... Say "Hey Hero" to activate the AI assistant.',
          speaker: 'system',
          timestamp: Date.now(),
          isTranscript: true
        });
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Show final transcript
        if (finalTranscript.trim()) {
          console.log('🎤 [SPEECH] Raw transcript received:', finalTranscript.trim());
          
          addTranscript({
            id: Date.now().toString(),
            text: finalTranscript.trim(),
            speaker: 'user',
            timestamp: Date.now(),
            isTranscript: true
          });

          // Check for Hero trigger phrases (case insensitive) - check both current and recent context
          const recentContext = transcript.slice(-3).map(t => t.text).join(' ').toLowerCase();
          const currentAndRecent = (recentContext + ' ' + finalTranscript).toLowerCase();
          
          console.log('🔍 [TRIGGER] Checking for Hero trigger in:', finalTranscript);
          console.log('🔍 [TRIGGER] Recent context:', recentContext);
          
          if (finalTranscript.toLowerCase().match(/(hey|hi|hello)\s+hero/) || 
              currentAndRecent.match(/(hey|hi|hello)\s+hero/) ||
              finalTranscript.toLowerCase().includes('hero') ||
              (finalTranscript.toLowerCase().includes('hero') && recentContext.includes('what'))) {
            console.log('✅ [TRIGGER] Hero trigger detected! Sending to backend...');
            console.log('📝 [TRIGGER] Full message:', finalTranscript);
            console.log('📝 [TRIGGER] Context:', recentContext);
            
            // Use the full context for better understanding
            const fullContext = currentAndRecent.includes('hero') ? currentAndRecent : finalTranscript;
            handleHeroTrigger(fullContext);
          } else {
            console.log('❌ [TRIGGER] No Hero trigger found in transcript');
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('❌ [SPEECH] Recognition error:', event.error);
        if (event.error === 'not-allowed') {
          addTranscript({
            id: Date.now().toString(),
            text: '❌ Microphone access denied. Please allow microphone access to use voice commands.',
            speaker: 'system',
            timestamp: Date.now(),
            isTranscript: true
          });
        } else if (event.error === 'aborted') {
          console.log('⚠️ [SPEECH] Recognition aborted, will restart via onend handler');
        } else if (event.error === 'network') {
          console.warn('🌐 [SPEECH] Network error in speech recognition - connection issues');
        } else if (event.error === 'no-speech') {
          console.log('🔇 [SPEECH] No speech detected - timeout reached');
        }
      };

      recognition.onend = () => {
        console.log('🔴 [SPEECH] Recognition ended - preparing to restart');
        isListening = false;
        // Only restart if room is connected and not manually stopped
        if (room && room.state === 'connected') {
          setTimeout(() => {
            try {
              if (!isListening) {
                console.log('🔄 [SPEECH] Restarting speech recognition...');
                recognition.start();
              }
            } catch (error) {
              console.warn('⚠️ [SPEECH] Recognition restart failed:', error instanceof Error ? error.message : 'Unknown error');
            }
          }, 1000); // Increased timeout to 1000ms for stability
        }
      };

      // Start recognition
      recognition.start();
      
    } catch (error) {
      console.error('Error starting transcription:', error);
      addTranscript({
        id: Date.now().toString(),
        text: '❌ Failed to start speech recognition. Please refresh the page and try again.',
        speaker: 'system',
        timestamp: Date.now(),
        isTranscript: true
      });
    }
  };
  
  const handleHeroTrigger = async (transcript: string) => {
    try {
      const response = await fetch('/api/hero-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          message: transcript,
          context: messages.slice(-5).map(m => m.text).join(' ') + ' ' + transcript
        }),
      });
      
      const data = await response.json();
      console.log('\n📥 [FRONTEND] === HERO RESPONSE RECEIVED ===');
      console.log('📥 [FRONTEND] Full API response:', data);
      
      if (data.success && data.response) {
        console.log('✅ [FRONTEND] Hero response successful!');
        
        // Strip markdown formatting from response
        const cleanResponse = data.response.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        console.log('🧼 [FRONTEND] Cleaned response text:', cleanResponse);
        
        addMessage({
          id: Date.now().toString(),
          text: cleanResponse,
          timestamp: Date.now(),
          isHero: true
        });
        
        // Play TTS audio if available
        if (data.audioBuffer) {
          console.log('🎵 [FRONTEND] === PLAYING TTS AUDIO ===');
          console.log('🎵 [FRONTEND] Audio buffer size:', data.audioBuffer?.length || 0, 'characters (base64)');
          console.log('🎵 [FRONTEND] Audio duration:', data.duration, 'seconds');
          
          try {
            const audioContext = new AudioContext();
            console.log('🎵 [FRONTEND] Creating audio context...');
            
            const audioData = Uint8Array.from(atob(data.audioBuffer), c => c.charCodeAt(0));
            console.log('🎵 [FRONTEND] Decoded audio data size:', audioData.length, 'bytes');
            
            const audioBuffer = await audioContext.decodeAudioData(audioData.buffer);
            console.log('🎵 [FRONTEND] Audio buffer created successfully');
            
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();
            
            console.log('✅ [FRONTEND] Audio playback started!');
          } catch (audioError) {
            console.warn('❌ [FRONTEND] Error playing TTS audio:', audioError);
          }
        } else {
          console.log('⚠️ [FRONTEND] No audio buffer provided in response');
        }
      } else if (data.success && data.message) {
        console.log('💬 [FRONTEND] Debug message from API:', data.message);
        // Show debug message in transcript
        addTranscript({
          id: Date.now().toString(),
          text: `🤖 Hero debug: ${data.message}`,
          speaker: 'system',
          timestamp: Date.now(),
          isTranscript: true
        });
      } else {
        console.log('❌ [FRONTEND] Unexpected response format:', data);
      }
      
      console.log('🏁 [FRONTEND] === HERO PIPELINE COMPLETE ===\n');
    } catch (error) {
      console.error('Error handling Hero trigger:', error);
    }
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
      const response = await fetch('/api/hero-join', {
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

      const data = await response.json();
      console.log('Hero chat response:', data);
      
      if (data.success && data.response) {
        // Strip markdown formatting from response
        const cleanResponse = data.response.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        
        // Add Hero AI response to chat
        addMessage({
          id: Date.now().toString(),
          text: cleanResponse,
          timestamp: Date.now(),
          isHero: true
        });

        // Play TTS audio if available
        if (data.audioBuffer) {
          try {
            const audioContext = new AudioContext();
            const audioData = Uint8Array.from(atob(data.audioBuffer), c => c.charCodeAt(0));
            const audioBuffer = await audioContext.decodeAudioData(audioData.buffer);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();
          } catch (audioError) {
            console.warn('Error playing TTS audio:', audioError);
          }
        }
      } else if (data.success && data.message) {
        // Show debug message for chat
        addMessage({
          id: Date.now().toString(),
          text: `Debug: ${data.message}`,
          timestamp: Date.now(),
          isHero: true
        });
      }
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
      await room.localParticipant.setMicrophoneEnabled(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    } catch (error) {
      console.error('Error toggling audio:', error);
    }
  };

  const toggleVideo = async () => {
    if (!room) return;
    
    try {
      await room.localParticipant.setCameraEnabled(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
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
              Leave Meeting
            </button>
            <button 
              onClick={copyMeetingLink}
              className="copy-link-btn"
            >
              {copied ? 'Copied!' : 'Copy Meeting Link'}
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
            <p>Waiting for others to join...</p>
          </div>
        </div>

        {/* Video Preview - User's own camera */}
        <div className="video-preview">
          <video 
            ref={localVideoRef}
            autoPlay 
            muted 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '8px',
              backgroundColor: '#374151'
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            You
          </div>
        </div>
        
        {/* Remote participants video area */}
        <div ref={videoRef} style={{
          position: 'absolute',
          top: '80px',
          left: '20px',
          right: '20px',
          bottom: '200px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Remote participant videos will be attached here */}
        </div>

        {/* Controls */}
        <div className="controls">
          <button 
            onClick={toggleAudio} 
            className={`control-btn ${!isAudioEnabled ? 'muted' : ''}`}
            style={{
              backgroundColor: !isAudioEnabled ? '#dc2626' : '#374151'
            }}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isAudioEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              )}
            </svg>
          </button>
          
          <button 
            onClick={toggleVideo} 
            className={`control-btn ${!isVideoEnabled ? 'muted' : ''}`}
            style={{
              backgroundColor: !isVideoEnabled ? '#dc2626' : '#374151'
            }}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isVideoEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              )}
            </svg>
          </button>
          
          <button className="control-btn">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
          </button>
          
          <button onClick={leaveMeeting} className="control-btn" style={{ backgroundColor: '#dc2626' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        {/* Meeting Attendees */}
        <div className="sidebar-section" style={{ borderBottom: '1px solid #374151', paddingBottom: '16px', marginBottom: '16px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Meeting Attendees ({participants.length + 1})
          </h3>
          
          {/* Current User */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px',
            backgroundColor: '#374151',
            borderRadius: '8px',
            marginBottom: '8px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#22c55e',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: '600',
              color: 'white'
            }}>
              Y
            </div>
            <div>
              <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>
                You (Host)
              </div>
              <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                {isVideoEnabled ? '📹' : '📹🚫'} {isAudioEnabled ? '🎤' : '🎤🚫'}
              </div>
            </div>
          </div>
          
          {/* Remote Participants */}
          {participants.map((participant, index) => (
            <div key={participant.identity} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px',
              backgroundColor: '#374151',
              borderRadius: '8px',
              marginBottom: '8px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: participant.identity === 'hero-bot' ? '#2563eb' : '#f59e0b',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '600',
                color: 'white'
              }}>
                {participant.identity === 'hero-bot' ? '🤖' : participant.identity.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>
                  {participant.identity === 'hero-bot' ? 'Hero AI Assistant' : `Participant ${index + 1}`}
                </div>
                <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                  {participant.identity === 'hero-bot' ? '🤖 AI' : 'Online'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Live Transcription */}
        <div className="sidebar-section" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#22c55e',
              borderRadius: '50%'
            }}></div>
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0' }}>Live Transcription</h3>
          </div>
          
          <div style={{
            backgroundColor: '#374151',
            borderRadius: '8px',
            padding: '12px',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {transcript.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
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
                  Start speaking to see live transcription
                </p>
              </div>
            ) : (
              transcript.slice(-10).map((msg) => (
                <div key={msg.id} style={{
                  padding: '8px',
                  marginBottom: '8px',
                  backgroundColor: '#4b5563',
                  borderRadius: '6px',
                  fontSize: '13px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '600', color: '#60a5fa' }}>
                      Speaker {msg.speaker || 'Unknown'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ margin: '0', color: '#e5e7eb' }}>{msg.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Chat with Hero */}
        <div className="sidebar-section">
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Chat with Hero AI
          </h3>
          
          <div style={{
            backgroundColor: '#374151',
            borderRadius: '8px',
            padding: '12px',
            maxHeight: '250px',
            overflowY: 'auto',
            marginBottom: '12px'
          }}>
            {messages.filter(m => !m.isTranscript).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#2563eb',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto'
                }}>
                  🤖
                </div>
                <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0' }}>
                  Say "Hey Hero" or type a message
                </p>
                <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', margin: '4px 0 0 0' }}>
                  Hero understands the meeting context
                </p>
              </div>
            ) : (
              messages.filter(m => !m.isTranscript).map((message) => (
                <div key={message.id} style={{
                  backgroundColor: message.isHero ? '#1e40af' : '#4b5563',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '8px',
                  fontSize: '13px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <span style={{ fontWeight: '600', fontSize: '12px', color: message.isHero ? '#60a5fa' : '#e5e7eb' }}>
                      {message.isHero ? '🤖 Hero AI' : 'You'}
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
              ))
            )}
          </div>
          
          {/* Chat Input */}
          <form onSubmit={(e) => { e.preventDefault(); const input = e.target as any; if (input.chat.value.trim()) { handleSendMessage(input.chat.value.trim()); input.chat.value = ''; } }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                name="chat"
                type="text" 
                placeholder="Type a message for Hero..."
                style={{
                  flex: '1',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #4b5563',
                  backgroundColor: '#374151',
                  color: 'white',
                  fontSize: '14px'
                }}
              />
              <button 
                type="submit"
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Send
              </button>
            </div>
          </form>
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
