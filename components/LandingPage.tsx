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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1A2B3C 0%, #2A1A3C 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Effects */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '10%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(0, 192, 255, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(40px)'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '10%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(138, 43, 226, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(50px)'
      }}></div>

      <div style={{ 
        textAlign: 'center', 
        maxWidth: '600px', 
        width: '100%',
        position: 'relative',
        zIndex: 2
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0, 192, 255, 0.1)',
          border: '1px solid rgba(0, 192, 255, 0.3)',
          borderRadius: '20px',
          padding: '8px 16px',
          marginBottom: '32px',
          fontSize: '14px',
          fontWeight: '500',
          color: 'white'
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            background: '#00C0FF',
            borderRadius: '50%'
          }}></div>
          Powered by Advanced AI Technology
        </div>

        {/* Main Heading */}
        <h1 style={{ 
          fontSize: '64px', 
          fontWeight: '800', 
          marginBottom: '16px',
          lineHeight: '1.1',
          letterSpacing: '-0.02em'
        }}>
          <span style={{ 
            background: 'linear-gradient(135deg, #00C0FF 0%, #8A2BE2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Hero AI
          </span>
        </h1>
        
        <h2 style={{
          fontSize: '48px',
          fontWeight: '700',
          color: 'white',
          marginBottom: '24px',
          lineHeight: '1.2'
        }}>
          Your Intelligent<br />
          Meeting Participant
        </h2>

        {/* Description */}
        <p style={{ 
          fontSize: '18px', 
          marginBottom: '48px', 
          color: '#CCCCCC',
          lineHeight: '1.6',
          maxWidth: '500px',
          margin: '0 auto 48px auto'
        }}>
          Not just a note-taker. Hero AI actively listens, understands context, and contributes intelligently to your meetings—so you can focus on what matters most.
        </p>
        
        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          marginBottom: '48px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleCreateMeeting}
            disabled={isCreating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #00C0FF 0%, #8A2BE2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 32px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              opacity: isCreating ? 0.7 : 1,
              transition: 'all 0.3s ease',
              boxShadow: '0 8px 32px rgba(0, 192, 255, 0.3)'
            }}
            onMouseOver={(e) => {
              if (!isCreating) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 192, 255, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 192, 255, 0.3)';
            }}
          >
            {isCreating ? 'Creating Meeting...' : 'Start Free Meeting'}
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 7l5 5-5 5M6 12h12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(0, 0, 0, 0.2)',
              color: 'white',
              border: '1px solid #00C0FF',
              borderRadius: '12px',
              padding: '16px 32px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(0, 192, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" fill="currentColor"/>
            </svg>
            Watch Demo
          </button>
        </div>

        {/* Trust Indicators */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '32px',
          flexWrap: 'wrap',
          fontSize: '14px',
          color: '#CCCCCC'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '16px',
              height: '16px',
              background: '#00C0FF',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="8" height="8" fill="white" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
              </svg>
            </div>
            No credit card required
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '16px',
              height: '16px',
              background: '#00C0FF',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="8" height="8" fill="white" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
              </svg>
            </div>
            5-minute setup
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '16px',
              height: '16px',
              background: '#00C0FF',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="8" height="8" fill="white" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
              </svg>
            </div>
            Free forever
          </div>
        </div>
      </div>
    </div>
  );
}
