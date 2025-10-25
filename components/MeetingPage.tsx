'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, RemoteParticipant, RemoteTrack, Track, TrackPublication, createLocalVideoTrack, createLocalAudioTrack, LocalTrack, Participant } from 'livekit-client';
import ChatPanel, { ChatMessage } from './ChatPanel';
import { createSTTService, STTService, STTResult } from '../services/stt';
import NameInputModal from './NameInputModal';
import ParticipantTile from './ParticipantTile';
import { 
  HiChevronLeft, 
  HiChevronRight, 
  HiUsers, 
  HiDocumentText, 
  HiChatAlt2, 
  HiCog,
  HiMicrophone,
  HiVolumeUp
} from 'react-icons/hi';

interface MeetingPageProps {
  roomName: string;
}

export default function MeetingPage({ roomName }: MeetingPageProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [sttProvider, setSttProvider] = useState<'webspeech' | 'deepgram'>('webspeech');
  const [ttsProvider, setTtsProvider] = useState<'elevenlabs' | 'gtts' | 'edgetts'>('edgetts');
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalTrack | null>(null);
  const [showNameModal, setShowNameModal] = useState(true);
  const [participantName, setParticipantName] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('');
  const [audioLevels, setAudioLevels] = useState<Map<string, number>>(new Map());
  const [isHeroSpeaking, setIsHeroSpeaking] = useState(false);
  
  // Audio queuing system
  interface QueuedResponse {
    id: string;
    text: string;
    audioBuffer: string; // base64 encoded
    timestamp: number;
    duration: number;
  }
  
  const [audioQueue, setAudioQueue] = useState<QueuedResponse[]>([]);
  const [isPlayingQueue, setIsPlayingQueue] = useState(false);
  const currentPlayingRef = useRef<string | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentLiveKitTrackRef = useRef<MediaStreamTrack | null>(null);
  const isHeroSpeakingRef = useRef(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Interruption phrases - more flexible patterns
  const interruptionPhrases = [
    /\b(ok|okay|got it|stop|enough|that's enough|thank you|thanks)\b/i,
    /\b(stop talking|be quiet|shut up|cut it out)\b/i,
    /\b(interrupt|skip)\b/i,
    /\b(ok|stop)\s+(latest|funny|ladies)\b/i, // Handle cases like "ok latest", "stop funny"
    /\b(that's|that is)\s+(enough|good|fine)\b/i
  ];
  const videoRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sttServiceRef = useRef<STTService | null>(null);
  const messageIdCounter = useRef<number>(0);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  
  // Refs to avoid stale closures in callbacks
  const roomRef = useRef<Room | null>(null);
  const participantNameRef = useRef<string>('');
  const orgNameRef = useRef<string>('');
  const ttsProviderRef = useRef<'elevenlabs' | 'gtts' | 'edgetts'>('edgetts');
  const sttProviderRef = useRef<'webspeech' | 'deepgram'>('webspeech');
  
  // Hero query accumulation - per participant using Map
  // Each participant gets their own accumulator to prevent interference
  const heroQueryAccumulators = useRef<Map<string, {
    isAccumulating: boolean;
    messages: string[];
    startTime: number;
    timeout: NodeJS.Timeout | null;
  }>>(new Map());

  // Helper to get or create accumulator for current participant
  const getAccumulator = () => {
    const participantId = participantName || 'local';
    if (!heroQueryAccumulators.current.has(participantId)) {
      heroQueryAccumulators.current.set(participantId, {
        isAccumulating: false,
        messages: [],
        startTime: 0,
        timeout: null
      });
    }
    return heroQueryAccumulators.current.get(participantId)!;
  };

  // Audio queue management functions
  const addToAudioQueue = (response: QueuedResponse) => {
    console.log('🎵 [QUEUE] Adding response to audio queue:', response.id);
    setAudioQueue(prev => {
      const newQueue = [...prev, response];
      console.log('🎵 [QUEUE] New queue length:', newQueue.length);
      
      // Start playing if not already playing (check ref for current state)
      if (!isHeroSpeakingRef.current) {
        console.log('🎵 [QUEUE] Starting playback (not currently playing)');
        // Use setTimeout to ensure state is updated before calling playNextInQueue
        setTimeout(() => {
          playNextInQueue(newQueue);
        }, 0);
      } else {
        console.log('🎵 [QUEUE] Already playing, item added to queue');
      }
      
      return newQueue;
    });
  };

  const playNextInQueue = async (currentQueue?: QueuedResponse[]) => {
    // Use provided queue or current state
    const queueToUse = currentQueue || audioQueue;
    
    if (queueToUse.length === 0) {
      console.log('🎵 [QUEUE] No more items in queue');
      setIsPlayingQueue(false);
      setIsHeroSpeaking(false);
      isHeroSpeakingRef.current = false;
      return;
    }

    const nextResponse = queueToUse[0];
    console.log('🎵 [QUEUE] Playing next response:', nextResponse.id);
    
    setIsPlayingQueue(true);
    setIsHeroSpeaking(true);
    isHeroSpeakingRef.current = true;
    currentPlayingRef.current = nextResponse.id;

    try {
      // Initialize audio context if not already done
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      const audioData = Uint8Array.from(atob(nextResponse.audioBuffer), c => c.charCodeAt(0));
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
      
      // Stop any currently playing audio
      if (currentAudioSourceRef.current) {
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current.disconnect();
      }
      
      // Create new audio source
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      
      // Try to broadcast via LiveKit if room is available
      const currentRoom = roomRef.current;
      if (currentRoom && currentRoom.state === 'connected') {
        try {
          // Create a MediaStreamDestination to capture audio
          const destination = audioContextRef.current.createMediaStreamDestination();
          source.connect(destination);
          source.connect(audioContextRef.current.destination); // Also play locally
          
          // Get audio track from the MediaStream
          const audioTrack = destination.stream.getAudioTracks()[0];
          
          if (audioTrack) {
            console.log('🎵 [QUEUE] Broadcasting audio via LiveKit:', nextResponse.id);
            
            // Store the LiveKit track reference for immediate stopping
            currentLiveKitTrackRef.current = audioTrack;
            
            // Publish audio track to LiveKit so all participants can hear
            const publication = await currentRoom.localParticipant.publishTrack(audioTrack, {
              name: 'hero-tts-audio',
              source: 'microphone' as any, // Use microphone source for compatibility
            });
            
            console.log('✅ [QUEUE] Audio published to LiveKit:', publication.trackSid);
            
            // Force enable the track
            audioTrack.enabled = true;
            
            // Start playback
            source.start();
            console.log('🔍 [QUEUE] Audio source started, storing reference');
            currentAudioSourceRef.current = source;
            
            // Clean up after playback
            source.onended = async () => {
              console.log('🧹 [QUEUE] Cleaning up LiveKit track:', nextResponse.id);
              try {
                await currentRoom.localParticipant.unpublishTrack(audioTrack);
                audioTrack.stop();
                currentLiveKitTrackRef.current = null;
                
                // Remove completed item from queue and play next
                setAudioQueue(prev => {
                  const updatedQueue = prev.slice(1);
                  setTimeout(() => {
                    playNextInQueue(updatedQueue);
                  }, 100);
                  return updatedQueue;
                });
              } catch (cleanupError) {
                console.warn('⚠️ [QUEUE] Error cleaning up track:', cleanupError);
                
                // Still continue to next item
                setAudioQueue(prev => {
                  const updatedQueue = prev.slice(1);
                  setTimeout(() => {
                    playNextInQueue(updatedQueue);
                  }, 100);
                  return updatedQueue;
                });
              }
            };
            
            return; // Successfully started broadcasting
          }
        } catch (broadcastError) {
          console.warn('⚠️ [QUEUE] LiveKit broadcasting failed, falling back to local playback:', broadcastError);
        }
      }
      
      // Fallback to local playback only
      console.log('🎵 [QUEUE] Playing locally only:', nextResponse.id);
      source.connect(audioContextRef.current.destination);
      
      console.log('🔍 [QUEUE] Fallback - storing audio source reference');
      currentAudioSourceRef.current = source;
      
      // Handle audio completion
      source.onended = () => {
        console.log('🎵 [QUEUE] Audio playback completed:', nextResponse.id);
        
        // Remove completed item from queue and play next
        setAudioQueue(prev => {
          const updatedQueue = prev.slice(1);
          setTimeout(() => {
            playNextInQueue(updatedQueue);
          }, 100); // Small delay to prevent audio overlap
          return updatedQueue;
        });
      };
      
      // Start playback
      source.start();
      console.log('🎵 [QUEUE] Audio playback started:', nextResponse.id);
      
    } catch (error) {
      console.error('❌ [QUEUE] Error playing audio:', error);
      
      // Remove failed item and try next
      setAudioQueue(prev => {
        const updatedQueue = prev.slice(1);
        setTimeout(() => {
          playNextInQueue(updatedQueue);
        }, 100);
        return updatedQueue;
      });
    }
  };

  const stopCurrentAudio = async () => {
    console.log('🛑 [INTERRUPT] Stopping current audio playback');
    console.log('🔍 [INTERRUPT] Debug - currentAudioSourceRef.current:', currentAudioSourceRef.current);
    console.log('🔍 [INTERRUPT] Debug - currentLiveKitTrackRef.current:', currentLiveKitTrackRef.current);
    console.log('🔍 [INTERRUPT] Debug - isHeroSpeakingRef.current:', isHeroSpeakingRef.current);
    
    // Stop current audio source immediately
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current.disconnect();
        currentAudioSourceRef.current = null;
        console.log('✅ [INTERRUPT] Audio source stopped immediately');
      } catch (error) {
        console.warn('⚠️ [INTERRUPT] Error stopping audio source:', error);
      }
    }
    
    // Stop LiveKit track immediately
    if (currentLiveKitTrackRef.current) {
      try {
        // First disable the track to stop audio immediately
        currentLiveKitTrackRef.current.enabled = false;
        console.log('✅ [INTERRUPT] LiveKit track disabled immediately');
        
        // Then stop the track
        currentLiveKitTrackRef.current.stop();
        console.log('✅ [INTERRUPT] LiveKit track stopped immediately');
        
        // Also try to unpublish it
        const currentRoom = roomRef.current;
        if (currentRoom && currentRoom.state === 'connected') {
          try {
            await currentRoom.localParticipant.unpublishTrack(currentLiveKitTrackRef.current);
            console.log('✅ [INTERRUPT] LiveKit track unpublished');
          } catch (unpublishError) {
            console.warn('⚠️ [INTERRUPT] Error unpublishing LiveKit track:', unpublishError);
          }
        }
        
        currentLiveKitTrackRef.current = null;
      } catch (error) {
        console.warn('⚠️ [INTERRUPT] Error stopping LiveKit track:', error);
      }
    }
    
    // Also try to suspend the entire audio context for immediate stop
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      try {
        audioContextRef.current.suspend();
        console.log('✅ [INTERRUPT] Audio context suspended for immediate stop');
        // Resume after a short delay to allow for future audio
        setTimeout(() => {
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
            console.log('✅ [INTERRUPT] Audio context resumed after interruption');
          }
        }, 100);
      } catch (error) {
        console.warn('⚠️ [INTERRUPT] Error suspending audio context:', error);
      }
    }
    
    // Try to unpublish any LiveKit tracks immediately
    const currentRoom = roomRef.current;
    if (currentRoom && currentRoom.state === 'connected') {
      try {
        // Find and unpublish hero-tts-audio tracks
        const heroTracks = Array.from(currentRoom.localParticipant.trackPublications.values())
          .filter(track => track.trackName === 'hero-tts-audio' && track.track);
        
        heroTracks.forEach(async (track) => {
          try {
            await currentRoom.localParticipant.unpublishTrack(track.track!);
            console.log('✅ [INTERRUPT] Unpublished LiveKit track:', track.trackSid);
          } catch (error) {
            console.warn('⚠️ [INTERRUPT] Error unpublishing track:', error);
          }
        });
      } catch (error) {
        console.warn('⚠️ [INTERRUPT] Error cleaning up LiveKit tracks:', error);
      }
    }
    
    // Clear the queue and reset states immediately
    setAudioQueue([]);
    setIsPlayingQueue(false);
    setIsHeroSpeaking(false);
    isHeroSpeakingRef.current = false;
    currentPlayingRef.current = null;
    
    console.log('✅ [INTERRUPT] Audio stopped and queue cleared');
  };

  const clearAudioQueue = () => {
    console.log('🧹 [QUEUE] Clearing audio queue');
    setAudioQueue([]);
    setIsPlayingQueue(false);
    setIsHeroSpeaking(false);
    isHeroSpeakingRef.current = false;
    currentPlayingRef.current = null;
  };

  const getQueueStatus = () => {
    return {
      queueLength: audioQueue.length,
      isPlaying: isPlayingQueue,
      currentPlaying: currentPlayingRef.current
    };
  };

  // Interruption detection function
  const checkForInterruption = (text: string): boolean => {
    const cleanText = text.trim().toLowerCase();
    console.log('🔍 [INTERRUPT] Checking text for interruption phrases:', cleanText);
    
    for (const phrase of interruptionPhrases) {
      if (phrase.test(cleanText)) {
        console.log('🛑 [INTERRUPT] Interruption phrase detected:', text, 'matched pattern:', phrase);
        return true;
      }
    }
    
    console.log('✅ [INTERRUPT] No interruption phrases found in:', cleanText);
    return false;
  };

  // Keep refs in sync with state to avoid stale closures
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    participantNameRef.current = participantName;
  }, [participantName]);

  useEffect(() => {
    orgNameRef.current = orgName;
  }, [orgName]);

  useEffect(() => {
    ttsProviderRef.current = ttsProvider;
    console.log('🔄 [TTS-REF] TTS provider ref updated to:', ttsProvider);
  }, [ttsProvider]);

  useEffect(() => {
    sttProviderRef.current = sttProvider;
    console.log('🔄 [STT-REF] STT provider ref updated to:', sttProvider);
  }, [sttProvider]);

  useEffect(() => {
    // Don't initialize until we have participant name
    if (!participantName) {
      console.log('⏸️ [INIT] Waiting for participant name...');
      return;
    }

    // Initialize STT service
    try {
      sttServiceRef.current = createSTTService(sttProvider);
      console.log(`🎤 [STT] STT service initialized with provider: ${sttProvider}`);
    } catch (error) {
      console.error('❌ [STT] Failed to initialize STT service:', error);
    }

    initializeRoom();
    return () => {
      if (room) {
        room.disconnect();
      }
      if (sttServiceRef.current) {
        sttServiceRef.current.stopTranscription();
      }
      // Clean up all hero query accumulator timeouts
      const currentAccumulators = heroQueryAccumulators.current;
      if (currentAccumulators) {
        currentAccumulators.forEach((accumulator, participantId) => {
          if (accumulator.timeout) {
            clearTimeout(accumulator.timeout);
          }
        });
        currentAccumulators.clear();
      }
    };
  }, [roomName, participantName]);

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
      console.log(`👤 [TOKEN] Participant name: ${participantName}`);
      const response = await fetch('/api/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomName, participantName }),
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
          simulcast: true,  // Enable adaptive bitrate
          videoCodec: 'h264',
          // VideoBitrate: 500000,  // 500kbps max bitrate
        }
      });

      // STEP 4: Set up comprehensive event listeners with detailed logging
      setupRoomEventListeners(newRoom);
      setupAudioLevelMonitoring(newRoom);

      // STEP 5: PRE-CREATE tracks before connection
      console.log('🎥 [TRACKS] Pre-creating media tracks...');
      let localVideo: LocalTrack, localAudio: LocalTrack;
      
      try {
        // Create tracks in parallel for faster initialization (OPTIMIZED)
        [localVideo, localAudio] = await Promise.all([
          createLocalVideoTrack({
            resolution: {
              width: 640,
              height: 480
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

  // Calculate grid layout based on participant count
  const getGridLayout = (participantCount: number) => {
    if (participantCount === 1) return { cols: 1, rows: 1 };
    if (participantCount === 2) return { cols: 2, rows: 1 };
    if (participantCount <= 4) return { cols: 2, rows: 2 };
    if (participantCount <= 6) return { cols: 3, rows: 2 };
    if (participantCount <= 9) return { cols: 3, rows: 3 };
    return { cols: 4, rows: Math.ceil(participantCount / 4) };
  };

  // Setup audio level monitoring for all participants
  const setupAudioLevelMonitoring = (newRoom: Room) => {
    console.log('🎵 [AUDIO-LEVEL] Setting up audio level monitoring...');
    
    const monitorParticipant = (participant: Participant) => {
      // Listen for audio track publications
      const updateAudioLevel = () => {
        const audioTracks = Array.from(participant.audioTrackPublications.values());
        if (audioTracks.length > 0 && audioTracks[0].track) {
          // Use a simple interval to check speaking status
          const interval = setInterval(() => {
            const isSpeaking = !audioTracks[0].isMuted && audioTracks[0].track;
            const level = isSpeaking ? 0.5 : 0; // Simple binary level
            
            setAudioLevels(prev => {
              const updated = new Map(prev);
              updated.set(participant.identity, level);
              return updated;
            });
          }, 200);

          // Store interval for cleanup
          (participant as any).audioMonitorInterval = interval;
        }
      };

      // Initial check
      updateAudioLevel();

      // Monitor track published events
      participant.on(RoomEvent.TrackPublished, () => {
        updateAudioLevel();
      });
    };

    // Monitor local participant
    monitorParticipant(newRoom.localParticipant);

    // Monitor existing remote participants
    newRoom.remoteParticipants.forEach(participant => {
      monitorParticipant(participant);
    });

    // Monitor new participants that join
    newRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      monitorParticipant(participant);
    });

    // Cleanup on disconnect
    newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if ((participant as any).audioMonitorInterval) {
        clearInterval((participant as any).audioMonitorInterval);
      }
    });

    console.log('✅ [AUDIO-LEVEL] Audio level monitoring setup complete');
  };

  const setupRoomEventListeners = (newRoom: Room) => {
    console.log('🎧 [EVENTS] Setting up room event listeners...');
    
    // Set up data channel for Hero message and transcript broadcasting
    newRoom.on(RoomEvent.DataReceived, async (payload: Uint8Array, participant?: RemoteParticipant) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        console.log('📨 [DATA] Received data from', participant?.identity || 'unknown:', data);
        
        if (data.type === 'hero_message') {
          console.log('🤖 [HERO] Broadcasting Hero message to all participants');
          addMessage({
            id: data.messageId,
            text: data.text,
            timestamp: data.timestamp,
            isHero: true
          });
          
          // Set Hero speaking state
          setIsHeroSpeaking(true);
          setAudioLevels(prev => {
            const updated = new Map(prev);
            updated.set('hero-bot', 0.8);
            return updated;
          });
          
          // Estimate speaking duration (characters / 15 = seconds, rough estimate)
          const estimatedDuration = Math.max(3000, (data.text.length / 15) * 1000);
          
          setTimeout(() => {
            setIsHeroSpeaking(false);
            setAudioLevels(prev => {
              const updated = new Map(prev);
              updated.set('hero-bot', 0);
              return updated;
            });
          }, estimatedDuration);
        } else if (data.type === 'transcript') {
          console.log('📝 [TRANSCRIPT] Received transcript from another participant');
          // Pass false to prevent re-broadcasting (avoid infinite loop)
          await addTranscript({
            id: data.messageId,
            text: data.text,
            speaker: data.speaker,
            timestamp: data.timestamp,
            isTranscript: true
          }, false);  // Don't re-broadcast!
        } else if (data.type === 'stt_provider_change') {
          console.log('\n🔄 [PROVIDER-SYNC] === STT PROVIDER CHANGE RECEIVED ===');
          console.log('📨 [PROVIDER-SYNC] From participant:', participant?.identity || 'unknown');
          console.log('📨 [PROVIDER-SYNC] Participant name:', data.changedBy);
          console.log('📨 [PROVIDER-SYNC] New provider:', data.provider);
          console.log('📨 [PROVIDER-SYNC] Current local provider:', sttProvider);
          console.log('📨 [PROVIDER-SYNC] Room state:', roomRef.current?.state || 'null');
          
          // Update local provider to match
          if (data.provider !== sttProvider) {
            console.log(`📡 [PROVIDER-SYNC] ⚠️ MISMATCH DETECTED - Syncing STT provider: ${sttProvider} → ${data.provider}`);
            await handleSttProviderSwitch(data.provider, false); // false = don't re-broadcast
            console.log('✅ [PROVIDER-SYNC] STT sync complete\n');
          } else {
            console.log('✅ [PROVIDER-SYNC] STT provider already matches:', data.provider);
            console.log('✅ [PROVIDER-SYNC] No action needed\n');
          }
        } else if (data.type === 'tts_provider_change') {
          console.log('\n🔄 [PROVIDER-SYNC] === TTS PROVIDER CHANGE RECEIVED ===');
          console.log('📨 [PROVIDER-SYNC] From participant:', participant?.identity || 'unknown');
          console.log('📨 [PROVIDER-SYNC] Participant name:', data.changedBy);
          console.log('📨 [PROVIDER-SYNC] New provider:', data.provider);
          console.log('📨 [PROVIDER-SYNC] Current local provider:', ttsProvider);
          console.log('📨 [PROVIDER-SYNC] Room state:', roomRef.current?.state || 'null');
          
          // Update local provider to match
          if (data.provider !== ttsProvider) {
            console.log(`📡 [PROVIDER-SYNC] ⚠️ MISMATCH DETECTED - Syncing TTS provider: ${ttsProvider} → ${data.provider}`);
            await handleTtsProviderSwitch(data.provider, false); // false = don't re-broadcast
            console.log('✅ [PROVIDER-SYNC] TTS sync complete\n');
          } else {
            console.log('✅ [PROVIDER-SYNC] TTS provider already matches:', data.provider);
            console.log('✅ [PROVIDER-SYNC] No action needed\n');
          }
        }
      } catch (error) {
        console.warn('⚠️ [DATA] Failed to parse received data:', error);
      }
    });
    
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
            id: generateMessageId(),
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
          console.log(`🎵 [AUDIO-TRACK] Processing audio track from ${participant.identity}`);
          console.log(`🎵 [AUDIO-TRACK] Track name: ${publication.trackName}, Source: ${track.source}`);
          
          // Check if this is Hero's TTS audio by track name (published by any participant)
          if (publication.trackName === 'hero-tts-audio') {
            console.log('🤖 [HERO-AUDIO] Hero TTS audio track detected!');
            console.log('🤖 [HERO-AUDIO] Published by:', participant.identity);
            console.log('🤖 [HERO-AUDIO] Creating dedicated audio element for playback...');
            
            // Create a dedicated audio element for Hero's TTS
            const heroAudioElement = document.createElement('audio');
            heroAudioElement.autoplay = true;
            heroAudioElement.volume = 1.0;
            heroAudioElement.setAttribute('data-hero-audio', 'true');
            heroAudioElement.setAttribute('data-from-participant', participant.identity);
            
            // Attach Hero's audio track
            track.attach(heroAudioElement);
            
            console.log('✅ [HERO-AUDIO] Hero TTS audio element created and attached');
            console.log('✅ [HERO-AUDIO] All participants in the room should now hear Hero speaking!');
            
            // Play the audio with retry logic
            const playHeroAudio = async (attempt = 1) => {
              try {
                await heroAudioElement.play();
                console.log('🔊 [HERO-AUDIO] Hero audio playing successfully!');
              } catch (playError) {
                console.warn(`⚠️ [HERO-AUDIO] Play attempt ${attempt} blocked:`, playError);
                if (attempt < 3) {
                  // User interaction might be needed - retry with delay
                  setTimeout(() => playHeroAudio(attempt + 1), 200);
                } else {
                  console.error('❌ [HERO-AUDIO] Autoplay failed after 3 attempts. User interaction may be needed.');
                }
              }
            };
            
            playHeroAudio();
            
            // Clean up when track ends
            track.once('ended', () => {
              console.log('🧹 [HERO-AUDIO] Hero audio track ended, cleaning up...');
              track.detach(heroAudioElement);
              heroAudioElement.remove();
              console.log('✅ [HERO-AUDIO] Hero audio element removed');
            });
            
          } else if (participant.identity === 'hero-bot') {
            // Hero bot's microphone (if Hero actually joins as a participant)
            console.log('🤖 [HERO-MIC] Hero bot microphone audio detected');
            const audioElement = track.attach();
            if (audioRef.current) {
              audioRef.current.srcObject = audioElement.srcObject;
              audioRef.current.play().catch(e => console.warn('Audio autoplay blocked:', e));
            }
          } else {
            // Regular participant audio - attach to shared audio ref
            const audioElement = track.attach();
            if (audioRef.current) {
              audioRef.current.srcObject = audioElement.srcObject;
              audioRef.current.play().catch(e => console.warn('Audio autoplay blocked:', e));
              console.log('✅ [TRACK] Remote audio attached to UI');
              console.log(`🧪 [TEST] USER CAN NOW HEAR: ${participant.identity}'s audio feed`);
            }
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
    // Reduce verbosity: keep a concise header only
    console.log(`🧪 [TEST] Start - ${testRoom.localParticipant.identity} @ ${new Date().toISOString()}`);
    
    // Test 1: Local Media Status
    const localVideoTracks = Array.from(testRoom.localParticipant.videoTrackPublications.values());
    const localAudioTracks = Array.from(testRoom.localParticipant.audioTrackPublications.values());
    console.log(`🧪 [TEST] Local: video=${localVideoTracks.length > 0 ? 'on' : 'off'}, audio=${localAudioTracks.length > 0 ? 'on' : 'off'}`);
    
    // Test 2: Local Video Element Status
    if (localVideoRef.current) {
      const localVideo = localVideoRef.current;
      console.log(`🧪 [TEST] Local video: ${localVideo.srcObject ? 'stream' : 'no-stream'}, ${localVideo.videoWidth}x${localVideo.videoHeight}`);
      
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
    console.log(`🧪 [TEST] Remote participants: ${remoteParticipants.length}`);
    
    remoteParticipants.forEach((participant, index) => {
      const participantVideoTracks = Array.from(participant.videoTrackPublications.values());
      const participantAudioTracks = Array.from(participant.audioTrackPublications.values());
      
      console.log(`🧪 [TEST] P${index + 1} ${participant.identity}: video=${participantVideoTracks.length > 0 ? 'on' : 'off'}, audio=${participantAudioTracks.length > 0 ? 'on' : 'off'}, quality=${participant.connectionQuality}`);
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
    console.log(`🧪 [TEST] Remote video feeds visible: ${remoteVideoElements.length}`);
    remoteVideoElements.forEach((videoEl, index) => {
      console.log(`🧪 [TEST] Remote video ${index + 1}: ${videoEl.offsetWidth}x${videoEl.offsetHeight} (${videoEl.getAttribute('data-participant')})`);
    });
    
    console.log(`🧪 [TEST] Complete`);
    
    // Display test results in UI
    const testSummary = {
      localVideoPublished: localVideoTracks.length > 0,
      localAudioPublished: localAudioTracks.length > 0,
      localPreviewVisible: localVideoEl && localVideoEl!.offsetWidth > 0,
      remoteParticipantsCount: remoteParticipants.length,
      remoteVideoFeedsVisible: remoteVideoElements.length
    };
    
      console.log(`🧪 [TEST] Summary:`, testSummary);
      return testSummary;
    };

    // Make test function globally available for manual testing
    (window as any).runVisibilityTest = () => runBidirectionalVisibilityTest();
    
    // Make speech recognition restart function globally available
    (window as any).restartSpeechRecognition = () => {
      console.log('🔄 [MANUAL] Manual speech recognition restart requested...');
      if (room && room.state === 'connected' && sttServiceRef.current) {
        try {
          sttServiceRef.current.stopTranscription();
          setTimeout(() => {
            startTranscription(room);
          }, 1000);
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
      
      // Verbose heartbeat disabled in production; enable when diagnosing track attach issues
      // console.log(`🔍 [MISSED-TRACK-CHECK] Checking for missed track subscriptions...`);
      
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
                  // Don't clear existing videos, just append the missing one
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

  // Generate unique message ID
  const generateMessageId = (): string => {
    messageIdCounter.current += 1;
    return `${Date.now()}-${messageIdCounter.current}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };
  
  const addTranscript = async (message: ChatMessage, shouldBroadcast: boolean = true) => {
    setTranscript(prev => [...prev, message]);
    // Also add to general messages for context
    addMessage({ ...message, isTranscript: true });
    
    // Only broadcast if this is from the local participant (not from receiving a broadcast)
    // Use refs to avoid stale closure issues
    const currentRoom = roomRef.current;
    const currentParticipantName = participantNameRef.current;
    
    if (shouldBroadcast && currentRoom && currentRoom.state === 'connected') {
      const speakerName = currentParticipantName || currentRoom?.localParticipant?.name || 'Participant';
      await broadcastTranscript(message.text, speakerName, message.id);
      console.log(`📤 [TRANSCRIPT] Broadcasting to all participants: "${message.text}" by ${speakerName}`);
    } else if (!shouldBroadcast) {
      console.log(`📥 [TRANSCRIPT] Received broadcast, not re-broadcasting: "${message.text}"`);
    } else {
      console.warn(`⚠️ [TRANSCRIPT] Cannot broadcast - room state: ${currentRoom?.state || 'null'}, shouldBroadcast: ${shouldBroadcast}`);
    }
  };

  // Add system transcript (no broadcasting)
  const addSystemTranscript = (message: ChatMessage) => {
    setTranscript(prev => [...prev, message]);
    addMessage({ ...message, isTranscript: true });
  };

  // Auto-scroll transcript to bottom on new entries
  useEffect(() => {
    if (transcriptContainerRef.current) {
      try {
        transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
      } catch {}
    }
  }, [transcript.length]);
  
  // Store speech in context via API
  const storeSpeechInContext = async (speechText: string) => {
    const currentParticipantName = participantNameRef.current;
    const currentOrgName = orgNameRef.current;
    try {
      await fetch('/api/store-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          speech: speechText,
          speaker: currentParticipantName || 'user',
          orgName: currentOrgName || undefined
        }),
      });
      console.log(`📝 [CONTEXT] Stored speech in context for ${currentParticipantName}:`, speechText.substring(0, 50) + '...');
    } catch (error) {
      console.warn('⚠️ [CONTEXT] Failed to store speech in context:', error);
    }
  };

  // Broadcast Hero message to all participants via LiveKit data channel
  const broadcastHeroMessage = async (text: string, messageId: string) => {
    const currentRoom = roomRef.current;
    if (!currentRoom || currentRoom.state !== 'connected') {
      console.warn('⚠️ [BROADCAST] No room available for broadcasting. Room:', currentRoom?.state || 'null');
      return;
    }

    try {
      const messageData = {
        type: 'hero_message',
        text: text,
        messageId: messageId,
        timestamp: Date.now()
      };

      const payload = new TextEncoder().encode(JSON.stringify(messageData));
      await currentRoom.localParticipant.publishData(payload, { reliable: true });
      console.log('📤 [BROADCAST] Hero message broadcasted to all participants:', text);
    } catch (error) {
      console.error('❌ [BROADCAST] Failed to broadcast Hero message:', error);
    }
  };

  // Broadcast transcript to all participants via LiveKit data channel
  const broadcastTranscript = async (text: string, speaker: string, messageId: string) => {
    const currentRoom = roomRef.current;
    if (!currentRoom || currentRoom.state !== 'connected') {
      console.warn('⚠️ [TRANSCRIPT-BROADCAST] No room available for broadcasting. Room:', currentRoom?.state || 'null');
      return;
    }

    try {
      const transcriptData = {
        type: 'transcript',
        text: text,
        speaker: speaker,
        messageId: messageId,
        timestamp: Date.now()
      };

      const payload = new TextEncoder().encode(JSON.stringify(transcriptData));
      await currentRoom.localParticipant.publishData(payload, { reliable: true });
      console.log('📤 [TRANSCRIPT-BROADCAST] Transcript broadcasted to all participants:', text, 'by', speaker);
    } catch (error) {
      console.error('❌ [TRANSCRIPT-BROADCAST] Failed to broadcast transcript:', error);
    }
  };

  // Broadcast STT provider change to all participants
  const broadcastSttProviderChange = async (provider: 'webspeech' | 'deepgram') => {
    const currentRoom = roomRef.current;
    const currentParticipantName = participantNameRef.current;
    
    if (!currentRoom || currentRoom.state !== 'connected') {
      console.warn('⚠️ [PROVIDER-BROADCAST] No room available for broadcasting STT provider change');
      return;
    }

    try {
      const providerData = {
        type: 'stt_provider_change',
        provider: provider,
        changedBy: currentParticipantName || 'Unknown',
        timestamp: Date.now()
      };

      const payload = new TextEncoder().encode(JSON.stringify(providerData));
      await currentRoom.localParticipant.publishData(payload, { reliable: true });
      console.log('📡 [PROVIDER-BROADCAST] STT provider change broadcasted to all participants:', provider);
    } catch (error) {
      console.error('❌ [PROVIDER-BROADCAST] Failed to broadcast STT provider change:', error);
    }
  };

  // Broadcast TTS provider change to all participants
  const broadcastTtsProviderChange = async (provider: 'elevenlabs' | 'gtts' | 'edgetts') => {
    const currentRoom = roomRef.current;
    const currentParticipantName = participantNameRef.current;
    
    if (!currentRoom || currentRoom.state !== 'connected') {
      console.warn('⚠️ [PROVIDER-BROADCAST] No room available for broadcasting TTS provider change');
      return;
    }

    try {
      const providerData = {
        type: 'tts_provider_change',
        provider: provider,
        changedBy: currentParticipantName || 'Unknown',
        timestamp: Date.now()
      };

      const payload = new TextEncoder().encode(JSON.stringify(providerData));
      await currentRoom.localParticipant.publishData(payload, { reliable: true });
      console.log('📡 [PROVIDER-BROADCAST] TTS provider change broadcasted to all participants:', provider);
    } catch (error) {
      console.error('❌ [PROVIDER-BROADCAST] Failed to broadcast TTS provider change:', error);
    }
  };
  
  
  const startTranscription = async (room: Room) => {
    try {
      if (!sttServiceRef.current) {
        console.error('❌ [STT] STT service not initialized');
        addSystemTranscript({
          id: generateMessageId(),
          text: '❌ Speech recognition service not available. Please refresh the page.',
          speaker: 'system',
          timestamp: Date.now(),
          isTranscript: true
        });
        return;
      }

      console.log('🎤 [STT] Starting transcription service...');
      
      // Set up transcript callback
      sttServiceRef.current.onTranscript(async (result: STTResult) => {
        console.log('🎤 [STT] Transcript received:', result.text);
        
        // Check for interruption phrases first
        if (checkForInterruption(result.text)) {
          console.log('🛑 [INTERRUPT] Interruption detected, stopping Hero audio');
          await stopCurrentAudio();
          
          // Add interruption message to transcript
          await addTranscript({
            id: generateMessageId(),
            text: '🛑 Hero audio stopped',
            speaker: 'system',
            timestamp: result.timestamp,
            isTranscript: true
          });
          
          return; // Don't process further
        }
        
        // Use participant name (not identity with suffix) for speaker identification
        // Use refs to avoid stale closure
        const currentParticipantName = participantNameRef.current;
        const speakerName = currentParticipantName || room?.localParticipant?.name || 'Participant';
        
        await addTranscript({
          id: generateMessageId(),
          text: result.text,
          speaker: speakerName,
          timestamp: result.timestamp,
          isTranscript: true
        });

        // Store all speech in context (not just Hero-triggered messages)
        storeSpeechInContext(result.text);

        // Check for Hero/Hiro trigger phrases (case insensitive)
        const hasHeroTrigger = result.text.toLowerCase().match(/(hey|hi|hello)\s+(hero|hiro)|^\s*(hero|hiro)\b/);
        console.log('🔍 [TRIGGER] Checking for Hero/Hiro trigger in:', result.text);
        
        if (hasHeroTrigger) {
          console.log('✅ [TRIGGER] Hero/Hiro trigger detected! Starting accumulation...');
          
          // Get this participant's accumulator
          const accumulator = getAccumulator();
          
          // Start accumulating mode
          accumulator.isAccumulating = true;
          accumulator.messages = [result.text];
          accumulator.startTime = Date.now();
          
          // Clear any existing timeout
          if (accumulator.timeout) {
            clearTimeout(accumulator.timeout);
          }
          
          // Set 2-second timeout to process accumulated query
          accumulator.timeout = setTimeout(() => {
            const fullQuery = accumulator.messages.join(' ');
            console.log('⏰ [ACCUMULATOR] 2-second pause detected. Processing accumulated query:', fullQuery);
            console.log('📝 [ACCUMULATOR] Total sentences collected:', accumulator.messages.length);
            
            handleHeroTrigger(fullQuery);
            
            // Reset accumulator
            accumulator.isAccumulating = false;
            accumulator.messages = [];
            accumulator.timeout = null;
          }, 2000); // 2-second pause
          
        } else {
          // Get this participant's accumulator
          const accumulator = getAccumulator();
          
          if (accumulator.isAccumulating) {
            // Continue accumulating if we're in accumulation mode
            const elapsed = Date.now() - accumulator.startTime;
            
            if (elapsed < 5000) { // Maximum 5 seconds of accumulation
              console.log('📝 [ACCUMULATOR] Adding to query:', result.text);
              accumulator.messages.push(result.text);
              
              // Reset the 2-second timeout
              if (accumulator.timeout) {
                clearTimeout(accumulator.timeout);
              }
              
              accumulator.timeout = setTimeout(() => {
                const fullQuery = accumulator.messages.join(' ');
                console.log('⏰ [ACCUMULATOR] 2-second pause detected. Processing accumulated query:', fullQuery);
                console.log('📝 [ACCUMULATOR] Total sentences collected:', accumulator.messages.length);
                
                handleHeroTrigger(fullQuery);
                
                // Reset accumulator
                accumulator.isAccumulating = false;
                accumulator.messages = [];
                accumulator.timeout = null;
              }, 2000); // 2-second pause
            } else {
              // Maximum accumulation time exceeded, process now
              console.log('⚠️ [ACCUMULATOR] Maximum 5-second accumulation time reached. Processing now...');
              const fullQuery = accumulator.messages.join(' ');
              
              handleHeroTrigger(fullQuery);
              
              // Reset accumulator
              accumulator.isAccumulating = false;
              accumulator.messages = [];
              if (accumulator.timeout) {
                clearTimeout(accumulator.timeout);
                accumulator.timeout = null;
              }
            }
          } else {
            console.log('❌ [TRIGGER] No Hero/Hiro trigger found in transcript');
          }
        }
      });

      // Set up interim result callback to keep accumulator alive and check for interruptions
      if (sttServiceRef.current.onInterimResult) {
        sttServiceRef.current.onInterimResult(async (interimText: string) => {
          console.log('🎤 [INTERIM] Interim result:', interimText);
          
          // Check for interruption phrases in interim results
          if (checkForInterruption(interimText)) {
            console.log('🛑 [INTERRUPT] Interruption phrase detected in interim result:', interimText);
            await stopCurrentAudio();
            
            // Add interruption message to transcript
            addTranscript({
              id: generateMessageId(),
              text: '🛑 Hero audio stopped',
              speaker: 'system',
              timestamp: Date.now(),
              isTranscript: true
            });
            
            return; // Don't process further
          }
          
          // Get this participant's accumulator
          const accumulator = getAccumulator();
          
          // If we're accumulating and receive interim results, reset the timeout
          if (accumulator.isAccumulating) {
            console.log('🔄 [ACCUMULATOR] Interim result detected, keeping accumulator alive:', interimText.substring(0, 50) + '...');
            
            // Clear existing timeout
            if (accumulator.timeout) {
              clearTimeout(accumulator.timeout);
            }
            
            // Reset 2-second timeout
            accumulator.timeout = setTimeout(() => {
              const fullQuery = accumulator.messages.join(' ');
              console.log('⏰ [ACCUMULATOR] 2-second pause detected after interim results. Processing accumulated query:', fullQuery);
              console.log('📝 [ACCUMULATOR] Total sentences collected:', accumulator.messages.length);
              
              handleHeroTrigger(fullQuery);
              
              // Reset accumulator
              accumulator.isAccumulating = false;
              accumulator.messages = [];
              accumulator.timeout = null;
            }, 2000); // 2-second pause
          }
        });
      }

      // Start transcription
      await sttServiceRef.current.startTranscription();
      
          addSystemTranscript({
            id: generateMessageId(),
        text: '🎤 Listening for speech... Say "Hey Hero" to activate the AI assistant.',
        speaker: 'system',
        timestamp: Date.now(),
        isTranscript: true
      });
      
            } catch (error) {
      console.error('❌ [STT] Error starting transcription:', error);
      addSystemTranscript({
        id: generateMessageId(),
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
    
    const currentOrgName = orgNameRef.current;
    const currentTtsProvider = ttsProviderRef.current; // Use ref to get current TTS provider
    
    console.log('🎵 [FRONTEND] TTS Provider being sent to Hero:', currentTtsProvider);
    
    try {
      console.log('🌐 [FRONTEND] Making API call to /api/hero-join...');
      
      const response = await fetch('/api/hero-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          message: transcript,
          ttsProvider: currentTtsProvider,
          orgName: currentOrgName
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
        
        // Strip markdown formatting from response but preserve bullet points
        let cleanResponse = data.response.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold formatting
        // Only remove italic formatting, not bullet points
        cleanResponse = cleanResponse.replace(/\*(?!\s)(.*?)(?!\s)\*/g, '$1'); // Remove italic formatting but preserve "* " bullets
        console.log('🧼 [FRONTEND] Cleaned response text:', cleanResponse);
        
        const messageId = generateMessageId();
        
        // Add Hero AI response to chat locally
        addMessage({
          id: messageId,
          text: cleanResponse,
          timestamp: Date.now(),
          isHero: true
        });

        // Broadcast Hero message to all participants
        await broadcastHeroMessage(cleanResponse, messageId);
        
        // Play TTS audio if available - use audio queue system
        if (data.audioBuffer) {
          console.log('🎵 [FRONTEND] === ADDING TO AUDIO QUEUE ===');
          console.log('🎵 [FRONTEND] Audio buffer size:', data.audioBuffer?.length || 0, 'characters (base64)');
          console.log('🎵 [FRONTEND] Audio duration:', data.duration, 'seconds');
          
          // Add to audio queue instead of playing immediately
          const queuedResponse: QueuedResponse = {
            id: messageId,
            text: cleanResponse,
            audioBuffer: data.audioBuffer,
            timestamp: Date.now(),
            duration: data.duration || 0
          };
          
          addToAudioQueue(queuedResponse);
          console.log('✅ [FRONTEND] Response added to audio queue');
        } else {
          if (!data.audioBuffer) {
            console.log('⚠️ [FRONTEND] No audio buffer provided in response');
          }
        }
      } else if (data.success && data.message) {
        console.log('💬 [FRONTEND] Debug message from API:', data.message);
        // Show debug message in transcript
        addTranscript({
          id: generateMessageId(),
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
        id: generateMessageId(),
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
      id: generateMessageId(),
      text: message,
      timestamp: Date.now(),
    });

    // Send message to backend for Hero bot processing
    const currentTtsProvider = ttsProviderRef.current;
    const currentOrgName = orgNameRef.current;
    
    console.log('🎵 [CHAT-HERO] TTS Provider for Hero:', currentTtsProvider);
    
    try {
      const response = await fetch('/api/hero-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          message,
          ttsProvider: currentTtsProvider,
          orgName: currentOrgName
        }),
      });

      const data = await response.json();
      console.log('Hero chat response:', data);
      
      if (data.success && data.response) {
        // Strip markdown formatting from response
        const cleanResponse = data.response.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        
        const messageId = generateMessageId();
        
        // Add Hero AI response to chat locally
        addMessage({
          id: messageId,
          text: cleanResponse,
          timestamp: Date.now(),
          isHero: true
        });

        // Broadcast Hero message to all participants
        await broadcastHeroMessage(cleanResponse, messageId);

        // Play TTS audio if available - broadcast to all participants
        if (data.audioBuffer) {
          if (!room) {
            console.warn('❌ [CHAT-AUDIO] Room not available for broadcasting');
            // Fallback to local playback only
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
              console.log('✅ [CHAT-AUDIO] Hero audio played locally (no room for broadcasting)');
            } catch (audioError) {
              console.warn('❌ [CHAT-AUDIO] Local audio playback failed:', audioError);
            }
          } else {
            console.log('🎵 [CHAT-AUDIO] === BROADCASTING TTS AUDIO TO ALL PARTICIPANTS ===');
            console.log('🎵 [CHAT-AUDIO] Audio buffer size:', data.audioBuffer?.length || 0, 'characters (base64)');
            console.log('🎵 [CHAT-AUDIO] Audio duration:', data.duration, 'seconds');
          
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
            
            // Create a MediaStreamDestination to capture the audio
            const destination = audioContextRef.current.createMediaStreamDestination();
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(destination);
            source.connect(audioContextRef.current.destination); // Also play locally
            
            // Get audio track from the MediaStream
            const audioTrack = destination.stream.getAudioTracks()[0];
            
            if (audioTrack) {
              console.log('🎵 [CHAT-AUDIO] Creating LiveKit audio track from TTS...');
              
              // Publish audio track to LiveKit so all participants can hear
              const publication = await room.localParticipant.publishTrack(audioTrack, {
                name: 'hero-tts-audio',
                source: 'microphone' as any, // Use microphone source for compatibility
              });
              
              console.log('✅ [CHAT-AUDIO] Hero TTS audio published to LiveKit!');
              console.log('✅ [CHAT-AUDIO] Publication details:', {
                trackSid: publication.trackSid,
                trackName: publication.trackName,
                source: publication.source,
                subscribed: publication.isSubscribed
              });
              
              // Force enable the track to ensure it's available to all participants
              audioTrack.enabled = true;
              console.log('✅ [CHAT-AUDIO] Audio track enabled for broadcasting');
              
              // Notify all participants about the Hero audio
              console.log('📢 [CHAT-AUDIO] Broadcasting Hero audio to', room.numParticipants, 'participants');
              
              // Start playback
              source.start();
              console.log('✅ [CHAT-AUDIO] Audio playback started and broadcasting!');
              
              // Clean up after playback
              source.onended = () => {
                console.log('🧹 [CHAT-AUDIO] Cleaning up Hero audio track...');
                room.localParticipant.unpublishTrack(audioTrack);
                console.log('✅ [CHAT-AUDIO] Hero audio track unpublished');
              };
            } else {
              console.warn('⚠️ [CHAT-AUDIO] No audio track found in MediaStream');
              // Fallback to local playback only
              source.start();
            }
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
        }
      } else if (data.success && data.message) {
        // Show debug message for chat
        addMessage({
          id: generateMessageId(),
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

  const handleSttProviderSwitch = async (newProvider: 'webspeech' | 'deepgram', shouldBroadcast: boolean = true) => {
    try {
      const currentParticipantName = participantNameRef.current;
      console.log('🔄 [STT] === SWITCHING STT PROVIDER ===');
      console.log('🔄 [STT] Initiated by:', shouldBroadcast ? currentParticipantName + ' (local)' : 'remote participant');
      console.log('🔄 [STT] Target provider:', newProvider);
      console.log('🔄 [STT] Should broadcast:', shouldBroadcast);
      
      // Stop current STT service more aggressively
      if (sttServiceRef.current) {
        console.log('🛑 [STT] Stopping current STT service...');
        await sttServiceRef.current.stopTranscription();
        
        // Additional cleanup for WebSpeech
        if (sttProvider === 'webspeech') {
          console.log('🧹 [STT] Additional WebSpeech cleanup...');
          // Force stop any remaining recognition instances
          if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
              try {
                const tempRecognition = new SpeechRecognition();
                tempRecognition.stop();
              } catch (e) {
                console.log('🧹 [STT] WebSpeech cleanup completed');
              }
            }
          }
        }
        
        console.log('✅ [STT] Current STT service stopped');
        
        // Wait a bit to ensure complete cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`🔄 [STT] Switching from ${sttProvider} to ${newProvider}`);
      
      setSttProvider(newProvider);
      
      // Wait for state update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create new STT service
      sttServiceRef.current = createSTTService(newProvider);
      console.log(`✅ [STT] Created new ${newProvider} service`);

      // Restart transcription if room is connected (use roomRef to avoid stale closure)
      const currentRoom = roomRef.current;
      console.log(`🔍 [STT] Checking room state for restart... Room exists: ${!!currentRoom}, State: ${currentRoom?.state || 'null'}`);
      
      if (currentRoom && currentRoom.state === 'connected') {
        console.log(`🎤 [STT] Restarting transcription with ${newProvider}...`);
        await startTranscription(currentRoom);
        console.log(`✅ [STT] Transcription restarted with ${newProvider}`);
      } else {
        console.error(`❌ [STT] Cannot restart - room not connected. Room: ${currentRoom ? 'exists' : 'null'}, State: ${currentRoom?.state || 'N/A'}`);
      }

      // Broadcast to other participants (only if this is a local change)
      if (shouldBroadcast) {
        console.log('📡 [STT] Broadcasting provider change to all participants...');
        await broadcastSttProviderChange(newProvider);
      } else {
        console.log('📥 [STT] Provider change received from remote - not re-broadcasting');
      }

      // Add notification to transcript
      const changeSource = shouldBroadcast ? currentParticipantName : 'another participant';
      addSystemTranscript({
        id: generateMessageId(),
        text: `🎤 ${changeSource} switched to ${newProvider === 'deepgram' ? 'Deepgram' : 'Web Speech'} STT`,
        speaker: 'system',
        timestamp: Date.now(),
        isTranscript: true
      });
      
      console.log('✅ [STT] === PROVIDER SWITCH COMPLETE ===');
    } catch (error) {
      console.error('❌ [STT] Error switching STT provider:', error);
      addSystemTranscript({
        id: generateMessageId(),
        text: `❌ Failed to switch STT provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
        speaker: 'system',
        timestamp: Date.now(),
        isTranscript: true
      });
    }
  };

  // Wrapper for UI-triggered STT provider toggle
  const toggleSTTProvider = async (newProvider?: 'webspeech' | 'deepgram') => {
    const targetProvider = newProvider || (sttProvider === 'webspeech' ? 'deepgram' : 'webspeech');
    await handleSttProviderSwitch(targetProvider, true); // true = broadcast to others
  };

  const handleTtsProviderSwitch = async (newProvider: 'elevenlabs' | 'gtts' | 'edgetts', shouldBroadcast: boolean = true) => {
    try {
      const currentParticipantName = participantNameRef.current;
      console.log('🔄 [TTS] === SWITCHING TTS PROVIDER ===');
      console.log('🔄 [TTS] Initiated by:', shouldBroadcast ? currentParticipantName + ' (local)' : 'remote participant');
      console.log('🔄 [TTS] Target provider:', newProvider);
      console.log('🔄 [TTS] Should broadcast:', shouldBroadcast);
      console.log(`🔄 [TTS] Switching from ${ttsProvider} to ${newProvider}`);
      
      setTtsProvider(newProvider);
      
      // Broadcast to other participants (only if this is a local change)
      if (shouldBroadcast) {
        console.log('📡 [TTS] Broadcasting provider change to all participants...');
        await broadcastTtsProviderChange(newProvider);
      } else {
        console.log('📥 [TTS] Provider change received from remote - not re-broadcasting');
      }
      
      // Add notification to transcript
      const changeSource = shouldBroadcast ? currentParticipantName : 'another participant';
      addSystemTranscript({
        id: generateMessageId(),
        text: `🎵 ${changeSource} switched to ${newProvider === 'elevenlabs' ? 'ElevenLabs' : newProvider === 'gtts' ? 'Google TTS' : 'Edge TTS'} TTS`,
        speaker: 'system',
        timestamp: Date.now(),
        isTranscript: true
      });
      
      console.log('✅ [TTS] === PROVIDER SWITCH COMPLETE ===');
    } catch (error) {
      console.error('❌ [TTS] Error switching TTS provider:', error);
      addSystemTranscript({
        id: generateMessageId(),
        text: `❌ Failed to switch TTS provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
        speaker: 'system',
        timestamp: Date.now(),
        isTranscript: true
      });
    }
  };

  // Wrapper for UI-triggered TTS provider toggle
  const toggleTTSProvider = async (newProvider?: 'elevenlabs' | 'gtts' | 'edgetts') => {
    const targetProvider = newProvider || (ttsProvider === 'elevenlabs' ? 'gtts' : ttsProvider === 'gtts' ? 'edgetts' : 'elevenlabs');
    await handleTtsProviderSwitch(targetProvider, true); // true = broadcast to others
  };

  const leaveMeeting = async () => {
    if (room) {
      await room.disconnect();
    }
    window.location.href = '/dashboard';
  };

  const handleNameSubmit = (name: string) => {
    console.log(`👤 [NAME] Participant name submitted: ${name}`);
    setParticipantName(name);
    
    // Get org name from localStorage (already normalized to lowercase)
    const storedOrgName = localStorage.getItem('hero_meeting_org') || '';
    setOrgName(storedOrgName);
    console.log(`🏢 [ORG] Organization: ${storedOrgName}`);
    
    setShowNameModal(false);
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
            onClick={() => window.location.href = '/dashboard'}
            className="btn btn-primary"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-container" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Name Input Modal */}
      <NameInputModal 
        isOpen={showNameModal} 
        onSubmit={handleNameSubmit}
      />
      
      {/* Main Video Area */}
      <div className="video-area" style={{ flex: 1, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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

        {/* Main Video Content - Grid Layout */}
        <div style={{
          position: 'relative',
          flex: 1,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '20px'
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
            opacity: 0.6,
            zIndex: 0
          }}></div>
          
          {/* Participants Grid */}
          {room && (() => {
            // Create virtual Hero participant
            const heroParticipant = {
              identity: 'hero-bot',
              name: 'Hero',
              trackPublications: new Map(),
              videoTrackPublications: new Map(),
              audioTrackPublications: new Map(),
              on: () => {},
              off: () => {}
            } as any;

            // Include Hero as a virtual participant
            const allParticipants = [room.localParticipant, heroParticipant, ...participants];
            const gridLayout = getGridLayout(allParticipants.length);
            
            // Set default audio level for Hero (listening state)
            if (!audioLevels.has('hero-bot')) {
              setTimeout(() => {
                setAudioLevels(prev => {
                  const updated = new Map(prev);
                  if (!updated.has('hero-bot')) {
                    updated.set('hero-bot', 0.1); // Low level for listening
                  }
                  return updated;
                });
              }, 100);
            }
            
            return (
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridLayout.cols}, 1fr)`,
                gridTemplateRows: `repeat(${gridLayout.rows}, 1fr)`,
                gap: '16px',
                width: '100%',
                height: '100%',
                maxWidth: '1600px',
                maxHeight: '900px',
                position: 'relative',
                zIndex: 1
              }}>
                {allParticipants.map((participant) => (
                  <ParticipantTile
                    key={participant.identity}
                    participant={participant}
                    isLocal={participant === room.localParticipant}
                    audioLevel={audioLevels.get(participant.identity) || 0}
                  />
                ))}
              </div>
            );
          })()}
          
          {/* Waiting message when no participants */}
          {participants.length === 0 && !room && (
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
                Connecting...
              </h2>
              <p style={{ 
                fontSize: '16px', 
                color: '#94a3b8',
                fontWeight: '500',
                lineHeight: '1.5'
              }}>
                Setting up your meeting room
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '20px',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderTop: '1px solid rgba(59, 130, 246, 0.1)'
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

        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          style={{
            position: 'fixed',
            right: isSidebarCollapsed ? '20px' : '340px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1000,
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            color: '#f1f5f9',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            backdropFilter: 'blur(8px)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.95)';
            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.4)';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
          }}
        >
          {isSidebarCollapsed ? <HiChevronLeft size={20} /> : <HiChevronRight size={20} />}
        </button>

        {/* Sidebar */}
        <div style={{
          width: isSidebarCollapsed ? '0px' : '320px',
          height: '100vh',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
          borderLeft: isSidebarCollapsed ? 'none' : '1px solid rgba(148, 163, 184, 0.1)',
          padding: isSidebarCollapsed ? '0px' : '24px',
          overflowY: 'auto',
          overflowX: 'hidden',
          backdropFilter: 'blur(12px)',
          flexShrink: 0,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: isSidebarCollapsed ? 0 : 1,
          boxShadow: isSidebarCollapsed ? 'none' : '-4px 0 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          {!isSidebarCollapsed && (
            <>
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
              {room ? (participants.filter(p => p.identity !== 'hero-bot').length + 2) : 2}
            </div>
          </div>
          
          {/* Current User */}
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
            borderRadius: '8px',
            marginBottom: '8px',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease'
          }}>
            <div style={{ 
              color: 'white', 
              fontSize: '14px', 
              fontWeight: '600'
            }}>
              You (Host)
            </div>
          </div>
          
          {/* Hero AI - Always shown as default participant */}
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%)',
            borderRadius: '8px',
            marginBottom: '8px',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease'
          }}>
            <div style={{ 
              color: 'white', 
              fontSize: '14px', 
              fontWeight: '600'
            }}>
              Hero AI
            </div>
          </div>
          
          {/* Other Remote Participants */}
          {participants.filter(p => p.identity !== 'hero-bot').map((participant, index) => (
            <div key={participant.identity} style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%)',
              borderRadius: '8px',
              marginBottom: '8px',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease'
            }}>
              <div style={{ 
                color: 'white', 
                fontSize: '14px', 
                fontWeight: '600'
              }}>
                {participant.name || `Participant ${index + 1}`}
              </div>
            </div>
          ))}
        </div>

              {/* STT Provider Selection */}
              <div className="sidebar-section" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(59, 130, 246, 0.2)'
                  }}>
                    <HiMicrophone size={16} color="#3b82f6" />
                  </div>
                  <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0' }}>Speech Recognition</h3>
                </div>
          
          <div style={{
            backgroundColor: '#374151',
            borderRadius: '8px',
            padding: '12px',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <select
              value={sttProvider}
              onChange={(e) => {
                const newProvider = e.target.value as 'webspeech' | 'deepgram';
                if (newProvider !== sttProvider) {
                  toggleSTTProvider(newProvider);
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#1f2937',
                border: '1px solid #4b5563',
                borderRadius: '6px',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#4b5563';
                e.target.style.boxShadow = 'none';
              }}
            >
              <option value="webspeech">Web Speech API</option>
              <option value="deepgram">Deepgram</option>
            </select>
          </div>
        </div>

              {/* TTS Provider Selection */}
              <div className="sidebar-section" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(245, 158, 11, 0.2)'
                  }}>
                    <HiVolumeUp size={16} color="#f59e0b" />
                  </div>
                  <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0' }}>Text-to-Speech</h3>
                </div>
          
          <div style={{
            backgroundColor: '#374151',
            borderRadius: '8px',
            padding: '12px',
            border: '1px solid rgba(245, 158, 11, 0.2)'
          }}>
            <select
              value={ttsProvider}
              onChange={(e) => {
                const newProvider = e.target.value as 'elevenlabs' | 'gtts' | 'edgetts';
                if (newProvider !== ttsProvider) {
                  toggleTTSProvider(newProvider);
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#1f2937',
                border: '1px solid #4b5563',
                borderRadius: '6px',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#f59e0b';
                e.target.style.boxShadow = '0 0 0 2px rgba(245, 158, 11, 0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#4b5563';
                e.target.style.boxShadow = 'none';
              }}
            >
              <option value="elevenlabs">ElevenLabs</option>
              <option value="gtts">Google TTS</option>
              <option value="edgetts">Edge TTS</option>
            </select>
          </div>
        </div>


              {/* Live Transcription */}
              <div className="sidebar-section" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(34, 197, 94, 0.2)'
                  }}>
                    <HiDocumentText size={16} color="#22c55e" />
                  </div>
                  <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0' }}>Live Transcription</h3>
                </div>
          
          <div ref={transcriptContainerRef} style={{
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
                      {msg.speaker || 'Unknown'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(139, 92, 246, 0.2)'
            }}>
              <HiChatAlt2 size={16} color="#8b5cf6" />
            </div>
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0' }}>
              Chat with Hero AI
            </h3>
          </div>
          
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
                  <div style={{ margin: '0', color: 'white' }}>
                    {message.text.split('\n').map((line, index) => {
                      // Handle bullet points
                      if (line.trim().startsWith('* ')) {
                        return (
                          <div key={index} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <span style={{ color: '#60a5fa', marginRight: '8px', marginTop: '2px' }}>•</span>
                            <span>{line.trim().substring(2)}</span>
                          </div>
                        );
                      }
                      // Handle numbered lists
                      if (line.trim().match(/^\d+\.\s/)) {
                        return (
                          <div key={index} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <span style={{ color: '#60a5fa', marginRight: '8px', marginTop: '2px' }}>{line.trim().match(/^\d+/)?.[0]}.</span>
                            <span>{line.trim().replace(/^\d+\.\s/, '')}</span>
                          </div>
                        );
                      }
                      // Handle regular lines
                      return (
                        <p key={index} style={{ margin: index > 0 ? '8px 0 0 0' : '0' }}>
                          {line}
                        </p>
                      );
                    })}
                  </div>
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
            </>
          )}
        </div>

        {/* Collapsed Sidebar - Professional Icon View */}
        {isSidebarCollapsed && (
          <div style={{
            position: 'fixed',
            right: '0px',
            top: '0px',
            width: '72px',
            height: '100vh',
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
            borderLeft: '1px solid rgba(148, 163, 184, 0.1)',
            padding: '24px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            zIndex: 998,
            backdropFilter: 'blur(12px)',
            boxShadow: '-4px 0 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            {/* Participants Icon */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title={`${room ? (participants.filter(p => p.identity !== 'hero-bot').length + 2) : 2} participants`}
            >
              <HiUsers size={20} color="#3b82f6" />
              <div style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                color: 'white',
                fontSize: '10px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {room ? (participants.filter(p => p.identity !== 'hero-bot').length + 2) : 2}
              </div>
            </div>

            {/* Transcript Icon */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.2)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title={`${transcript.length} transcript messages`}
            >
              <HiDocumentText size={20} color="#22c55e" />
              {transcript.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {transcript.length > 99 ? '99+' : transcript.length}
                </div>
              )}
            </div>

            {/* Hero AI Icon */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Chat with Hero AI"
            >
              <HiChatAlt2 size={20} color="#8b5cf6" />
            </div>

            {/* Settings Icon */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(107, 114, 128, 0.1)',
              border: '1px solid rgba(107, 114, 128, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(107, 114, 128, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.4)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(107, 114, 128, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.2)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Speech & TTS Settings"
            >
              <HiCog size={20} color="#6b7280" />
            </div>
          </div>
        )}

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
