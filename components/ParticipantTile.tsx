import React, { useEffect, useRef, useState } from 'react';
import { Participant, Track } from 'livekit-client';
import { HeroOrb } from './HeroOrb';

interface ParticipantTileProps {
  participant: Participant;
  isLocal?: boolean;
  audioLevel?: number;
}

export const ParticipantTile: React.FC<ParticipantTileProps> = ({
  participant,
  isLocal = false,
  audioLevel = 0
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  
  // Check if this is Hero bot
  const isHero = participant.identity.includes('hero') || participant.name?.toLowerCase() === 'hero';

  // Format participant name
  const formatName = (name?: string, identity?: string) => {
    if (!name) return 'Participant';
    if (name.toLowerCase() === 'hero') return 'Hero AI';
    // Remove UUID suffix if present (e.g., "John_Doe-a1b2c3d4" -> "John Doe")
    const cleanName = name.replace(/-[a-f0-9]{8}$/i, '').replace(/_/g, ' ');
    return cleanName;
  };

  // Speaking detection based on audio level
  useEffect(() => {
    if (audioLevel > 0.1) {
      setIsSpeaking(true);
      const timeout = setTimeout(() => setIsSpeaking(false), 500);
      return () => clearTimeout(timeout);
    } else {
      setIsSpeaking(false);
    }
  }, [audioLevel]);

  // Subscribe to video and audio tracks
  useEffect(() => {
    console.log(`🔧 [TILE] Setting up tracks for ${participant.identity} (isLocal: ${isLocal})`);
    console.log(`🔧 [TILE] videoRef.current exists:`, !!videoRef.current);
    
    // Capture the current videoRef value to avoid stale closure
    const currentVideoRef = videoRef.current;
    
    const handleTrackSubscribed = (track: any) => {
      console.log(`📥 [TILE] Track subscribed - kind: ${track.kind}, participant: ${participant.identity}`);
      if (track.kind === Track.Kind.Video && currentVideoRef) {
        track.attach(currentVideoRef);
        setHasVideo(true);
        console.log(`✅ [TILE] Video track attached for ${participant.identity}`);
        // Force play
        currentVideoRef.play().catch(err => {
          console.warn('⚠️ [TILE] Video autoplay blocked:', err);
        });
      } else if (track.kind === Track.Kind.Audio && audioRef.current && !isLocal) {
        track.attach(audioRef.current);
        console.log(`✅ [TILE] Audio track attached for ${participant.identity}`);
      }
    };

    const handleTrackUnsubscribed = (track: any) => {
      console.log(`📤 [TILE] Track unsubscribed - kind: ${track.kind}`);
      if (track.kind === Track.Kind.Video) {
        track.detach();
        setHasVideo(false);
      } else if (track.kind === Track.Kind.Audio && !isLocal) {
        track.detach();
      }
    };

    // For local participant, check video track publications and attach
    if (isLocal) {
      const videoPublications = Array.from(participant.videoTrackPublications.values());
      console.log(`📹 [TILE] Local participant has ${videoPublications.length} video publication(s)`);
      
      if (videoPublications.length > 0) {
        const videoPublication = videoPublications[0];
        console.log(`📹 [TILE] Video publication details:`, {
          kind: videoPublication.kind,
          trackName: videoPublication.trackName,
          hasTrack: !!videoPublication.track,
          isSubscribed: videoPublication.isSubscribed
        });
        
        if (videoPublication.track && videoRef.current) {
          try {
            console.log(`🔗 [TILE] Attaching local video track...`);
            // Detach from any previous element first
            videoPublication.track.detach();
            // Attach to this tile's video element
            videoPublication.track.attach(videoRef.current);
            setHasVideo(true);
            console.log(`✅ [TILE] Local video attached to participant tile successfully!`);
            
            // Force video element to play
            videoRef.current.play()
              .then(() => console.log('✅ [TILE] Local video playing'))
              .catch(err => {
                console.warn('⚠️ [TILE] Local video autoplay blocked:', err);
              });
          } catch (error) {
            console.error('❌ [TILE] Error attaching local video:', error);
          }
        } else {
          console.warn(`⚠️ [TILE] Cannot attach: videoRef=${!!videoRef.current}, track=${!!videoPublication.track}`);
        }
      } else {
        console.warn(`⚠️ [TILE] No video publications found for local participant yet, will retry...`);
        
        // Retry after a short delay (video might not be published yet)
        const retryTimeout = setTimeout(() => {
          const videoPublicationsRetry = Array.from(participant.videoTrackPublications.values());
          console.log(`🔄 [TILE] Retry: Found ${videoPublicationsRetry.length} video publication(s)`);
          
          if (videoPublicationsRetry.length > 0 && videoPublicationsRetry[0].track && videoRef.current) {
            try {
              console.log(`🔗 [TILE] Attaching local video track on retry...`);
              videoPublicationsRetry[0].track.detach();
              videoPublicationsRetry[0].track.attach(videoRef.current);
              setHasVideo(true);
              console.log(`✅ [TILE] Local video attached on retry!`);
              videoRef.current.play()
                .then(() => console.log('✅ [TILE] Local video playing'))
                .catch(err => console.warn('⚠️ [TILE] Autoplay blocked:', err));
            } catch (error) {
              console.error('❌ [TILE] Error attaching video on retry:', error);
            }
          }
        }, 500); // Wait 500ms and retry
        
        return () => clearTimeout(retryTimeout);
      }
      
      // Also listen for when tracks are published (might happen after mount)
      const handleLocalTrackPublished = (publication: any) => {
        console.log(`📢 [TILE] Local track published event - kind: ${publication.kind}`);
        if (publication.kind === 'video' && publication.track && videoRef.current) {
          console.log(`🔗 [TILE] Attaching local video from published event...`);
          publication.track.detach();
          publication.track.attach(videoRef.current);
          setHasVideo(true);
          console.log(`✅ [TILE] Local video attached after publication event`);
          videoRef.current.play().catch((err: any) => console.warn('Autoplay blocked:', err));
        }
      };
      
      participant.on('trackPublished', handleLocalTrackPublished);
      
      return () => {
        participant.off('trackPublished', handleLocalTrackPublished);
      };
    }

    // Attach existing tracks
    const trackPublications = Array.from(participant.trackPublications.values());
    trackPublications.forEach((publication: any) => {
      if (publication.track) {
        handleTrackSubscribed(publication.track);
      }
    });

    // Listen for new tracks (mainly for remote participants)
    if (!isLocal) {
      participant.on('trackSubscribed', handleTrackSubscribed);
      participant.on('trackUnsubscribed', handleTrackUnsubscribed);
    }

    return () => {
      if (!isLocal) {
        participant.off('trackSubscribed', handleTrackSubscribed);
        participant.off('trackUnsubscribed', handleTrackUnsubscribed);
      }
      
      // Cleanup tracks
      const cleanupPublications = Array.from(participant.trackPublications.values());
      cleanupPublications.forEach((publication: any) => {
        if (publication.track && currentVideoRef) {
          publication.track.detach(currentVideoRef);
        }
      });
    };
  }, [participant, isLocal]);

  // If this is Hero, show the animated orb
  if (isHero) {
    return (
      <div className="participant-tile hero-tile">
        <HeroOrb isSpeaking={isSpeaking} />
        <div className="participant-name hero-name">
          <span className="name-badge">🤖 Hero AI</span>
        </div>
        <audio ref={audioRef} autoPlay />
        
        <style jsx>{`
          .participant-tile {
            position: relative;
            width: 100%;
            height: 100%;
            border-radius: 12px;
            overflow: hidden;
            background: #1e293b;
            border: 2px solid ${isSpeaking ? 'rgba(139, 92, 246, 0.6)' : 'rgba(100, 116, 139, 0.3)'};
            transition: border-color 0.3s ease;
          }

          .hero-tile {
            border: 2px solid rgba(139, 92, 246, 0.5);
            box-shadow: ${isSpeaking 
              ? '0 0 20px rgba(139, 92, 246, 0.4)' 
              : '0 0 10px rgba(139, 92, 246, 0.2)'};
          }

          .participant-name {
            position: absolute;
            bottom: 12px;
            left: 12px;
            right: 12px;
            z-index: 10;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .hero-name {
            justify-content: center;
          }

          .name-badge {
            background: rgba(139, 92, 246, 0.9);
            color: white;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            backdrop-filter: blur(10px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          }
        `}</style>
      </div>
    );
  }

  // Regular participant with video
  return (
    <div className="participant-tile">
      {/* Always render video element so it can be attached */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="participant-video"
        style={{ display: hasVideo ? 'block' : 'none' }}
      />
      
      {/* Show placeholder only when no video */}
      {!hasVideo && (
        <div className="participant-placeholder">
          <div className="avatar">
            {formatName(participant.name, participant.identity).charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      
      <audio ref={audioRef} autoPlay />
      
      <div className="participant-name">
        <span className="name-badge">
          {isLocal && '📹 '}
          {formatName(participant.name, participant.identity)}
          {isLocal && ' (You)'}
        </span>
        {isSpeaking && <span className="speaking-indicator">🎤</span>}
      </div>

      <style jsx>{`
        .participant-tile {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 12px;
          overflow: hidden;
          background: #1e293b;
          border: 2px solid ${isSpeaking ? 'rgba(34, 197, 94, 0.6)' : 'rgba(100, 116, 139, 0.3)'};
          transition: border-color 0.3s ease;
          box-shadow: ${isSpeaking 
            ? '0 0 20px rgba(34, 197, 94, 0.3)' 
            : '0 2px 8px rgba(0, 0, 0, 0.2)'};
        }

        .participant-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .participant-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
        }

        .avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: bold;
          color: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .participant-name {
          position: absolute;
          bottom: 12px;
          left: 12px;
          right: 12px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .name-badge {
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          backdrop-filter: blur(10px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .speaking-indicator {
          animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
        }

        @media (max-width: 768px) {
          .avatar {
            width: 60px;
            height: 60px;
            font-size: 24px;
          }
          
          .name-badge {
            font-size: 12px;
            padding: 4px 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default ParticipantTile;

