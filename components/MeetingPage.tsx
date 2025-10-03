'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, RemoteParticipant, RemoteTrack, Track, TrackPublication, createLocalVideoTrack, createLocalAudioTrack, LocalTrack } from 'livekit-client';
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
  const [copied, setCopied] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalTrack | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    initializeRoom();
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [roomName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize audio context on first user interaction
  useEffect(() => {
    const initializeAudio = async () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        console.log('🎵 [AUDIO] Audio context initialized');
      }
    };

    const handleUserInteraction = () => {
      initializeAudio();
      
      // Also retry video playback on user interaction (for autoplay blocking)
      if (localVideoRef.current && localVideoTrack) {
        console.log('🎥 [INTERACTION] User interaction detected - retrying video playback');
        localVideoRef.current.play().then(() => {
          console.log('✅ [VIDEO] Video playback resumed after user interaction');
        }).catch(e => {
          console.warn('❌ [VIDEO] Still unable to play video after interaction:', e);
        });
      }
      
      // Remove event listeners after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    // Add event listeners for user interaction
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [localVideoTrack]);

  const initializeRoom = async () => {
    try {
      setIsLoading(true);
      console.log('🚀 [INIT] Starting room initialization...');
      
      // STEP 1: Ensure browser permissions FIRST
      console.log('📱 [PERMISSIONS] Requesting media permissions...');
      try {
        const permissions = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        console.log('✅ [PERMISSIONS] Media permissions granted');
        // Stop the stream immediately - we just needed permission
        permissions.getTracks().forEach(track => track.stop());
      } catch (permError) {
        console.error('❌ [PERMISSIONS] Media permissions denied:', permError);
        throw new Error('Camera and microphone permissions are required');
      }
      
      // STEP 2: Get join token from backend
      console.log('🎫 [TOKEN] Getting LiveKit token...');
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
      console.log('✅ [TOKEN] LiveKit token received');

      // STEP 3: Create LiveKit room with aggressive settings
      console.log('📺 [ROOM] Creating LiveKit room...');
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        // Add more robust connection settings
        reconnectPolicy: {
          nextRetryDelayInMs: () => 5000,
        },
        // Force simulcast for better compatibility
        publishDefaults: {
          simulcast: false, // Disable simulcast for simpler negotiation
        }
      });

      // STEP 4: Set up comprehensive event listeners with detailed logging
      setupRoomEventListeners(newRoom);

      // STEP 5: PRE-CREATE tracks before connection
      console.log('🎥 [TRACKS] Pre-creating media tracks...');
      let localVideo: LocalTrack, localAudio: LocalTrack;
      
      try {
        localVideo = await createLocalVideoTrack({
          // Conservative video settings for compatibility
          resolution: {
            width: 640,
            height: 480
          },
          frameRate: 15 // Lower framerate for better reliability
        });
        
        localAudio = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        });
        
        setLocalVideoTrack(localVideo);
        setLocalAudioTrack(localAudio);
        
        // Attach video to preview immediately with comprehensive debugging
        if (localVideoRef.current) {
          console.log('🎥 [ATTACH] Starting video attachment process...');
          console.log('🎥 [ATTACH] Video track:', localVideo);
          console.log('🎥 [ATTACH] Video element:', localVideoRef.current);
          
          try {
            // Attach the track to the video element
            localVideo.attach(localVideoRef.current);
            console.log('✅ [TRACKS] Video track attached to preview');
            
            // Configure video element properties
            const videoEl = localVideoRef.current;
            videoEl.autoplay = true;
            videoEl.muted = true;
            videoEl.playsInline = true;
            videoEl.style.objectFit = 'cover';
            
            // Force play (some browsers need this)
            videoEl.play().catch(e => {
              console.warn('🎥 [VIDEO] Autoplay blocked, user interaction required:', e);
            });
            
            // Verify stream attachment immediately
            setTimeout(() => {
              console.log('🎥 [VERIFY] Checking stream attachment...');
              console.log('🎥 [VERIFY] Video element srcObject:', videoEl.srcObject);
              console.log('🎥 [VERIFY] Video tracks:', (videoEl.srcObject as MediaStream)?.getTracks() || 'No tracks');
              
              if (!videoEl.srcObject) {
                console.log('🔧 [FIX] Attempting to manually attach stream...');
                try {
                  // LiveKit tracks need to be re-attached to get stream
                  localVideo.attach(videoEl);
                  console.log('✅ [FIX] Track re-attached to get stream');
                  videoEl.play().catch(e => console.warn('Manual play failed:', e));
                } catch (manualError) {
                  console.error('❌ [ERROR] Manual track re-attachment failed:', manualError);
                }
              } else {
                console.log('✅ [VERIFY] Stream is properly attached');
              }
            }, 100);
            
            console.log('🎥 [ATTACH] Video element configured successfully');
            console.log('🎥 [ATTACH] Video srcObject:', localVideoRef.current.srcObject);
            
          } catch (attachError) {
            console.error('❌ [TRACKS] Failed to attach video to preview:', attachError);
            
            // Multiple retry attempts with increasing delays
            [100, 500, 1000].forEach((delay, index) => {
              setTimeout(() => {
                if (localVideoRef.current) {
                  try {
                    localVideo.attach(localVideoRef.current);
                    console.log(`✅ [TRACKS] Video track attached to preview (retry ${index + 1})`);
                    localVideoRef.current.play().catch(e => console.warn('Retry play failed:', e));
                  } catch (retryError) {
                    console.error(`❌ [TRACKS] Retry ${index + 1} failed:`, retryError);
                  }
                }
              }, delay);
            });
          }
        } else {
          console.error('❌ [TRACKS] Video element ref is null - cannot attach track');
        }
        
        console.log('✅ [TRACKS] Media tracks pre-created successfully');
      } catch (trackError) {
        console.error('❌ [TRACKS] Failed to create media tracks:', trackError);
        throw new Error('Failed to access camera or microphone');
      }

      // STEP 6: Connect to room
      console.log('🔌 [CONNECT] Connecting to LiveKit room...');
      await newRoom.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);
      console.log('✅ [CONNECT] Connected to LiveKit room');
      setRoom(newRoom);
      setIsConnected(true);
      
      // STEP 7: Publish tracks immediately after connection
      console.log('📤 [PUBLISH] Publishing pre-created tracks...');
      try {
        await newRoom.localParticipant.publishTrack(localVideo);
        console.log('✅ [PUBLISH] Video track published');
        
        await newRoom.localParticipant.publishTrack(localAudio);
        console.log('✅ [PUBLISH] Audio track published');
        
        // Update UI state
        setIsVideoEnabled(true);
        setIsAudioEnabled(true);
      } catch (publishError) {
        console.error('❌ [PUBLISH] Failed to publish tracks:', publishError);
      }
      
      // STEP 8: Start background services
      console.log('🎙️ [SERVICES] Starting transcription service...');
      startTranscription(newRoom);
      
      // STEP 9: Start participant sync
      console.log('🔄 [SYNC] Starting participant sync...');
      const cleanupSync = syncParticipantsPeriodically(newRoom);
      
      // Store cleanup function for later
      (newRoom as any).cleanupSync = cleanupSync;
      
      // STEP 10: Schedule initial test run after connection stabilizes
      setTimeout(() => {
        runBidirectionalVisibilityTest(newRoom);
      }, 3000);
      
      // Schedule periodic tests every 10 seconds
      const testInterval = setInterval(() => {
        if (newRoom.state === 'connected') {
          runBidirectionalVisibilityTest(newRoom);
        } else {
          clearInterval(testInterval);
        }
      }, 30000); // Reduced frequency: every 30 seconds instead of 10
      
      // Store test cleanup function
      (newRoom as any).cleanupTests = () => clearInterval(testInterval);
      
      console.log('✅ [INIT] Room initialization completed successfully');
      setIsLoading(false);

    } catch (error) {
      console.error('❌ [INIT] Room initialization failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to join meeting');
      setIsLoading(false);
    }
  };

  const setupRoomEventListeners = (newRoom: Room) => {
    console.log('🎧 [EVENTS] Setting up room event listeners...');
    
    newRoom.on(RoomEvent.Connected, () => {
      console.log('✅ [CONNECT] Connected to room:', newRoom.name);
      console.log('👀 [CONNECT] Local participant:', newRoom.localParticipant.identity);
      console.log('📺 [CONNECT] Room details:', newRoom.name);
      console.log('📊 [CONNECT] Initial participant count:', newRoom.numParticipants);
      
      // Update participants list immediately after connection
      const remoteParticipants = Array.from(newRoom.remoteParticipants.values());
      setParticipants(remoteParticipants);
      console.log('📊 [CONNECT] Initial remote participants:', remoteParticipants.length);
    });

    newRoom.on(RoomEvent.Disconnected, (reason) => {
      console.log('❌ [DISCONNECT] Disconnected from room, reason:', reason);
      setIsConnected(false);
      setParticipants([]);
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      
      // Cleanup periodic sync and tests
      if ((newRoom as any).cleanupSync) {
        (newRoom as any).cleanupSync();
      }
      if ((newRoom as any).cleanupTests) {
        (newRoom as any).cleanupTests();
      }
    });

    newRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log(`➡️ [PARTICIPANT] Connected: ${participant.identity}`);
      console.log(`📊 [PARTICIPANT] Total participants: ${newRoom.numParticipants}`);
      
      setParticipants(prev => {
        const updated = [...prev, participant];
        console.log(`📊 [PARTICIPANT] Updated participants array: ${updated.length}`);
        return updated;
      });
      
      // Ensure our tracks are re-published for the new participant
      enhanceTrackAvailability(newRoom);
      
      // Add welcome message for Hero bot
      if (participant.identity === 'hero-bot') {
        addMessage({
          id: Date.now().toString(),
          text: 'Hero AI assistant has joined the meeting! Say &quot;Hey Hero&quot; to ask questions.',
          isHero: true,
          timestamp: Date.now(),
        });
      }
    });

    newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log(`⬅️ [PARTICIPANT] Disconnected: ${participant.identity}`);
      setParticipants(prev => {
        const updated = prev.filter(p => p.identity !== participant.identity);
        console.log(`📊 [PARTICIPANT] Updated participants array: ${updated.length}`);
        return updated;
      });
    });

    newRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: any, participant: RemoteParticipant) => {
      console.log(`⬇️ [TRACK] Subscribed to ${track.kind} from ${participant.identity}`);
      
      // TEST LOGGING: Log bidirectional connectivity status
      const localTracks = Array.from(newRoom.localParticipant.trackPublications.values());
      const remoteTracks = Array.from(participant.trackPublications.values());
      console.log(`🧪 [TEST] BIDIRECTIONAL CHECK:`);
      console.log(`🧪 [TEST] Local participant published tracks: ${localTracks.length}:`, localTracks.map(t => t.kind));
      console.log(`🧪 [TEST] Remote participant ${participant.identity} tracks: ${remoteTracks.length}:`, remoteTracks.map(t => t.kind));
      
      // Log track details for debugging
      console.log(`📊 [TRACK] Track subscription details:`, {
        trackKind: track.kind,
        trackSource: track.source,
        trackMuted: track.isMuted,
        participantIdentity: participant.identity
      });
      
      if (track.kind === Track.Kind.Video) {
        console.log(`📥 [VIDEO-TRACK] Processing video track subscription from ${participant.identity}`);
        
        // Create video element manually instead of using track.attach()
        const videoElement = document.createElement('video');
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        videoElement.setAttribute('autoplay', 'true');
        videoElement.setAttribute('muted', 'true');
        videoElement.setAttribute('playsinline', 'true');
        
        // Attach track to our custom element
        track.attach(videoElement);
        
        // Add test identifier to video element
        videoElement.setAttribute('data-participant', participant.identity);
        videoElement.setAttribute('data-test-id', `remote-video-${participant.identity}`);
        
        // Add event listeners for debugging
        videoElement.onloadedmetadata = () => {
          console.log(`📹 [VIDEO] Remote video metadata loaded for ${participant.identity}:`, {
            videoWidth: videoElement.videoWidth,
            videoHeight: videoElement.videoHeight
          });
        };
        
        videoElement.oncanplay = () => {
          console.log(`✅ [VIDEO] Remote video can play for ${participant.identity}`);
        };
        
        videoElement.onerror = (e) => {
          console.error(`❌ [VIDEO] Error playing remote video for ${participant.identity}:`, e);
        };
        
        // Clear existing video and add new one to main video area
        if (videoRef.current) {
          console.log(`🎬 [VIDEO] Adding remote video to main video area for ${participant.identity}`);
          
          // Clear existing content
          videoRef.current.innerHTML = '';
          
          // Style the video element for main display
          videoElement.style.position = 'absolute';
          videoElement.style.top = '0';
          videoElement.style.left = '0';
          videoElement.style.width = '100%';
          videoElement.style.height = '100%';
          videoElement.style.objectFit = 'cover';
          videoElement.style.zIndex = '10';
          videoElement.style.backgroundColor = 'black'; // Fallback color
          
          // Add container div for better positioning
          const videoContainer = document.createElement('div');
          videoContainer.style.position = 'relative';
          videoContainer.style.width = '100%';
          videoContainer.style.height = '100%';
          videoContainer.style.backgroundColor = 'black';
          videoContainer.appendChild(videoElement);
          
          videoRef.current.appendChild(videoContainer);
          console.log('✅ [TRACK] Remote video attached to UI');
          console.log(`🧪 [TEST] USER CAN NOW SEE: ${participant.identity}'s video feed`);
          
          // Force visibility check
          setTimeout(() => {
            if (videoRef.current) {
              const addedVideo = videoRef.current.querySelector(`[data-participant="${participant.identity}"]`) as HTMLVideoElement;
              if (addedVideo) {
                console.log(`✅ [VIDEO-CHECK] Video element found in DOM:`, {
                  hasSrcObject: !!addedVideo.srcObject,
                  dimensions: `${addedVideo.videoWidth}x${addedVideo.videoHeight}`,
                  readyState: addedVideo.readyState,
                  visible: addedVideo.offsetWidth > 0 && addedVideo.offsetHeight > 0
                });
              } else {
                console.error(`❌ [VIDEO-CHECK] Video element NOT found in DOM for ${participant.identity}`);
              }
            }
          }, 500);
          
          // Force play with retry mechanism
          const attemptPlay = async (attempt = 1) => {
            try {
              await videoElement.play();
              console.log(`✅ [VIDEO] Remote video playing successfully for ${participant.identity}`);
            } catch (playError) {
              console.warn(`⚠️ [VIDEO] Play attempt ${attempt} failed:`, playError);
              if (attempt < 3) {
                setTimeout(() => attemptPlay(attempt + 1), 500 * attempt);
              } else {
                console.error(`❌ [VIDEO] All play attempts failed for ${participant.identity}`);
              }
            }
          };
          
          // Start playback attempts
          attemptPlay();
        }
      } else if (track.kind === Track.Kind.Audio) {
        const audioElement = track.attach();
        if (audioRef.current) {
          audioRef.current.srcObject = audioElement.srcObject;
          audioRef.current.play().catch(e => console.warn('Audio autoplay blocked:', e));
          console.log('✅ [TRACK] Remote audio attached to UI');
          console.log(`🧪 [TEST] USER CAN NOW HEAR: ${participant.identity}'s audio feed`);
        }
      }
    });

    newRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      console.log(`📤 [TRACK] Unsubscribed from ${track.kind}`);
      track.detach();
      
      // Clear video area if it was a video track
      if (track.kind === Track.Kind.Video && videoRef.current) {
        videoRef.current.innerHTML = '';
      }
    });

    newRoom.on(RoomEvent.TrackPublished, (publication: any, participant: RemoteParticipant) => {
      console.log(`⬆️ [TRACK] Published ${publication.kind} from ${participant.identity}`);
    });

    newRoom.on(RoomEvent.TrackUnpublished, (publication: any, participant: RemoteParticipant) => {
      console.log(`📤 [TRACK] Unpublished ${publication.kind} from ${participant.identity}`);
    });

    // Add ICE connection monitoring
    newRoom.on(RoomEvent.ConnectionStateChanged, (state: any) => {
      console.log(`🌐 [CONNECTION] Connection state changed: ${state}`);
    });

    console.log('✅ [EVENTS] Room event listeners configured');
  };

  const enhanceTrackAvailability = async (newRoom: Room) => {
    console.log('🔧 [ENHANCE] Enhancing track availability for new participant...');
    
    try {
      // Force re-enable tracks to ensure they're visible to new participants
      if (localVideoTrack) {
        await newRoom.localParticipant.publishTrack(localVideoTrack);
        console.log('✅ [ENHANCE] Re-published video track');
      }
      
      if (localAudioTrack) {
        await newRoom.localParticipant.publishTrack(localAudioTrack);
        console.log('✅ [ENHANCE] Re-published audio track');
      }
      
      // Also force enable the camera and mic to trigger any pending publishes
      await newRoom.localParticipant.setCameraEnabled(true);
      await newRoom.localParticipant.setMicrophoneEnabled(true);
      
      // Force refresh participant list to ensure accurate count
      const remoteParticipants = Array.from(newRoom.remoteParticipants.values());
      setParticipants(remoteParticipants);
      console.log('✅ [ENHANCE] Camera and microphone force-enabled');
      console.log('📊 [ENHANCE] Updated participants:', remoteParticipants.length);
      
    } catch (error) {
      console.error('❌ [ENHANCE] Error enhancing track availability:', error);
    }
  }

  const syncParticipantsPeriodically = (newRoom: Room) => {
    // Sync participant count every 2 seconds to ensure consistency
    const syncInterval = setInterval(() => {
      if (newRoom && newRoom.state === 'connected') {
        const remoteParticipants = Array.from(newRoom.remoteParticipants.values());
        setParticipants(prevParticipants => {
          const currentCount = remoteParticipants.length;
          const prevCount = prevParticipants.length;
          
          if (currentCount !== prevCount) {
            console.log(`🔄 [SYNC] Participant count changed: ${prevCount} → ${currentCount}`);
            return remoteParticipants;
          }
          return prevParticipants;
        });
      }
    }, 2000);
    
    // Clear interval when component unmounts
    return () => clearInterval(syncInterval);
  };

  const runBidirectionalVisibilityTest = (roomToTest?: Room) => {
    const testRoom = roomToTest || room;
    if (!testRoom || testRoom.state !== 'connected') {
      console.log('🧪 [TEST] Cannot run test - room not connected');
      return;
    }
    console.log(`🧪 [TEST] === BIDIRECTIONAL VISIBILITY TEST START ===`);
    console.log(`🧪 [TEST] Test running for: ${testRoom.localParticipant.identity}`);
    console.log(`🧪 [TEST] Test timestamp: ${new Date().toISOString()}`);
    
    // Test 1: Local Media Status
    const localVideoTracks = Array.from(testRoom.localParticipant.videoTrackPublications.values());
    const localAudioTracks = Array.from(testRoom.localParticipant.audioTrackPublications.values());
    console.log(`🧪 [TEST] LOCAL MEDIA STATUS:`);
    console.log(`🧪 [TEST] LOCAL VIDEO: ${localVideoTracks.length > 0 ? '✅ PUBLISHED' : '❌ NOT PUBLISHED'}`);
    console.log(`🧪 [TEST] LOCAL AUDIO: ${localAudioTracks.length > 0 ? '✅ PUBLISHED' : '❌ NOT PUBLISHED'}`);
    
    // Test 2: Local Video Element Status
    if (localVideoRef.current) {
      const localVideo = localVideoRef.current;
      console.log(`🧪 [TEST] LOCAL VIDEO ELEMENT:`);
      console.log(`🧪 [TEST] Video stream exists: ${localVideo.srcObject ? '✅ YES' : '❌ NO'}`);
      console.log(`🧪 [TEST] Video paused: ${localVideo.paused ? '❌ YES' : '✅ NO'}`);
      console.log(`🧪 [TEST] Video ready state: ${localVideo.readyState}`);
      console.log(`🧪 [TEST] Video dimensions: ${localVideo.videoWidth}x${localVideo.videoHeight}`);
      
      // Additional debugging for stream issues
      if (localVideo.srcObject) {
        const stream = localVideo.srcObject as MediaStream;
        const videoTracks = stream.getVideoTracks();
        console.log(`🧪 [TEST] Stream video tracks: ${videoTracks.length}`);
        if (videoTracks.length > 0) {
          console.log(`🧪 [TEST] Track label: ${videoTracks[0].label}`);
          console.log(`🧪 [TEST] Track enabled: ${videoTracks[0].enabled}`);
          console.log(`🧪 [TEST] Track muted: ${videoTracks[0].muted}`);
          console.log(`🧪 [TEST] Track ready state: ${videoTracks[0].readyState}`);
        }
      } else {
        console.log(`🧪 [TEST] CRITICAL: No srcObject - this is why preview is black/grey!`);
        console.log(`🧪 [TEST] Attempting automatic stream attachment...`);
        
        // Try multiple approaches to get video stream working
        if (localVideoTrack) {
          try {
            console.log(`🔧 [TEST] Attempting comprehensive stream fix...`);
            
            // Method 1: Re-attach track
            localVideoTrack.attach(localVideo);
            console.log(`📍 [TEST] Method 1: Track re-attached`);
            
            // Method 2: Force video element refresh
            setTimeout(() => {
              if (!localVideo.srcObject) {
                try {
                  // Method 3: Try direct stream assignment if track has mediaStream property
                  const mediaStream = (localVideoTrack as any).mediaStream;
                  if (mediaStream) {
                    localVideo.srcObject = mediaStream;
                    console.log(`✅ [TEST] Method 3: Direct stream assignment successful`);
                  } else {
                    console.log(`⚠️ [TEST] No mediaStream property available on track`);
                  }
                } catch (directError) {
                  console.error(`❌ [TEST] Direct stream assignment failed:`, directError);
                }
                
                // Method 4: Try recreating track attachment
                setTimeout(() => {
                  if (!localVideo.srcObject) {
                    console.log(`🔧 [TEST] Method 4: Recreating track attachment...`);
                    try {
                      const videoSrc = localVideo.src;
                      if (!videoSrc) {
                        // Force reload of video element
                        localVideo.load();
                      }
                    } catch (reloadError) {
                      console.error(`❌ [TEST] Video reload failed:`, reloadError);
                    }
                  }
                }, 500);
              } else {
                console.log(`✅ [TEST] Stream successfully attached via re-attach`);
              }
            }, 200);
            
            localVideo.play().catch(e => console.warn('Auto-play failed:', e));
          } catch (streamError) {
            console.error(`❌ [TEST] Auto-attachment failed:`, streamError);
          }
        }
      }
    }
    
    // Test 3: Remote Participants Status
    const remoteParticipants = Array.from(testRoom.remoteParticipants.values());
    console.log(`🧪 [TEST] REMOTE PARTICIPANTS: ${remoteParticipants.length}`);
    
    remoteParticipants.forEach((participant, index) => {
      const participantVideoTracks = Array.from(participant.videoTrackPublications.values());
      const participantAudioTracks = Array.from(participant.audioTrackPublications.values());
      
      console.log(`🧪 [TEST] PARTICIPANT ${index + 1}: ${participant.identity}`);
      console.log(`🧪 [TEST] Has video: ${participantVideoTracks.length > 0 ? '✅ YES' : '❌ NO'}`);
      console.log(`🧪 [TEST] Has audio: ${participantAudioTracks.length > 0 ? '✅ YES' : '❌ NO'}`);
      console.log(`🧪 [TEST] Connection state: ${participant.connectionQuality}`);
    });
    
    // Test 4: Local video preview visibility
    const localVideoEl = (document.querySelector('video[ref="localVideoRef"]') || localVideoRef.current) as HTMLVideoElement;
    if (localVideoEl) {
      console.log(`🧪 [TEST] LOCAL PREVIEW:`);
      console.log(`🧪 [TEST] Element visible: ${localVideoEl.offsetWidth > 0 && localVideoEl.offsetHeight > 0 ? '✅ YES' : '❌ NO'}`);
      console.log(`🧪 [TEST] Element dimensions: ${localVideoEl.offsetWidth}x${localVideoEl.offsetHeight}`);
    }
    
    // Test 5: Remote video feeds visibility  
    const remoteVideoElements = document.querySelectorAll('[data-test-id^="remote-video-"]') as NodeListOf<HTMLVideoElement>;
    console.log(`🧪 [TEST] REMOTE VIDEO FEEDS: ${remoteVideoElements.length} visible`);
    remoteVideoElements.forEach((videoEl, index) => {
      console.log(`🧪 [TEST] Remote video ${index + 1}: ${videoEl.offsetWidth}x${videoEl.offsetHeight} (${videoEl.getAttribute('data-participant')})`);
    });
    
    console.log(`🧪 [TEST] === TEST COMPLETE ===`);
    
    // Display test results in UI
    const testSummary = {
      localVideoPublished: localVideoTracks.length > 0,
      localAudioPublished: localAudioTracks.length > 0,
      localPreviewVisible: localVideoEl && localVideoEl!.offsetWidth > 0,
      remoteParticipantsCount: remoteParticipants.length,
      remoteVideoFeedsVisible: remoteVideoElements.length
    };
    
      console.log(`🧪 [TEST] SUMMARY:`, testSummary);
      return testSummary;
    };

    // Make test function globally available for manual testing
    (window as any).runVisibilityTest = () => runBidirectionalVisibilityTest();
    
    // Make emergency video stream fix available globally
    (window as any).fixVideoStream = async () => {
      if (!localVideoTrack || !localVideoRef.current) return;
      
      console.log(`🚨 [EMERGENCY-FIX] Starting emergency video stream repair...`);
      
      try {
        // Get fresh user media
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        console.log(`🚨 [EMERGENCY-FIX] Got fresh media stream:`, mediaStream);
        
        // Attach to video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
          await localVideoRef.current.play();
          console.log(`✅ [EMERGENCY-FIX] Emergency stream attached and playing!`);
        }
        
        // Also republish with LiveKit
        if (room) {
          const newVideoTrack = await room.localParticipant.setCameraEnabled(true);
          console.log(`🚨 [EMERGENCY-FIX] Republished video track to LiveKit`);
        }
        
      } catch (error) {
        console.error(`❌ [EMERGENCY-FIX] Emergency fix failed:`, error);
      }
    };
    
    // Automatically try emergency fix after 10 seconds if still no stream
    setTimeout(() => {
      if (localVideoRef.current && !localVideoRef.current.srcObject) {
        console.log(`⚠️ [AUTO-FIX] No video stream detected after 10s, triggering emergency fix...`);
        (window as any).fixVideoStream();
      }
    }, 10000);
    
    // Periodically check for missed remote video tracks and force attachment
    const checkForMissedTracks = () => {
      if (!room || room.state !== 'connected') return;
      
      console.log(`🔍 [MISSED-TRACK-CHECK] Checking for missed track subscriptions...`);
      
      const remoteParticipants = Array.from(room.remoteParticipants.values());
      remoteParticipants.forEach(participant => {
        const videoTracks = Array.from(participant.videoTrackPublications.values());
        videoTracks.forEach(publication => {
          if (publication.track && publication.isSubscribed) {
            const participantId = participant.identity;
            const existingVideo = videoRef.current?.querySelector(`[data-participant="${participantId}"]`);
            
            if (!existingVideo) {
              console.log(`🚨 [MISSED-TRACK] Found subscribed video track for ${participantId} that's not in DOM - forcing attachment`);
              
              // Force re-subscribe and attach
              try {
                const videoElement = publication.track.attach();
                videoElement.style.width = '100%';
                videoElement.style.height = '100%';
                videoElement.style.objectFit = 'cover';
                videoElement.setAttribute('data-participant', participantId);
                videoElement.setAttribute('data-test-id', `remote-video-forced-${participantId}`);
                
                if (videoRef.current) {
                  videoRef.current.innerHTML = '';
                  videoRef.current.appendChild(videoElement);
                  videoElement.play().catch(e => console.warn('Forced track play failed:', e));
                  console.log(`✅ [MISSED-TRACK] Forced attachment successful for ${participantId}`);
                }
              } catch (error) {
                console.error(`❌ [MISSED-TRACK] Forced attachment failed:`, error);
              }
            } else {
              console.log(`✅ [MISSED-TRACK] Video for ${participantId} already exists in DOM`);
            }
          }
        });
      });
    };
    
    // Run missed track check every 15 seconds (reduced frequency)
    const missedTrackInterval = setInterval(checkForMissedTracks, 15000);
    setTimeout(() => clearInterval(missedTrackInterval), 60000); // Stop after 60 seconds
    
    // Global function to manually fix remote video rendering
    (window as any).fixRemoteVideo = () => {
      console.log(`🚨 [REMOTE-FIX] Starting remote video render repair...`);
      
      const remoteVideos = document.querySelectorAll('[data-test-id^="remote-video-"]') as NodeListOf<HTMLVideoElement>;
      console.log(`🚨 [REMOTE-FIX] Found ${remoteVideos.length} remote video elements`);
      
      remoteVideos.forEach((videoEl, index) => {
        const participantId = videoEl.getAttribute('data-participant');
        console.log(`🚨 [REMOTE-FIX] Processing video ${index + 1} for participant: ${participantId}`);
        
        // Check if video has stream
        if (!videoEl.srcObject) {
          console.log(`❌ [REMOTE-FIX] Video ${index + 1} has no srcObject - attempting to find track`);
          
          // Try to find the associated LiveKit track
          if (room) {
            const participants = Array.from(room.remoteParticipants.values());
            const participant = participants.find(p => p.identity === participantId);
            
            if (participant) {
              const videoTrack = Array.from(participant.videoTrackPublications.values())[0];
              if (videoTrack && videoTrack.track) {
                console.log(`🔧 [REMOTE-FIX] Found video track, re-attaching...`);
                try {
                  videoTrack.track.attach(videoEl);
                  videoEl.play().catch(e => console.warn('Remote video play failed:', e));
                  console.log(`✅ [REMOTE-FIX] Track re-attached for ${participantId}`);
                } catch (attachError) {
                  console.error(`❌ [REMOTE-FIX] Re-attach failed:`, attachError);
                }
              } else {
                console.log(`❌ [REMOTE-FIX] No video track found for ${participantId}`);
              }
            } else {
              console.log(`❌ [REMOTE-FIX] Participant ${participantId} not found`);
            }
          }
        } else {
          console.log(`✅ [REMOTE-FIX] Video ${index + 1} has srcObject - forcing play`);
          videoEl.play().catch(e => console.warn('Remote video play failed:', e));
        }
      });
      
      // Force UI refresh
      console.log(`🔄 [REMOTE-FIX] Forcing UI refresh...`);
      if (videoRef.current) {
        const currentContent = videoRef.current.innerHTML;
        videoRef.current.innerHTML = '';
        setTimeout(() => {
          videoRef.current!.innerHTML = currentContent;
        }, 100);
      }
    };

  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };
  
  const addTranscript = (message: ChatMessage) => {
    setTranscript(prev => [...prev, message]);
    // Also add to general messages for context
    addMessage({ ...message, isTranscript: true });
  };

  // Store speech in context via API
  const storeSpeechInContext = async (speechText: string) => {
    try {
      await fetch('/api/store-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          speech: speechText,
          speaker: 'user'
        }),
      });
      console.log('📝 [CONTEXT] Stored speech in context:', speechText.substring(0, 50) + '...');
    } catch (error) {
      console.warn('⚠️ [CONTEXT] Failed to store speech in context:', error);
    }
  };
  
  
  const startTranscription = async (room: Room) => {
    try {
      // Check if browser supports speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.warn('Speech recognition not supported in this browser');
        addTranscript({
          id: Date.now().toString(),
          text: 'Speech recognition not supported in this browser. Try using Chrome or Edge.',
          speaker: 'system',
          timestamp: Date.now(),
          isTranscript: true
        });
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      // Improve speech recognition sensitivity
      recognition.maxAlternatives = 3; // Get multiple recognition alternatives
      recognition.serviceURI = ''; // Use default service
      
      // Set longer timeout for better detection
      if ('webkitSpeechRecognition' in window) {
        (recognition as any).continuous = true;
        (recognition as any).interimResults = true;
        (recognition as any).maxAlternatives = 3;
      }

      let isListening = false;

      recognition.onstart = () => {
        console.log('🎤 [SPEECH] Recognition started - listening for voice input');
        isListening = true;
        addTranscript({
          id: Date.now().toString(),
          text: '🎤 Listening for speech... Say "Hey Hero" to activate the AI assistant.',
          speaker: 'system',
          timestamp: Date.now(),
          isTranscript: true
        });
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Show final transcript
        if (finalTranscript.trim()) {
          console.log('🎤 [SPEECH] Raw transcript received:', finalTranscript.trim());
          
          addTranscript({
            id: Date.now().toString(),
            text: finalTranscript.trim(),
            speaker: 'user',
            timestamp: Date.now(),
            isTranscript: true
          });

          // Store all speech in context (not just Hero-triggered messages)
          storeSpeechInContext(finalTranscript.trim());

          // Check for Hero trigger phrases (case insensitive) - check both current and recent context
          const recentContext = transcript.slice(-3).map(t => t.text).join(' ').toLowerCase();
          const currentAndRecent = (recentContext + ' ' + finalTranscript).toLowerCase();
          
          console.log('🔍 [TRIGGER] Checking for Hero trigger in:', finalTranscript);
          console.log('🔍 [TRIGGER] Recent context:', recentContext);
          
          if (finalTranscript.toLowerCase().match(/(hey|hi|hello)\s+hero/) || 
              currentAndRecent.match(/(hey|hi|hello)\s+hero/) ||
              finalTranscript.toLowerCase().includes('hero') ||
              (finalTranscript.toLowerCase().includes('hero') && recentContext.includes('what'))) {
            console.log('✅ [TRIGGER] Hero trigger detected! Sending to backend...');
            console.log('📝 [TRIGGER] Full message:', finalTranscript);
            console.log('📝 [TRIGGER] Context:', recentContext);
            
            // Use the full context for better understanding
            const fullContext = currentAndRecent.includes('hero') ? currentAndRecent : finalTranscript;
            handleHeroTrigger(fullContext);
          } else {
            console.log('❌ [TRIGGER] No Hero trigger found in transcript');
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('❌ [SPEECH] Recognition error:', event.error);
        if (event.error === 'not-allowed') {
          addTranscript({
            id: Date.now().toString(),
            text: '❌ Microphone access denied. Please allow microphone access to use voice commands.',
            speaker: 'system',
            timestamp: Date.now(),
            isTranscript: true
          });
        } else if (event.error === 'aborted') {
          console.log('⚠️ [SPEECH] Recognition aborted, will restart via onend handler');
        } else if (event.error === 'network') {
          console.warn('🌐 [SPEECH] Network error in speech recognition - connection issues');
        } else if (event.error === 'no-speech') {
          console.log('🔇 [SPEECH] No speech detected - timeout reached');
        }
      };

      recognition.onend = () => {
        console.log('🔴 [SPEECH] Recognition ended - preparing to restart');
        isListening = false;
        // Only restart if room is connected and not manually stopped
        if (room && room.state === 'connected') {
          setTimeout(() => {
            try {
              if (!isListening) {
                console.log('🔄 [SPEECH] Restarting speech recognition...');
                recognition.start();
              }
            } catch (error) {
              console.warn('⚠️ [SPEECH] Recognition restart failed:', error instanceof Error ? error.message : 'Unknown error');
            }
          }, 500); // Reduced timeout for more responsive listening
        }
      };

      // Start recognition
      recognition.start();
      
    } catch (error) {
      console.error('Error starting transcription:', error);
      addTranscript({
        id: Date.now().toString(),
        text: '❌ Failed to start speech recognition. Please refresh the page and try again.',
        speaker: 'system',
        timestamp: Date.now(),
        isTranscript: true
      });
    }
  };
  
  const handleHeroTrigger = async (transcript: string) => {
    console.log('\n🚀 [FRONTEND] === SENDING TO HERO ===');
    console.log('🚀 [FRONTEND] Room:', roomName);
    console.log('🚀 [FRONTEND] Message:', transcript);
    
    try {
      console.log('🌐 [FRONTEND] Making API call to /api/hero-join...');
      
      const response = await fetch('/api/hero-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          message: transcript
        }),
      });
      
      console.log('📡 [FRONTEND] API response status:', response.status);
      console.log('📡 [FRONTEND] API response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [FRONTEND] API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('\n📥 [FRONTEND] === HERO RESPONSE RECEIVED ===');
      console.log('📥 [FRONTEND] Full API response:', data);
      
      if (data.success && data.response) {
        console.log('✅ [FRONTEND] Hero response successful!');
        
        // Strip markdown formatting from response
        const cleanResponse = data.response.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        console.log('🧼 [FRONTEND] Cleaned response text:', cleanResponse);
        
        addMessage({
          id: Date.now().toString(),
          text: cleanResponse,
          timestamp: Date.now(),
          isHero: true
        });
        
        // Play TTS audio if available
        if (data.audioBuffer) {
          console.log('🎵 [FRONTEND] === PLAYING TTS AUDIO ===');
          console.log('🎵 [FRONTEND] Audio buffer size:', data.audioBuffer?.length || 0, 'characters (base64)');
          console.log('🎵 [FRONTEND] Audio duration:', data.duration, 'seconds');
          
          try {
            // Initialize audio context if not already done
            if (!audioContextRef.current) {
              audioContextRef.current = new AudioContext();
              console.log('🎵 [FRONTEND] Creating audio context...');
            }
            
            // Resume audio context if suspended (required for user interaction)
            if (audioContextRef.current.state === 'suspended') {
              await audioContextRef.current.resume();
              console.log('🎵 [FRONTEND] Audio context resumed');
            }
            
            const audioData = Uint8Array.from(atob(data.audioBuffer), c => c.charCodeAt(0));
            console.log('🎵 [FRONTEND] Decoded audio data size:', audioData.length, 'bytes');
            
            const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
            console.log('🎵 [FRONTEND] Audio buffer created successfully');
            
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start();
            
            console.log('✅ [FRONTEND] Audio playback started!');
          } catch (audioError) {
            console.warn('❌ [FRONTEND] Error playing TTS audio:', audioError);
            // Fallback: try using HTML5 audio element
            try {
              const audioBlob = new Blob([Uint8Array.from(atob(data.audioBuffer), c => c.charCodeAt(0))], { type: 'audio/mpeg' });
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              await audio.play();
              console.log('✅ [FRONTEND] Fallback audio playback started!');
              // Clean up the URL after playback
              audio.onended = () => URL.revokeObjectURL(audioUrl);
            } catch (fallbackError) {
              console.warn('❌ [FRONTEND] Fallback audio playback also failed:', fallbackError);
            }
          }
        } else {
          console.log('⚠️ [FRONTEND] No audio buffer provided in response');
        }
      } else if (data.success && data.message) {
        console.log('💬 [FRONTEND] Debug message from API:', data.message);
        // Show debug message in transcript
        addTranscript({
          id: Date.now().toString(),
          text: `🤖 Hero debug: ${data.message}`,
          speaker: 'system',
          timestamp: Date.now(),
          isTranscript: true
        });
      } else {
        console.log('❌ [FRONTEND] Unexpected response format:', data);
      }
      
      console.log('🏁 [FRONTEND] === HERO PIPELINE COMPLETE ===\n');
    } catch (error) {
      console.error('\n❌ [FRONTEND] === HERO TRIGGER ERROR ===');
      console.error('❌ [FRONTEND] Error type:', typeof error);
      console.error('❌ [FRONTEND] Error message:', error instanceof Error ? error.message : String(error));
      console.error('❌ [FRONTEND] Full error:', error);
      console.error('🏁 [FRONTEND] === ERROR END ===\n');
      
      // Add error message to chat
      addMessage({
        id: Date.now().toString(),
        text: `❌ Sorry, Hero encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        isHero: true
      });
    }
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
      const response = await fetch('/api/hero-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          message
        }),
      });

      const data = await response.json();
      console.log('Hero chat response:', data);
      
      if (data.success && data.response) {
        // Strip markdown formatting from response
        const cleanResponse = data.response.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        
        // Add Hero AI response to chat
        addMessage({
          id: Date.now().toString(),
          text: cleanResponse,
          timestamp: Date.now(),
          isHero: true
        });

        // Play TTS audio if available
        if (data.audioBuffer) {
          try {
            // Initialize audio context if not already done
            if (!audioContextRef.current) {
              audioContextRef.current = new AudioContext();
            }
            
            // Resume audio context if suspended (required for user interaction)
            if (audioContextRef.current.state === 'suspended') {
              await audioContextRef.current.resume();
            }
            
            const audioData = Uint8Array.from(atob(data.audioBuffer), c => c.charCodeAt(0));
            const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start();
          } catch (audioError) {
            console.warn('Error playing TTS audio:', audioError);
            // Fallback: try using HTML5 audio element
            try {
              const audioBlob = new Blob([Uint8Array.from(atob(data.audioBuffer), c => c.charCodeAt(0))], { type: 'audio/mpeg' });
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              await audio.play();
              // Clean up the URL after playback
              audio.onended = () => URL.revokeObjectURL(audioUrl);
            } catch (fallbackError) {
              console.warn('Fallback audio playback also failed:', fallbackError);
            }
          }
        }
      } else if (data.success && data.message) {
        // Show debug message for chat
        addMessage({
          id: Date.now().toString(),
          text: `Debug: ${data.message}`,
          timestamp: Date.now(),
          isHero: true
        });
      }
    } catch (error) {
      console.error('Error sending message to Hero bot:', error);
    }
  };

  const copyMeetingLink = async () => {
    const meetingLink = window.location.href;
    try {
      await navigator.clipboard.writeText(meetingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const toggleAudio = async () => {
    if (!room) return;
    
    try {
      await room.localParticipant.setMicrophoneEnabled(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
      console.log(`🎤 Audio ${!isAudioEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling audio:', error);
    }
  };

  const toggleVideo = async () => {
    if (!room) return;
    
    try {
      await room.localParticipant.setCameraEnabled(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
      console.log(`📹 Video ${!isVideoEnabled ? 'enabled' : 'disabled'}`);
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            border: '4px solid #374151', 
            borderTop: '4px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 24px auto'
          }}></div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'white', marginBottom: '8px' }}>
            Joining Meeting Room
          </h2>
          <p style={{ color: '#9ca3af' }}>Please wait while we connect you...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#dc2626',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px auto'
          }}>
            <span style={{ color: 'white', fontSize: '24px' }}>!</span>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>
            Connection Failed
          </h2>
          <p style={{ color: '#9ca3af', marginBottom: '24px' }}>{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="btn btn-primary"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-container">
      {/* Main Video Area */}
      <div className="video-area">
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          backgroundColor: '#1f2937',
          borderBottom: '1px solid #374151'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'white', fontSize: '18px', fontWeight: '600' }}>
              room: {roomName}
            </span>
            <span style={{ color: '#60a5fa', fontSize: '14px' }}>
              {room ? room.numParticipants : participants.length + 1} participants
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={leaveMeeting} className="btn btn-secondary" style={{ fontSize: '14px' }}>
              Leave Meeting
            </button>
            <button 
              onClick={copyMeetingLink}
              className="copy-link-btn"
            >
              {copied ? 'Copied!' : 'Copy Meeting Link'}
            </button>
          </div>
        </div>

        {/* Main Video Content */}
        <div className="waiting-message">
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '100px',
              height: '100px',
              backgroundColor: '#0f172a',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#3b82f6" 
                viewBox="0 0 24 24" width="56" height="56" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" 
                  d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-6a4 4 0 11-8 0 4 4 0 018 0zm6 4a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'white', marginBottom: '6px' }}>
              Waiting for others to join...
            </h2>
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>
              Your meeting room is ready
            </p>
          </div>
        </div>


        {/* Video Preview - User's own camera */}
        <div className="video-preview">
          <video 
            ref={localVideoRef}
            autoPlay 
            muted 
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '8px',
              backgroundColor: 'black'
            }}
            onLoadedMetadata={() => {
              console.log('🎥 [VIDEO] Local video metadata loaded - stream should be visible');
            }}
            onCanPlay={() => {
              console.log('🎥 [VIDEO] Local video can play - stream is ready');
            }}
            onError={(e) => {
              console.error('🎥 [VIDEO] Local video error:', e);
              console.log('🎥 [VIDEO] Video element current src:', localVideoRef.current?.src);
              console.log('🎥 [VIDEO] Video element srcObject:', localVideoRef.current?.srcObject);
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            You
          </div>
        </div>
        
        {/* Remote participants video area */}
        <div ref={videoRef} style={{
          position: 'absolute',
          top: '80px',
          left: '20px',
          right: '20px',
          bottom: '200px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Remote participant videos will be attached here */}
        </div>

        {/* Controls */}
        <div className="controls">
          <button 
            onClick={toggleAudio} 
            className={`control-btn ${!isAudioEnabled ? 'muted' : ''}`}
            style={{
              backgroundColor: !isAudioEnabled ? '#dc2626' : '#374151'
            }}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isAudioEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              )}
            </svg>
          </button>
          
          <button 
            onClick={toggleVideo} 
            className={`control-btn ${!isVideoEnabled ? 'muted' : ''}`}
            style={{
              backgroundColor: !isVideoEnabled ? '#dc2626' : '#374151'
            }}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isVideoEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              )}
            </svg>
          </button>
          
          <button className="control-btn">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
          </button>
          
          <button onClick={leaveMeeting} className="control-btn" style={{ backgroundColor: '#dc2626' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        {/* Meeting Attendees */}
        <div className="sidebar-section" style={{ borderBottom: '1px solid #374151', paddingBottom: '16px', marginBottom: '16px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Meeting Attendees ({room ? room.numParticipants : participants.length + 1})
          </h3>
          
          {/* Current User */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px',
            backgroundColor: '#374151',
            borderRadius: '8px',
            marginBottom: '8px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#22c55e',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: '600',
              color: 'white'
            }}>
              Y
            </div>
            <div>
              <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>
                You (Host)
              </div>
              <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                {isVideoEnabled ? '📹' : '📹🚫'} {isAudioEnabled ? '🎤' : '🎤🚫'}
              </div>
            </div>
          </div>
          
          {/* Remote Participants */}
          {participants.map((participant, index) => (
            <div key={participant.identity} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px',
              backgroundColor: '#374151',
              borderRadius: '8px',
              marginBottom: '8px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: participant.identity === 'hero-bot' ? '#2563eb' : '#f59e0b',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '600',
                color: 'white'
              }}>
                {participant.identity === 'hero-bot' ? '🤖' : participant.identity.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>
                  {participant.identity === 'hero-bot' ? 'Hero AI Assistant' : `Participant ${index + 1}`}
                </div>
                <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                  {participant.identity === 'hero-bot' ? '🤖 AI' : 'Online'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Live Transcription */}
        <div className="sidebar-section" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#22c55e',
              borderRadius: '50%'
            }}></div>
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0' }}>Live Transcription</h3>
          </div>
          
          <div style={{
            backgroundColor: '#374151',
            borderRadius: '8px',
            padding: '12px',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {transcript.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#4b5563',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto'
                }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0' }}>
                  No transcript yet...
                </p>
                <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', margin: '4px 0 0 0' }}>
                  Start speaking to see live transcription
                </p>
              </div>
            ) : (
              transcript.slice(-10).map((msg) => (
                <div key={msg.id} style={{
                  padding: '8px',
                  marginBottom: '8px',
                  backgroundColor: '#4b5563',
                  borderRadius: '6px',
                  fontSize: '13px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '600', color: '#60a5fa' }}>
                      Speaker {msg.speaker || 'Unknown'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ margin: '0', color: '#e5e7eb' }}>{msg.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Chat with Hero */}
        <div className="sidebar-section">
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Chat with Hero AI
          </h3>
          
          <div style={{
            backgroundColor: '#374151',
            borderRadius: '8px',
            padding: '12px',
            maxHeight: '250px',
            overflowY: 'auto',
            marginBottom: '12px'
          }}>
            {messages.filter(m => !m.isTranscript).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#2563eb',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto'
                }}>
                  🤖
                </div>
                <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0' }}>
                  Say &quot;Hey Hero&quot; or type a message
                </p>
                <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', margin: '4px 0 0 0' }}>
                  Hero understands the meeting context
                </p>
              </div>
            ) : (
              messages.filter(m => !m.isTranscript).map((message) => (
                <div key={message.id} style={{
                  backgroundColor: message.isHero ? '#1e40af' : '#4b5563',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '8px',
                  fontSize: '13px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <span style={{ fontWeight: '600', fontSize: '12px', color: message.isHero ? '#60a5fa' : '#e5e7eb' }}>
                      {message.isHero ? '🤖 Hero AI' : 'You'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {new Date(message.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <p style={{ margin: '0', color: 'white' }}>{message.text}</p>
                </div>
              ))
            )}
          </div>
          
          {/* Chat Input */}
          <form onSubmit={(e) => { e.preventDefault(); const input = e.target as any; if (input.chat.value.trim()) { handleSendMessage(input.chat.value.trim()); input.chat.value = ''; } }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                name="chat"
                type="text" 
                placeholder="Type a message for Hero..."
                style={{
                  flex: '1',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #4b5563',
                  backgroundColor: '#374151',
                  color: 'white',
                  fontSize: '14px'
                }}
              />
              <button 
                type="submit"
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} autoPlay />
      
      {/* CSS Animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
