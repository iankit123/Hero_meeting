# 🐛 Multi-Participant Issues - Fix Guide

## Issues Identified

### **Issue 1: Hero Audio Only Heard by Participant 1** ❌
**Problem:** When Participant 1 triggers Hero, only they hear the response. Participant 2 doesn't hear it.

**Root Cause:** Hero's TTS audio is published as an audio track by Participant 1 (line 1421-1437 in MeetingPage.tsx), but **other participants aren't subscribing/playing** this track.

**Why:** The `ParticipantTile` component handles video tracks but may not properly handle dynamic audio tracks that get published mid-meeting.

---

### **Issue 2: Each Participant Only Sees Own Transcripts** ❌  
**Problem:** Participant 1 and Participant 2 each see only their own transcripts, not a shared view.

**Root Cause:** Line 1046-1050 in MeetingPage.tsx shows:
```typescript
if (message.speaker === 'user' || message.speaker === 'local') {
  await broadcastTranscript(message.text, speakerName, message.id);
}
```

But line 1149 sets speaker to:
```typescript
speaker: room?.localParticipant?.identity || participantName || 'Participant 1'
```

**Problem:** The speaker is the participant's identity (e.g., "oko-75cd63cf"), which is **NOT 'user' or 'local'**, so `broadcastTranscript` is **NEVER CALLED**!

---

### **Issue 3: 2-Second Accumulator Interference** ❌
**Problem:** The accumulator is a single shared ref (lines 42-52), so if Participant 2 says "Hero" while Participant 1's accumulator is running, they interfere.

**Root Cause:** Only ONE accumulator for all participants in the room.

---

## 🔧 Fixes Needed

### **Fix #1: Broadcast Transcripts for ALL Speakers**

**File:** `components/MeetingPage.tsx`

**Change line 1046-1050 from:**
```typescript
// Broadcast transcript to all participants if it's from local user
if (message.speaker === 'user' || message.speaker === 'local') {
  const speakerName = room?.localParticipant?.identity || participantName || 'Participant 1';
  await broadcastTranscript(message.text, speakerName, message.id);
}
```

**To:**
```typescript
// Always broadcast transcripts from the local participant to all others
// Use participantName for better display
const speakerName = participantName || room?.localParticipant?.identity || 'Participant';
await broadcastTranscript(message.text, speakerName, message.id);
```

**Result:** ✅ All participants will see each other's transcripts in real-time

---

### **Fix #2: Ensure Other Participants Play Hero's Audio**

**Problem:** Hero's audio is published as a track, but other participants need to detect and play it.

**Solution:** Add audio track subscription handling in the `RoomEvent.TrackSubscribed` listener.

**File:** `components/MeetingPage.tsx`

**Find the TrackSubscribed handler** (around line 520-600) and ensure it handles audio tracks:

```typescript
newRoom.on(RoomEvent.TrackSubscribed, (
  track: RemoteTrack,
  publication: RemoteTrackPublication,
  participant: RemoteParticipant
) => {
  console.log(`📺 [TRACK] Track subscribed:`, {
    participantIdentity: participant.identity,
    trackKind: track.kind,
    trackName: publication.trackName,
    source: publication.source
  });

  // Handle Hero's TTS audio
  if (track.kind === 'audio' && publication.trackName === 'hero-tts-audio') {
    console.log('🎵 [HERO-AUDIO] Hero TTS audio track received!');
    
    // Attach to audio element for playback
    const audioElement = document.createElement('audio');
    audioElement.autoplay = true;
    audioElement.volume = 1.0;
    track.attach(audioElement);
    
    console.log('✅ [HERO-AUDIO] Hero audio attached and playing for all participants');
    
    // Clean up when track ends
    track.once('ended', () => {
      track.detach(audioElement);
      audioElement.remove();
      console.log('🧹 [HERO-AUDIO] Cleaned up Hero audio element');
    });
  }
  
  // Handle regular video/audio tracks (existing code)
  // ... rest of your existing TrackSubscribed logic
});
```

**Result:** ✅ All participants will hear Hero's responses

---

### **Fix #3: Make Accumulator Per-Participant**

**Problem:** Single shared accumulator causes interference when multiple participants talk to Hero.

**Solution:** Change from a single ref to a Map indexed by participant identity.

**File:** `components/MeetingPage.tsx`

**Change line 42-52 from:**
```typescript
// Hero query accumulation ref for 2-second pause detection
const heroQueryAccumulator = useRef<{
  isAccumulating: boolean;
  messages: string[];
  startTime: number;
  timeout: NodeJS.Timeout | null;
}>({
  isAccumulating: false,
  messages: [],
  startTime: 0,
  timeout: null
});
```

**To:**
```typescript
// Hero query accumulation - per participant (using Map)
const heroQueryAccumulators = useRef<Map<string, {
  isAccumulating: boolean;
  messages: string[];
  startTime: number;
  timeout: NodeJS.Timeout | null;
}>>(new Map());

// Helper to get or create accumulator for a participant
const getAccumulator = (participantId: string) => {
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
```

**Then update all references** from:
```typescript
heroQueryAccumulator.current
```

**To:**
```typescript
const accumulator = getAccumulator(participantName || 'local');
accumulator.isAccumulating
accumulator.messages
// etc...
```

**Result:** ✅ Each participant can independently trigger Hero without interference

---

## 📋 Summary of Changes

| File | Lines | Change |
|------|-------|--------|
| `MeetingPage.tsx` | 1046-1050 | Remove speaker check, always broadcast transcripts |
| `MeetingPage.tsx` | 520-600 | Add Hero audio playback in TrackSubscribed |
| `MeetingPage.tsx` | 42-52 | Change accumulator from ref to Map (per-participant) |
| `MeetingPage.tsx` | All accumulator uses | Update to use `getAccumulator(participantId)` |

---

## 🚀 Testing After Fixes

### **Test 1: Hero Audio Broadcasting**
1. Open 2 browser windows/tabs
2. Both join same meeting as different participants
3. Participant 1 says: "Hero, what's the time?"
4. **Expected:** Both participants hear Hero's voice response

### **Test 2: Shared Transcripts**
1. Participant 1 says: "Hello everyone"
2. **Expected:** Both participants see this in their transcript panel
3. Participant 2 says: "Hi there"
4. **Expected:** Both participants see this too

### **Test 3: Independent Accumulators**
1. Participant 1 starts: "Hero, tell me about..."
2. Before P1 finishes, Participant 2 says: "Hero, what is..."
3. **Expected:** Both queries process independently, no interference

---

## ⚠️ Important Notes

**You're currently in ASK mode**, so I can't directly make these changes. 

**To implement:**
1. **Switch to AGENT mode**
2. I'll make all three fixes automatically
3. Test with 2 participants

Or you can manually apply the changes above!

Let me know when you're ready! 🚀

