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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-white mb-2">Joining Interview Room</h2>
          <p className="text-gray-400">Please wait while we connect you...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Connection Failed</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Main Interview Area */}
      <div className="flex-1 flex flex-col">
        {/* Professional Header */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Interview Session</h1>
                <p className="text-sm text-gray-400">Room: {roomName}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-300">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
              
              <button
                onClick={leaveMeeting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Leave</span>
              </button>
            </div>
          </div>
        </div>

        {/* Video Grid - Professional Layout */}
        <div className="flex-1 p-6">
          <div className="h-full bg-gray-800 rounded-xl overflow-hidden">
            <div ref={videoRef} className="h-full w-full grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {/* Video elements will be dynamically added here */}
              <div className="bg-gray-700 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-sm">Waiting for participants...</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Controls */}
        <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
          <div className="flex items-center justify-center space-x-6">
            <button
              onClick={toggleAudio}
              className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors group"
            >
              <svg className="w-6 h-6 text-gray-300 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            
            <button
              onClick={toggleVideo}
              className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors group"
            >
              <svg className="w-6 h-6 text-gray-300 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            
            <div className="px-4 py-2 bg-blue-600 rounded-lg">
              <span className="text-white text-sm font-medium">AI Assistant Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Professional Chat Panel */}
      <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>Interview Notes</span>
          </h3>
          <p className="text-sm text-gray-400 mt-1">AI-powered transcription & insights</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">Conversation will appear here</p>
              <p className="text-gray-500 text-xs mt-1">Say &quot;Hey Hero&quot; for AI assistance</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`p-3 rounded-lg ${
                  message.isHero
                    ? 'bg-blue-900/30 border-l-4 border-blue-400'
                    : message.isTranscript
                    ? 'bg-gray-700 border-l-4 border-gray-500'
                    : 'bg-gray-700 border-l-4 border-gray-400'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    {message.isHero ? (
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">AI</span>
                      </div>
                    ) : message.isTranscript ? (
                      <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {message.speaker || '?'}
                        </span>
                      </div>
                    ) : (
                      <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">U</span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-300">
                      {message.isHero ? 'AI Assistant' : message.isTranscript ? `Speaker ${message.speaker || 'Unknown'}` : 'You'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(message.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-200">{message.text}</p>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-700">
          <form onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.querySelector('input') as HTMLInputElement;
            if (input.value.trim()) {
              handleSendMessage(input.value.trim());
              input.value = '';
            }
          }} className="flex space-x-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} autoPlay />
    </div>
  );
}
