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

      {/* Features Section */}
      <section id="features" style={{
        padding: '120px 24px',
        backgroundColor: '#0a0a0a',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
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
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <p style={{ color: '#d8b4fe', fontSize: '14px', fontWeight: '500', margin: 0 }}>
              Powerful Features
            </p>
          </div>

          <h2 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '24px',
            background: 'linear-gradient(to right, #f9a8d4, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Everything you need for intelligent meetings
          </h2>

          <p style={{
            fontSize: '20px',
            color: '#d1d5db',
            marginBottom: '80px',
            maxWidth: '600px',
            margin: '0 auto 80px auto',
            lineHeight: '1.6'
          }}>
            Transform your meetings with AI-powered features that enhance productivity and collaboration.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '32px',
            marginTop: '80px'
          }}>
            {/* Feature 1 */}
            <div style={{
              background: 'rgba(17, 24, 39, 0.8)',
              border: '1px solid rgba(55, 65, 81, 0.5)',
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'left',
              transition: 'all 0.3s',
              backdropFilter: 'blur(10px)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(55, 65, 81, 0.5)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px'
              }}>
                <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
                </svg>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: 'white' }}>
                Real-time Transcription
              </h3>
              <p style={{ color: '#d1d5db', lineHeight: '1.6', margin: 0 }}>
                Advanced speech-to-text technology captures every word with speaker identification and instant processing.
              </p>
            </div>

            {/* Feature 2 */}
            <div style={{
              background: 'rgba(17, 24, 39, 0.8)',
              border: '1px solid rgba(55, 65, 81, 0.5)',
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'left',
              transition: 'all 0.3s',
              backdropFilter: 'blur(10px)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(55, 65, 81, 0.5)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px'
              }}>
                <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: 'white' }}>
                AI-Powered Insights
              </h3>
              <p style={{ color: '#d1d5db', lineHeight: '1.6', margin: 0 }}>
                Get intelligent summaries, action items, and contextual answers from your meeting history using advanced AI.
              </p>
            </div>

            {/* Feature 3 */}
            <div style={{
              background: 'rgba(17, 24, 39, 0.8)',
              border: '1px solid rgba(55, 65, 81, 0.5)',
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'left',
              transition: 'all 0.3s',
              backdropFilter: 'blur(10px)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(55, 65, 81, 0.5)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px'
              }}>
                <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: 'white' }}>
                Multi-Organization Support
              </h3>
              <p style={{ color: '#d1d5db', lineHeight: '1.6', margin: 0 }}>
                Organize meetings by company or team with isolated workspaces and secure data separation.
              </p>
            </div>

            {/* Feature 4 */}
            <div style={{
              background: 'rgba(17, 24, 39, 0.8)',
              border: '1px solid rgba(55, 65, 81, 0.5)',
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'left',
              transition: 'all 0.3s',
              backdropFilter: 'blur(10px)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(55, 65, 81, 0.5)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px'
              }}>
                <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: 'white' }}>
                Meeting History & Search
              </h3>
              <p style={{ color: '#d1d5db', lineHeight: '1.6', margin: 0 }}>
                Access past meetings, search through transcripts, and export data with powerful vector search capabilities.
              </p>
            </div>

            {/* Feature 5 */}
            <div style={{
              background: 'rgba(17, 24, 39, 0.8)',
              border: '1px solid rgba(55, 65, 81, 0.5)',
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'left',
              transition: 'all 0.3s',
              backdropFilter: 'blur(10px)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(55, 65, 81, 0.5)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px'
              }}>
                <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: 'white' }}>
                Voice-Activated AI
              </h3>
              <p style={{ color: '#d1d5db', lineHeight: '1.6', margin: 0 }}>
                Simply say "Hey Hero" to activate AI assistance and get instant answers during your meetings.
              </p>
            </div>

            {/* Feature 6 */}
            <div style={{
              background: 'rgba(17, 24, 39, 0.8)',
              border: '1px solid rgba(55, 65, 81, 0.5)',
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'left',
              transition: 'all 0.3s',
              backdropFilter: 'blur(10px)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(55, 65, 81, 0.5)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px'
              }}>
                <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: 'white' }}>
                Enterprise Security
              </h3>
              <p style={{ color: '#d1d5db', lineHeight: '1.6', margin: 0 }}>
                Bank-grade security with encrypted data transmission and secure cloud storage for all your meeting data.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" style={{
        padding: '120px 24px',
        backgroundColor: '#000000',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
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
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <p style={{ color: '#d8b4fe', fontSize: '14px', fontWeight: '500', margin: 0 }}>
              How It Works
            </p>
          </div>

          <h2 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '24px',
            background: 'linear-gradient(to right, #f9a8d4, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Get started in minutes
          </h2>

          <p style={{
            fontSize: '20px',
            color: '#d1d5db',
            marginBottom: '80px',
            maxWidth: '600px',
            margin: '0 auto 80px auto',
            lineHeight: '1.6'
          }}>
            Simple setup process that gets you up and running with intelligent meetings in no time.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '48px',
            marginTop: '80px'
          }}>
            {/* Step 1 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px auto',
                fontSize: '32px',
                fontWeight: 'bold',
                color: 'white'
              }}>
                1
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: 'white' }}>
                Create Organization
              </h3>
              <p style={{ color: '#d1d5db', lineHeight: '1.6', margin: 0 }}>
                Set up your organization workspace to organize meetings and manage team access.
              </p>
            </div>

            {/* Step 2 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px auto',
                fontSize: '32px',
                fontWeight: 'bold',
                color: 'white'
              }}>
                2
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: 'white' }}>
                Start Meeting
              </h3>
              <p style={{ color: '#d1d5db', lineHeight: '1.6', margin: 0 }}>
                Launch a new meeting and Hero AI will automatically join as an intelligent participant.
              </p>
            </div>

            {/* Step 3 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px auto',
                fontSize: '32px',
                fontWeight: 'bold',
                color: 'white'
              }}>
                3
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: 'white' }}>
                Get AI Insights
              </h3>
              <p style={{ color: '#d1d5db', lineHeight: '1.6', margin: 0 }}>
                Ask "Hey Hero" for instant answers and access meeting summaries and transcripts anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={{
        padding: '120px 24px',
        backgroundColor: '#0a0a0a',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
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
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <p style={{ color: '#d8b4fe', fontSize: '14px', fontWeight: '500', margin: 0 }}>
              Simple Pricing
            </p>
          </div>

          <h2 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '24px',
            background: 'linear-gradient(to right, #f9a8d4, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Choose your plan
          </h2>

          <p style={{
            fontSize: '20px',
            color: '#d1d5db',
            marginBottom: '80px',
            maxWidth: '600px',
            margin: '0 auto 80px auto',
            lineHeight: '1.6'
          }}>
            Start free and scale as you grow. No hidden fees, no surprises.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '32px',
            marginTop: '80px'
          }}>
            {/* Free Plan */}
            <div style={{
              background: 'rgba(17, 24, 39, 0.8)',
              border: '1px solid rgba(55, 65, 81, 0.5)',
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'center',
              transition: 'all 0.3s',
              backdropFilter: 'blur(10px)'
            }}>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px', color: 'white' }}>
                Free
              </h3>
              <div style={{ marginBottom: '24px' }}>
                <span style={{ fontSize: '48px', fontWeight: 'bold', color: 'white' }}>$0</span>
                <span style={{ color: '#d1d5db', fontSize: '18px' }}>/month</span>
              </div>
              <p style={{ color: '#d1d5db', marginBottom: '32px', lineHeight: '1.6' }}>
                Perfect for individuals and small teams getting started with AI-powered meetings.
              </p>
              <ul style={{ textAlign: 'left', marginBottom: '32px', padding: 0, listStyle: 'none' }}>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Up to 5 meetings per month
                </li>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Real-time transcription
                </li>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Basic AI responses
                </li>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Meeting history (30 days)
                </li>
              </ul>
              <button style={{
                width: '100%',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                background: 'transparent',
                color: 'white',
                padding: '16px 24px',
                fontSize: '16px',
                fontWeight: '600',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                Get Started Free
              </button>
            </div>

            {/* Pro Plan */}
            <div style={{
              background: 'rgba(17, 24, 39, 0.8)',
              border: '2px solid rgba(168, 85, 247, 0.5)',
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'center',
              transition: 'all 0.3s',
              backdropFilter: 'blur(10px)',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                color: 'white',
                padding: '6px 16px',
                borderRadius: '9999px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Most Popular
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px', color: 'white' }}>
                Pro
              </h3>
              <div style={{ marginBottom: '24px' }}>
                <span style={{ fontSize: '48px', fontWeight: 'bold', color: 'white' }}>$29</span>
                <span style={{ color: '#d1d5db', fontSize: '18px' }}>/month</span>
              </div>
              <p style={{ color: '#d1d5db', marginBottom: '32px', lineHeight: '1.6' }}>
                Advanced features for growing teams and organizations.
              </p>
              <ul style={{ textAlign: 'left', marginBottom: '32px', padding: 0, listStyle: 'none' }}>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Unlimited meetings
                </li>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Advanced AI insights
                </li>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Vector search & RAG
                </li>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Unlimited meeting history
                </li>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Export transcripts
                </li>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Priority support
                </li>
              </ul>
              <button style={{
                width: '100%',
                background: 'linear-gradient(to right, #ec4899, #a855f7)',
                color: 'white',
                border: 'none',
                padding: '16px 24px',
                fontSize: '16px',
                fontWeight: '600',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                Start Pro Trial
              </button>
            </div>

            {/* Enterprise Plan */}
            <div style={{
              background: 'rgba(17, 24, 39, 0.8)',
              border: '1px solid rgba(55, 65, 81, 0.5)',
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'center',
              transition: 'all 0.3s',
              backdropFilter: 'blur(10px)'
            }}>
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px', color: 'white' }}>
                Enterprise
              </h3>
              <div style={{ marginBottom: '24px' }}>
                <span style={{ fontSize: '48px', fontWeight: 'bold', color: 'white' }}>Custom</span>
              </div>
              <p style={{ color: '#d1d5db', marginBottom: '32px', lineHeight: '1.6' }}>
                Tailored solutions for large organizations with advanced security and compliance needs.
              </p>
              <ul style={{ textAlign: 'left', marginBottom: '32px', padding: 0, listStyle: 'none' }}>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Everything in Pro
                </li>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Custom integrations
                </li>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  SSO & SAML
                </li>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Dedicated support
                </li>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  On-premise deployment
                </li>
                <li style={{ color: '#d1d5db', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Custom SLA
                </li>
              </ul>
              <button style={{
                width: '100%',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                background: 'transparent',
                color: 'white',
                padding: '16px 24px',
                fontSize: '16px',
                fontWeight: '600',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: '120px 24px',
        backgroundColor: '#000000',
        position: 'relative',
        textAlign: 'center'
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          <h2 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '24px',
            background: 'linear-gradient(to right, #f9a8d4, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Ready to transform your meetings?
          </h2>

          <p style={{
            fontSize: '20px',
            color: '#d1d5db',
            marginBottom: '48px',
            lineHeight: '1.6'
          }}>
            Join thousands of teams already using Hero AI to make their meetings more productive and intelligent.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
            <button
              onClick={handleCreateMeeting}
              disabled={isCreating}
              style={{
                background: 'linear-gradient(to right, #ec4899, #a855f7)',
                color: 'white',
                border: 'none',
                padding: '24px 40px',
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
              padding: '24px 40px',
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
      </section>

      {/* Footer */}
      <footer style={{
        padding: '80px 24px 40px 24px',
        backgroundColor: '#0a0a0a',
        borderTop: '1px solid rgba(55, 65, 81, 0.3)'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '48px',
            marginBottom: '48px'
          }}>
            {/* Company Info */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
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
              <p style={{ color: '#d1d5db', lineHeight: '1.6', marginBottom: '24px' }}>
                Transform your meetings with AI-powered intelligence. Make every conversation count.
              </p>
              <div style={{ display: 'flex', gap: '16px' }}>
                <a href="#" style={{ color: '#d1d5db', transition: 'color 0.3s' }}
                   onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                   onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                  </svg>
                </a>
                <a href="#" style={{ color: '#d1d5db', transition: 'color 0.3s' }}
                   onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                   onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
                  </svg>
                </a>
                <a href="#" style={{ color: '#d1d5db', transition: 'color 0.3s' }}
                   onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                   onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px', color: 'white' }}>
                Product
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li style={{ marginBottom: '12px' }}>
                  <a href="#features" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s' }}
                     onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                     onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                    Features
                  </a>
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <a href="#pricing" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s' }}
                     onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                     onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                    Pricing
                  </a>
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <a href="#how-it-works" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s' }}
                     onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                     onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                    How it Works
                  </a>
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s' }}
                     onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                     onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                    API Documentation
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px', color: 'white' }}>
                Company
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li style={{ marginBottom: '12px' }}>
                  <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s' }}
                     onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                     onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                    About Us
                  </a>
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s' }}
                     onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                     onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                    Blog
                  </a>
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s' }}
                     onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                     onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                    Careers
                  </a>
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s' }}
                     onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                     onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px', color: 'white' }}>
                Support
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li style={{ marginBottom: '12px' }}>
                  <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s' }}
                     onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                     onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                    Help Center
                  </a>
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s' }}
                     onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                     onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                    Privacy Policy
                  </a>
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s' }}
                     onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                     onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                    Terms of Service
                  </a>
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <a href="#" style={{ color: '#d1d5db', textDecoration: 'none', transition: 'color 0.3s' }}
                     onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                     onMouseOut={(e) => e.currentTarget.style.color = '#d1d5db'}>
                    Security
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div style={{
            paddingTop: '40px',
            borderTop: '1px solid rgba(55, 65, 81, 0.3)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px'
          }}>
            <p style={{ color: '#9ca3af', margin: 0 }}>
              © 2024 Hero AI. All rights reserved.
            </p>
            <div style={{ display: 'flex', gap: '24px' }}>
              <a href="#" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}
                 onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                 onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}>
                Privacy
              </a>
              <a href="#" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}
                 onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                 onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}>
                Terms
              </a>
              <a href="#" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '14px', transition: 'color 0.3s' }}
                 onMouseOver={(e) => e.currentTarget.style.color = '#c084fc'}
                 onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}>
                Cookies
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
