'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LandingPage() {
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleCreateMeeting = async () => {
    setIsCreating(true);
    try {
      // Check if org is already set
      const orgName = localStorage.getItem('hero_meeting_org');
      
      if (orgName) {
        // Org already set, go to dashboard
        router.push('/dashboard');
      } else {
        // Need to set org first
        router.push('/org-entry');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', color: 'white' }}>
      {/* Navigation */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{
          maxWidth: '1024px',
          margin: '0 auto',
          padding: '13px 19px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '26px',
              height: '26px',
              background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
              </svg>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Hero AI</span>
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '26px'
          }}>
            <a href="#how-it-works" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s', fontSize: '14px' }}>How it Works</a>
            <a href="#features" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s', fontSize: '14px' }}>Features</a>
            <a href="#pricing" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s', fontSize: '14px' }}>Pricing</a>
          </div>
          <button style={{
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'transparent',
            color: 'white',
            padding: '6px 13px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: '500',
            transition: 'background 0.3s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
            Start Building
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        position: 'relative',
        paddingTop: '102px',
        paddingBottom: '64px',
        paddingLeft: '19px',
        paddingRight: '19px',
        overflow: 'hidden'
      }}>
        {/* Abstract Background Elements */}
        <div style={{
          position: 'absolute',
          top: '64px',
          right: 0,
          width: '480px',
          height: '480px',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, rgba(236, 72, 153, 0.2) 50%, transparent 100%)',
          borderRadius: '50%',
          filter: 'blur(64px)'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(217, 70, 239, 0.1) 0%, rgba(168, 85, 247, 0.1) 50%, transparent 100%)',
          borderRadius: '50%',
          filter: 'blur(64px)'
        }}></div>

        <div style={{
          maxWidth: '1024px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '38px'
        }}>
          <div style={{ maxWidth: '717px', flex: '0 0 auto' }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(109, 40, 217, 0.4)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '9999px',
              padding: '6px 13px',
              marginBottom: '19px'
            }}>
              <svg width="13" height="13" fill="#c084fc" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              <p style={{ color: '#d8b4fe', fontSize: '11px', fontWeight: '500', margin: 0 }}>
                Your Intelligent Meeting Participant
              </p>
            </div>

            {/* Main Heading */}
            <h1 style={{
              fontSize: '77px',
              fontWeight: 'bold',
              lineHeight: '1.1',
              marginBottom: '26px',
              margin: 0
            }}>
              <span style={{
                background: 'linear-gradient(to right, #f9a8d4, #c084fc, #a855f7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Hero AI
              </span>
              <br />
              <span style={{ color: 'white' }}>Your Intelligent</span>
              <br />
              <span style={{ color: 'white' }}>Meeting</span>
              <br />
              <span style={{ color: 'white' }}>Participant</span>
            </h1>

            {/* Description */}
            <p style={{
              fontSize: '16px',
              color: '#d1d5db',
              marginBottom: '38px',
              maxWidth: '538px',
              lineHeight: '1.75'
            }}>
              Not just a note-taker. Hero AI actively listens, understands context, and contributes intelligently to your meetings—so you can focus on what matters most.
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '13px' }}>
              <button
                onClick={handleCreateMeeting}
                disabled={isCreating}
                style={{
                  background: 'linear-gradient(to right, #ec4899, #a855f7)',
                  color: 'white',
                  border: 'none',
                  padding: '19px 26px',
                  fontSize: '14px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s',
                  opacity: isCreating ? 0.7 : 1
                }}
                onMouseOver={(e) => {
                  if (!isCreating) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {isCreating ? 'Creating Meeting...' : 'Start Free Meeting'}
              </button>
              <button style={{
                border: '1px solid rgba(255, 255, 255, 0.3)',
                background: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                padding: '19px 26px',
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)'}>
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Watch Demo
              </button>
            </div>
          </div>

          {/* Illustration SVG */}
          <div style={{ flex: '1', display: 'flex', justifyContent: 'center', alignItems: 'center', maxWidth: '400px' }}>
            <Image 
              src="/meeting-illustration.svg" 
              alt="Meeting Illustration with video participants" 
              width={400}
              height={300}
              style={{ 
                width: '100%', 
                height: 'auto', 
                maxWidth: '400px', 
                opacity: 0.9,
                filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.3))'
              }} 
            />
          </div>
        </div>
      </section>
    </div>
  );
}
