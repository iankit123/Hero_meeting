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
        backdropFilter: 'blur(15px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '33px',
              height: '33px',
              background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
              </svg>
            </div>
            <span style={{ fontSize: '20px', fontWeight: 'bold' }}>Hero AI</span>
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '33px'
          }}>
            <a href="#how-it-works" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s', fontSize: '18px' }}>How it Works</a>
            <a href="#features" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s', fontSize: '18px' }}>Features</a>
            <a href="#pricing" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s', fontSize: '18px' }}>Pricing</a>
          </div>
          <button style={{
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'transparent',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
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
        paddingTop: '128px',
        paddingBottom: '80px',
        paddingLeft: '24px',
        paddingRight: '24px',
        overflow: 'hidden'
      }}>
        {/* Abstract Background Elements */}
        <div style={{
          position: 'absolute',
          top: '80px',
          right: 0,
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, rgba(236, 72, 153, 0.2) 50%, transparent 100%)',
          borderRadius: '50%',
          filter: 'blur(80px)'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(217, 70, 239, 0.1) 0%, rgba(168, 85, 247, 0.1) 50%, transparent 100%)',
          borderRadius: '50%',
          filter: 'blur(80px)'
        }}></div>

        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '48px'
        }}>
          <div style={{ maxWidth: '896px', flex: '0 0 auto' }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(109, 40, 217, 0.4)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '9999px',
              padding: '8px 16px',
              marginBottom: '24px'
            }}>
              <svg width="16" height="16" fill="#c084fc" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              <p style={{ color: '#d8b4fe', fontSize: '14px', fontWeight: '500', margin: 0 }}>
                Your Intelligent Meeting Participant
              </p>
            </div>

            {/* Main Heading */}
            <h1 style={{
              fontSize: '96px',
              fontWeight: 'bold',
              lineHeight: '1.1',
              marginBottom: '33px',
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
              fontSize: '20px',
              color: '#d1d5db',
              marginBottom: '48px',
              maxWidth: '673px',
              lineHeight: '1.75'
            }}>
              Not just a note-taker. Hero AI actively listens, understands context, and contributes intelligently to your meetings—so you can focus on what matters most.
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <button
                onClick={handleCreateMeeting}
                disabled={isCreating}
                style={{
                  background: 'linear-gradient(to right, #ec4899, #a855f7)',
                  color: 'white',
                  border: 'none',
                  padding: '24px 33px',
                  fontSize: '18px',
                  fontWeight: '600',
                  borderRadius: '8px',
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
                padding: '24px 33px',
                fontSize: '18px',
                fontWeight: '600',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)'}>
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Watch Demo
              </button>
            </div>
          </div>

          {/* Illustration SVG */}
          <div style={{ flex: '1', display: 'flex', justifyContent: 'center', alignItems: 'center', maxWidth: '500px' }}>
            <Image 
              src="/meeting-illustration.svg" 
              alt="Meeting Illustration with video participants" 
              width={500}
              height={375}
              priority
              style={{ 
                width: '100%', 
                height: 'auto', 
                maxWidth: '500px', 
                opacity: 0.9,
                filter: 'drop-shadow(0 25px 50px rgba(0, 0, 0, 0.3))'
              }} 
            />
          </div>
        </div>
      </section>
    </div>
  );
}
