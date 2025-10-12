'use client';

import React, { useState, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  text: string;
  speaker?: string;
  timestamp: number;
  isHero?: boolean;
  isTranscript?: boolean;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
}

export default function ChatPanel({ messages, onSendMessage }: ChatPanelProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      onSendMessage(inputMessage.trim());
      setInputMessage('');
    }
  };

  const formatSpeakerName = (speaker: string | undefined) => {
    if (!speaker) return 'Unknown Speaker';
    if (speaker === 'system') return 'System';
    if (speaker === 'hero-bot' || speaker.toLowerCase().includes('hero')) return 'Hero';
    
    // Extract name from identity format: "Name-uuid" or "Name_With_Spaces-uuid"
    // Examples: "John_Doe-a1b2c3d4" -> "John Doe", "user-a1b2c3d4" -> "user"
    const nameMatch = speaker.match(/^(.+?)-[a-f0-9]{8}$/i);
    if (nameMatch) {
      // Replace underscores with spaces and capitalize
      const name = nameMatch[1].replace(/_/g, ' ');
      return name;
    }
    
    // If no UUID pattern, check for old format "user-uuid"
    if (speaker.startsWith('user-')) {
      return 'Unknown Participant';
    }
    
    // Return as-is if no pattern matches
    return speaker;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`bg-white border-l border-gray-200 flex flex-col transition-all duration-300 h-full ${
      isExpanded ? 'w-80' : 'w-12'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
        >
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-0' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          {isExpanded && <span className="font-semibold">Chat & Transcript</span>}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-sm">Start speaking to see the transcript</p>
                <p className="text-xs text-gray-400 mt-1">Say &quot;Hey Hero&quot; to ask questions</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-lg ${
                    message.isHero
                      ? 'bg-indigo-50 border-l-4 border-indigo-400'
                      : message.isTranscript
                      ? 'bg-gray-50 border-l-4 border-gray-300'
                      : 'bg-blue-50 border-l-4 border-blue-400'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      {message.isHero ? (
                        <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">H</span>
                        </div>
                      ) : message.isTranscript ? (
                        <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {formatSpeakerName(message.speaker).charAt(0)}
                          </span>
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">U</span>
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        {message.isHero ? 'Hero' : message.isTranscript ? formatSpeakerName(message.speaker) : 'You'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800">{message.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
