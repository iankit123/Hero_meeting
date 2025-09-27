'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const [roomName, setRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleCreateMeeting = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    setIsCreating(true);
    try {
      // Generate a unique room name if not provided
      const finalRoomName = roomName.trim() || `interview-${Date.now()}`;
      
      const response = await fetch('/api/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomName: finalRoomName }),
      });

      if (!response.ok) {
        throw new Error('Failed to create meeting');
      }

      const data = await response.json();
      router.push(`/meeting/${data.roomName}`);
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Failed to create meeting. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">Hero Meet</h1>
          <p className="text-xl text-gray-300 mb-2">Professional Interview Platform</p>
          <p className="text-gray-400 max-w-lg mx-auto">
            AI-powered video interviews with real-time transcription, intelligent insights, and automated assistance
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-white mb-2">Start Your Interview Session</h2>
            <p className="text-gray-300">Create a professional interview room with AI assistance</p>
          </div>

          <form onSubmit={handleCreateMeeting} className="space-y-6">
            <div>
              <label htmlFor="roomName" className="block text-sm font-medium text-gray-300 mb-3">
                Interview Session Name
              </label>
              <input
                type="text"
                id="roomName"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g., Software Engineer Interview - John Doe"
                className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 text-lg"
              />
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg shadow-lg transition-all duration-200 hover:shadow-xl"
            >
              {isCreating ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Creating Interview Room...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Create Interview Room</span>
                </div>
              )}
            </button>
          </form>

          {/* Features */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">AI Transcription</h3>
              <p className="text-gray-400 text-sm">Real-time speech-to-text with speaker identification</p>
            </div>

            <div className="text-center p-4 bg-white/5 rounded-xl">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Smart Assistant</h3>
              <p className="text-gray-400 text-sm">Ask "Hey Hero" for instant AI-powered insights</p>
            </div>

            <div className="text-center p-4 bg-white/5 rounded-xl">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Live Notes</h3>
              <p className="text-gray-400 text-sm">Automated interview notes and key insights</p>
            </div>
          </div>

          {/* Tech Stack */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400 mb-4">Powered by cutting-edge AI technology</p>
            <div className="flex justify-center space-x-8 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>LiveKit</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Deepgram</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span>Gemini AI</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span>ElevenLabs</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
