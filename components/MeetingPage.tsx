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
        // Create tracks in parallel for faster initialization (OPTIMIZED)
        [localVideo, localAudio] = await Promise.all([
          createLocalVideoTrack({
            resolution: {
              width: 1280,
              height: 720
            },
            facingMode: 'user'
          }),
          createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          })
        ]);
        
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
            
            // Force play immediately (some browsers need this)
            videoEl.play().then(() => {
              console.log('✅ [VIDEO] Local video playing successfully');
            }).catch(e => {
              console.warn('🎥 [VIDEO] Autoplay blocked, user interaction required:', e);
            });
            
            // Verify stream attachment with reduced delay
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
            }, 50); // Reduced from 100ms to 50ms for faster verification
            
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
      
      // STEP 10: Schedule initial test run (OPTIMIZED - reduced delay)
      setTimeout(() => {
        runBidirectionalVisibilityTest(newRoom);
      }, 1000); // Reduced from 3000ms to 1000ms
      
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
          
          // Force visibility check with reduced delay for faster feedback
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
          }, 100); // Reduced from 500ms to 100ms
          
          // Force play with retry mechanism
          const attemptPlay = async (attempt = 1) => {
            try {
              await videoElement.play();
              console.log(`✅ [VIDEO] Remote video playing successfully for ${participant.identity}`);
            } catch (playError) {
              console.warn(`⚠️ [VIDEO] Play attempt ${attempt} failed:`, playError);
              if (attempt < 3) {
                setTimeout(() => attemptPlay(attempt + 1), 100 * attempt); // Faster retries: 100ms, 200ms
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
    
    // Make speech recognition restart function globally available
    (window as any).restartSpeechRecognition = () => {
      console.log('🔄 [MANUAL] Manual speech recognition restart requested...');
      if (room && room.state === 'connected') {
        try {
          // Force stop current recognition
          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.stop();
            setTimeout(() => {
              startTranscription(room);
            }, 1000);
          }
        } catch (error) {
          console.error('❌ [MANUAL] Manual restart failed:', error);
        }
      }
    };
    
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
      
      // Improve speech recognition stability
      recognition.maxAlternatives = 1; // Reduce alternatives for better performance
      recognition.serviceURI = ''; // Use default service
      
      // Set more conservative settings for better stability
      if ('webkitSpeechRecognition' in window) {
        (recognition as any).continuous = true;
        (recognition as any).interimResults = true;
        (recognition as any).maxAlternatives = 1;
        // Add timeout settings to prevent hanging
        (recognition as any).maxSpeechTimeout = 10000; // 10 seconds max speech
        (recognition as any).maxSilenceTimeout = 5000; // 5 seconds max silence
      }

      let isListening = false;
      let keepAliveInterval: NodeJS.Timeout | null = null;
      let speechTimeout: NodeJS.Timeout | null = null;
      let lastSpeechTime = Date.now();

      recognition.onstart = () => {
        console.log('🎤 [SPEECH] Recognition started - listening for voice input');
        isListening = true;
        
        // Keepalive mechanism to prevent auto-stop
        if (keepAliveInterval) clearInterval(keepAliveInterval);
        keepAliveInterval = setInterval(() => {
          if (isListening && room && room.state === 'connected') {
            const timeSinceLastSpeech = Date.now() - lastSpeechTime;
            console.log('💓 [SPEECH] Keepalive - still listening...', `(${Math.round(timeSinceLastSpeech/1000)}s since last speech)`);
            
            // If no speech detected for 30 seconds, force restart recognition
            if (timeSinceLastSpeech > 30000) {
              console.log('⚠️ [SPEECH] No speech detected for 30s - forcing restart...');
              try {
                recognition.stop();
              } catch (e) {
                console.log('🔄 [SPEECH] Recognition already stopped, restarting...');
                setTimeout(() => {
                  try {
                    recognition.start();
                    lastSpeechTime = Date.now(); // Reset timer
                  } catch (restartError) {
                    console.error('❌ [SPEECH] Force restart failed:', restartError);
                  }
                }, 1000);
              }
            }
          }
        }, 10000); // Check every 10 seconds
        
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
          lastSpeechTime = Date.now(); // Update last speech time
          
          addTranscript({
            id: Date.now().toString(),
            text: finalTranscript.trim(),
            speaker: 'user',
            timestamp: Date.now(),
            isTranscript: true
          });

          // Store all speech in context (not just Hero-triggered messages)
          storeSpeechInContext(finalTranscript.trim());

          // Check for Hero trigger phrases (case insensitive)
          console.log('🔍 [TRIGGER] Checking for Hero trigger in:', finalTranscript);
          
          if (finalTranscript.toLowerCase().match(/(hey|hi|hello)\s+hero|^\s*hero\b/) || 
              finalTranscript.toLowerCase().includes('hero')) {
            console.log('✅ [TRIGGER] Hero trigger detected! Sending to backend...');
            console.log('📝 [TRIGGER] Full message:', finalTranscript);
            
            handleHeroTrigger(finalTranscript);
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
          console.log('⚠️ [SPEECH] Recognition aborted - this is normal, will restart automatically');
          // Don't restart immediately on abort - let onend handle it
        } else if (event.error === 'network') {
          console.warn('🌐 [SPEECH] Network error in speech recognition - connection issues');
        } else if (event.error === 'no-speech') {
          console.log('🔇 [SPEECH] No speech detected - timeout reached');
        } else if (event.error === 'audio-capture') {
          console.warn('🎤 [SPEECH] Audio capture error - microphone may be in use');
        } else if (event.error === 'service-not-allowed') {
          console.warn('🚫 [SPEECH] Speech recognition service not allowed');
        }
      };

      recognition.onend = () => {
        console.log('🔴 [SPEECH] Recognition ended - preparing to restart');
        isListening = false;
        
        // Clear keepalive interval
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
        
        // Clear speech timeout
        if (speechTimeout) {
          clearTimeout(speechTimeout);
          speechTimeout = null;
        }
        
        // Only restart if room is connected and not manually stopped
        if (room && room.state === 'connected') {
          // Use a longer delay to prevent rapid restart cycles
          setTimeout(() => {
            try {
              if (!isListening && room && room.state === 'connected') {
                console.log('🔄 [SPEECH] Restarting speech recognition...');
                lastSpeechTime = Date.now(); // Reset speech timer
                recognition.start();
              }
            } catch (error) {
              console.warn('⚠️ [SPEECH] Recognition restart failed:', error instanceof Error ? error.message : 'Unknown error');
              // If immediate restart fails, try again after a longer delay
              setTimeout(() => {
                if (!isListening && room && room.state === 'connected') {
                  try {
                    console.log('🔄 [SPEECH] Retry restarting speech recognition...');
                    lastSpeechTime = Date.now(); // Reset speech timer
                    recognition.start();
                  } catch (retryError) {
                    console.error('❌ [SPEECH] Retry restart also failed:', retryError);
                  }
                }
              }, 1000); // Increased delay to 1 second
            }
          }, 500); // Increased from 100ms to 500ms for more stable restart
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
          padding: '20px 32px',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderBottom: '1px solid rgba(59, 130, 246, 0.1)',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#22c55e',
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }}></div>
            <div>
              <span style={{ 
                color: 'white', 
                fontSize: '20px', 
                fontWeight: '700',
                letterSpacing: '-0.025em'
              }}>
                {roomName}
            </span>
              <div style={{ 
                color: '#94a3b8', 
                fontSize: '14px',
                fontWeight: '500',
                marginTop: '2px'
              }}>
                {room ? room.numParticipants : participants.length + 1} participant{room && room.numParticipants !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={leaveMeeting} 
              style={{ 
                fontSize: '14px',
                fontWeight: '600',
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                color: '#fca5a5',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.5)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.3)';
              }}
            >
              Leave Meeting
            </button>
            <button 
              onClick={copyMeetingLink}
              style={{
                fontSize: '14px',
                fontWeight: '600',
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                backgroundColor: copied ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                color: copied ? '#86efac' : '#93c5fd',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseOver={(e) => {
                if (!copied) {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                }
              }}
              onMouseOut={(e) => {
                if (!copied) {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                }
              }}
            >
              {copied ? '✓ Copied!' : 'Copy Meeting Link'}
            </button>
          </div>
        </div>

        {/* Main Video Content */}
            <div style={{
          position: 'relative',
          height: '100%',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {/* Background Pattern */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 75% 75%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.05) 0%, transparent 50%)
            `,
            opacity: 0.6
          }}></div>
          
          {participants.length === 0 && (
          <div style={{ 
            textAlign: 'center',
            position: 'relative',
            zIndex: 2,
            maxWidth: '400px',
            padding: '40px'
          }}>
            <div style={{
              width: '120px',
              height: '120px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 32px auto',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
            }}>
              <svg fill="#60a5fa" version="1.1" xmlns="http://www.w3.org/2000/svg" 
                width="64" height="64" viewBox="0 0 612 612" xmlSpace="preserve">
                <g>
                  <path d="M306,317.657c46.677,0,84.514-37.838,84.514-84.514S352.677,148.629,306,148.629c-46.676,0-84.514,37.838-84.514,84.514
                    S259.324,317.657,306,317.657z M350.041,262.785c-4.179,13.816-22.078,24.202-43.529,24.202c-21.453,0-39.352-10.386-43.53-24.202
                    H350.041z M448.225,405.086v27.858c0,4.129-2.752,8.928-6.524,10.606c-14.62,6.506-54.354,19.82-135.844,19.82
                    c-81.489,0-121.008-13.315-135.628-19.82c-3.773-1.679-6.453-6.478-6.453-10.606v-27.858c0-41.747,31.497-76.379,72.054-81.018
                    c1.232-0.141,2.917,0.387,3.921,1.115c18.7,13.537,41.522,21.617,66.322,21.617c24.799,0,47.657-8.08,66.356-21.617
                    c1.005-0.728,2.526-1.255,3.759-1.115C416.746,328.707,448.225,363.339,448.225,405.086z M612,329.552v16.487
                    c0,2.443-1.799,5.284-4.031,6.277c-8.653,3.851-32.255,11.731-80.482,11.731c-48.229,0-73.514-7.881-82.166-11.731
                    c-2.233-0.992-5.715-3.833-5.715-6.277v-16.487c0-24.707,20.494-45.204,44.498-47.949c0.729-0.083,2.652,0.229,3.247,0.66
                    c11.067,8.012,25.038,12.794,39.715,12.794c14.678,0,28.438-4.782,39.505-12.794c0.596-0.431,1.782-0.742,2.511-0.66
                    C593.083,284.349,612,304.845,612,329.552z M166.68,352.317c-8.653,3.851-33.095,11.73-81.324,11.73
                    c-48.229,0-72.25-7.88-80.903-11.73C2.219,351.324,0,348.483,0,346.04v-16.487c0-24.707,18.812-45.204,42.815-47.949
                    c0.729-0.083,1.811,0.229,2.405,0.659c11.067,8.013,24.617,12.795,39.293,12.795c14.677,0,28.227-4.782,39.294-12.795
                    c0.594-0.431,3.358-0.742,4.088-0.659c24.003,2.746,44.498,23.242,44.498,47.949v16.487
                    C172.395,348.483,168.913,351.324,166.68,352.317z M84.514,177.771c-27.624,0-50.019,22.394-50.019,50.019
                    c0,27.625,22.394,50.019,50.019,50.019s50.019-22.394,50.019-50.019S112.139,177.771,84.514,177.771z M84.514,258.22
                    c-12.956,0-23.766-6.272-26.29-14.617h52.581C108.281,251.948,97.471,258.22,84.514,258.22z M527.486,177.771
                    c-27.625,0-50.02,22.394-50.02,50.019c0,27.625,22.395,50.019,50.02,50.019c27.624,0,50.019-22.394,50.019-50.019
                    S555.11,177.771,527.486,177.771z M527.485,258.22c-12.956,0-23.767-6.272-26.29-14.617h52.58
                    C551.252,251.948,540.441,258.22,527.485,258.22z"/>
                </g>
              </svg>
            </div>
            <h2 style={{ 
              fontSize: '28px', 
              fontWeight: '700', 
              color: 'white', 
              marginBottom: '12px',
              letterSpacing: '-0.025em',
              background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Waiting for others to join...
            </h2>
            <p style={{ 
              fontSize: '16px', 
              color: '#94a3b8',
              fontWeight: '500',
              lineHeight: '1.5'
            }}>
              Your meeting room is ready and secure
            </p>
          </div>
          )}
        </div>


        {/* Video Preview - User's own camera */}
        <div className="local-video-preview" style={{
          position: 'absolute',
          bottom: '24px',
          left: '24px',
          width: '280px',
          height: '210px',
          borderRadius: '20px',
          overflow: 'hidden',
          border: '3px solid rgba(59, 130, 246, 0.4)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(15px)',
          zIndex: 20
        }}>
          {/* Loading skeleton for video */}
          {!localVideoTrack && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '3px solid rgba(59, 130, 246, 0.3)',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
            </div>
          )}
          <video 
            ref={localVideoRef}
            autoPlay 
            muted 
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
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
            bottom: '12px',
            left: '12px',
            background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 100%)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            You
          </div>
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            display: 'flex',
            gap: '6px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: isVideoEnabled ? '#22c55e' : '#ef4444',
              borderRadius: '50%',
              border: '2px solid rgba(0, 0, 0, 0.3)'
            }}></div>
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: isAudioEnabled ? '#22c55e' : '#ef4444',
              borderRadius: '50%',
              border: '2px solid rgba(0, 0, 0, 0.3)'
            }}></div>
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
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 24px',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          zIndex: 10
        }}>
          <button 
            onClick={toggleAudio} 
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              background: !isAudioEnabled 
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                : 'linear-gradient(135deg, #374151 0%, #4b5563 100%)',
              border: `2px solid ${!isAudioEnabled ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
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
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              background: !isVideoEnabled 
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                : 'linear-gradient(135deg, #374151 0%, #4b5563 100%)',
              border: `2px solid ${!isVideoEnabled ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
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
          
          <button style={{
            width: '48px',
            height: '48px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              background: 'linear-gradient(135deg, #374151 0%, #4b5563 100%)',
              border: '2px solid rgba(59, 130, 246, 0.3)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
          }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
          </button>
          
          <button 
            onClick={leaveMeeting} 
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              border: '2px solid rgba(239, 68, 68, 0.3)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
            }}
          >
            <svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" 
              width="24" height="24" viewBox="0 0 52 52">
              <path d="M48.5,5.6l-2.1-2.1C45.8,2.9,44.7,3,44,3.8L20.5,27.3l-5-5.6c-0.6-0.6-0.6-1.4-0.2-2.1l3.8-5.2
                c1.1-1.4,1-3.4-0.1-4.8l-4.9-6.1c-1.5-1.8-4.2-2-5.9-0.3L3,8.4c-0.8,0.8-1.2,1.9-1.2,3c0.5,9.2,4.2,18,10,24.6l-8,8
                c-0.7,0.7-0.8,1.8-0.3,2.4l2.1,2.1C6.2,49.1,7.3,49,8,48.2L48.2,8C49,7.3,49.1,6.2,48.5,5.6z"/>
              <path d="M48.5,37.9L42.4,33c-1.4-1.1-3.4-1.2-4.8-0.1l-5.2,3.8c-0.6,0.5-1.5,0.4-2.1-0.2l-2.4-2.2l-8.5,8.5
                c6.1,4.1,13.4,6.8,21,7.2c1.1,0.1,2.2-0.4,3-1.2l5.2-5.2C50.5,42.1,50.4,39.3,48.5,37.9z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div style={{
        width: '320px',
        height: '100vh',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        borderLeft: '1px solid rgba(59, 130, 246, 0.1)',
        padding: '24px',
        overflowY: 'auto',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Meeting Attendees */}
        <div style={{ 
          borderBottom: '1px solid rgba(59, 130, 246, 0.1)', 
          paddingBottom: '24px', 
          marginBottom: '24px' 
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '20px' 
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#22c55e',
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }}></div>
            <h3 style={{ 
              color: 'white', 
              fontSize: '18px', 
              fontWeight: '700', 
              margin: '0',
              letterSpacing: '-0.025em'
            }}>
              Meeting Attendees
          </h3>
            <div style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: '#60a5fa',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              {room ? room.numParticipants : participants.length + 1}
            </div>
          </div>
          
          {/* Current User */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
            borderRadius: '12px',
            marginBottom: '12px',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: '700',
              color: 'white',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
            }}>
              Y
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ 
                color: 'white', 
                fontSize: '15px', 
                fontWeight: '600',
                marginBottom: '4px'
              }}>
                You (Host)
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                fontSize: '12px',
                color: '#94a3b8'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    backgroundColor: isVideoEnabled ? '#22c55e' : '#ef4444',
                    borderRadius: '50%'
                  }}></div>
                  Video
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    backgroundColor: isAudioEnabled ? '#22c55e' : '#ef4444',
                    borderRadius: '50%'
                  }}></div>
                  Audio
                </div>
              </div>
            </div>
          </div>
          
          {/* Remote Participants */}
          {participants.map((participant, index) => (
            <div key={participant.identity} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px',
              background: participant.identity === 'hero-bot' 
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%)',
              borderRadius: '12px',
              marginBottom: '12px',
              border: participant.identity === 'hero-bot' 
                ? '1px solid rgba(59, 130, 246, 0.2)'
                : '1px solid rgba(245, 158, 11, 0.2)',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: participant.identity === 'hero-bot' 
                  ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '700',
                color: 'white',
                boxShadow: participant.identity === 'hero-bot' 
                  ? '0 4px 12px rgba(59, 130, 246, 0.3)'
                  : '0 4px 12px rgba(245, 158, 11, 0.3)'
              }}>
                {participant.identity === 'hero-bot' ? '🤖' : participant.identity.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  color: 'white', 
                  fontSize: '15px', 
                  fontWeight: '600',
                  marginBottom: '4px'
                }}>
                  {participant.identity === 'hero-bot' ? 'Hero AI Assistant' : `Participant ${index + 1}`}
                </div>
                <div style={{ 
                  color: '#94a3b8', 
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {participant.identity === 'hero-bot' ? 'AI Assistant' : 'Online'}
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
      
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { 
            opacity: 1; 
            transform: scale(1);
          }
          50% { 
            opacity: 0.5; 
            transform: scale(1.1);
          }
        }
        
        @keyframes fadeIn {
          from { 
            opacity: 0; 
            transform: translateY(20px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        @keyframes slideIn {
          from { 
            opacity: 0; 
            transform: translateX(-20px); 
          }
          to { 
            opacity: 1; 
            transform: translateX(0); 
          }
        }
        
        .meeting-container {
          animation: fadeIn 0.6s ease-out;
        }
        
        .video-area {
          animation: slideIn 0.8s ease-out;
        }
        
        .sidebar {
          animation: slideIn 1s ease-out;
        }
      `}</style>
    </div>
  );
}
