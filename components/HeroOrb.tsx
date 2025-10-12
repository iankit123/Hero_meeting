import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

interface HeroOrbProps {
  isSpeaking: boolean;
  className?: string;
}

export const HeroOrb: React.FC<HeroOrbProps> = ({ isSpeaking, className = '' }) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const lottieRef = useRef<any>(null);

  useEffect(() => {
    // Load Lottie animation
    fetch('/siri-animation.json')
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(err => console.error('Failed to load Hero animation:', err));
  }, []);

  useEffect(() => {
    // When speaking, increase animation speed
    if (lottieRef.current) {
      lottieRef.current.setSpeed(isSpeaking ? 1.5 : 0.8);
    }
  }, [isSpeaking]);

  return (
    <div className={`hero-orb-container ${className}`}>
      <div className="hero-orb-wrapper">
        {/* Lottie Animation */}
        {animationData && (
          <div className={`hero-lottie ${isSpeaking ? 'speaking' : 'listening'}`}>
            <Lottie
              lottieRef={lottieRef}
              animationData={animationData}
              loop={true}
              autoplay={true}
              style={{
                width: '100%',
                height: '100%',
                maxWidth: '400px',
                maxHeight: '400px',
              }}
            />
          </div>
        )}
        
        {/* Fallback if animation doesn't load */}
        {!animationData && (
          <div 
            className={`hero-orb ${isSpeaking ? 'speaking' : 'listening'}`}
            style={{
              animationDuration: isSpeaking ? '2s' : '4s'
            }}
          >
            <div className="hero-wave wave-1" />
            <div className="hero-wave wave-2" />
            <div className="hero-wave wave-3" />
            <div className="hero-glow" />
          </div>
        )}
      </div>

      <style jsx>{`
        .hero-orb-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border-radius: 12px;
          position: relative;
          overflow: hidden;
        }

        .hero-orb-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          z-index: 1;
        }

        .hero-lottie {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .hero-lottie.speaking {
          transform: scale(1.1);
          filter: brightness(1.2);
        }

        .hero-lottie.listening {
          transform: scale(1);
          filter: brightness(0.9);
        }

        /* Fallback orb styles */
        .hero-orb {
          position: relative;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(139, 92, 246, 0.8), rgba(59, 130, 246, 0.6));
          box-shadow: 
            0 0 40px rgba(139, 92, 246, 0.6),
            0 0 80px rgba(59, 130, 246, 0.4),
            inset 0 0 40px rgba(255, 255, 255, 0.1);
          animation: orb-pulse 4s ease-in-out infinite;
          transition: all 0.3s ease;
        }

        .hero-orb.speaking {
          box-shadow: 
            0 0 60px rgba(139, 92, 246, 0.9),
            0 0 120px rgba(59, 130, 246, 0.6),
            inset 0 0 60px rgba(255, 255, 255, 0.2);
          transform: scale(1.05);
        }

        .hero-wave {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100%;
          height: 50%;
          transform: translate(-50%, -50%);
          background: linear-gradient(
            to bottom,
            rgba(139, 92, 246, 0.4) 0%,
            rgba(59, 130, 246, 0.6) 50%,
            rgba(34, 211, 238, 0.4) 100%
          );
          clip-path: path('M 0 50 Q 25 40, 50 50 T 100 50 L 100 100 L 0 100 Z');
          animation: wave-flow 3s ease-in-out infinite;
          mix-blend-mode: screen;
        }

        .wave-1 {
          opacity: 0.6;
          animation-delay: 0s;
        }

        .wave-2 {
          opacity: 0.5;
          animation-delay: 0.3s;
          transform: translate(-50%, -50%) rotate(120deg);
        }

        .wave-3 {
          opacity: 0.4;
          animation-delay: 0.6s;
          transform: translate(-50%, -50%) rotate(240deg);
        }

        .hero-glow {
          position: absolute;
          top: -20%;
          left: -20%;
          width: 140%;
          height: 140%;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(139, 92, 246, 0.3) 0%,
            rgba(59, 130, 246, 0.2) 30%,
            transparent 70%
          );
          animation: glow-pulse 3s ease-in-out infinite;
          z-index: -1;
        }

        @keyframes orb-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }

        @keyframes wave-flow {
          0%, 100% {
            clip-path: path('M 0 50 Q 25 40, 50 50 T 100 50 L 100 100 L 0 100 Z');
          }
          25% {
            clip-path: path('M 0 50 Q 25 35, 50 50 T 100 50 L 100 100 L 0 100 Z');
          }
          50% {
            clip-path: path('M 0 50 Q 25 60, 50 50 T 100 50 L 100 100 L 0 100 Z');
          }
          75% {
            clip-path: path('M 0 50 Q 25 45, 50 50 T 100 50 L 100 100 L 0 100 Z');
          }
        }

        @keyframes glow-pulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
          }
        }

        /* Responsive sizing */
        @media (max-width: 768px) {
          .hero-orb {
            width: 150px;
            height: 150px;
          }
        }

        @media (max-width: 480px) {
          .hero-orb {
            width: 120px;
            height: 120px;
          }
        }
      `}</style>
    </div>
  );
};

export default HeroOrb;

