'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleCreateMeeting = async () => {
    setIsCreating(true);
    try {
      // Generate a unique room name
      const roomName = `meeting-${Date.now()}`;
      
      const response = await fetch('/api/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomName }),
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '32px', color: 'white' }}>
          Hero Meet
        </h1>
        <p style={{ fontSize: '18px', marginBottom: '48px', color: '#9ca3af' }}>
          AI-powered meeting platform with intelligent assistant
        </p>
        
        <button
          onClick={handleCreateMeeting}
          disabled={isCreating}
          className="btn btn-primary"
          style={{
            width: '100%',
            fontSize: '18px',
            padding: '16px 32px',
            borderRadius: '12px'
          }}
        >
          {isCreating ? 'Creating Meeting...' : 'Start Meeting'}
        </button>
      </div>
    </div>
  );
}
