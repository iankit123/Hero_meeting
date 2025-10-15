# Critical Fixes Needed - October 15, 2025

## Issues Identified from Console Logs

### 1. STT Transcribing Hero's Audio (CRITICAL) ❌
**Logs**:
```
🎤 [WEBSPEECH] Interim transcript: I am sorry but I do not have any information...
```

**Problem**: 
- Web Speech API picks up ALL audio from the laptop speakers
- When Hero speaks via TTS, STT transcribes it
- This creates feedback loop and duplicate messages

**Root Cause**:
- No audio output device separation
- STT listening to system audio, not just microphone

**Solution**:
- Pause STT when Hero is speaking
- Add `isHeroSpeakingRef` to track Hero's TTS playback
- Resume STT after Hero finishes

---

### 2. Duplicate Transcripts (CRITICAL) ❌
**Logs**:
```
📨 [DATA] Received data from ank-45628d98 {type: 'transcript', text: 'hello'}
🎤 [WEBSPEECH] Raw transcript received: hello
```

**Problem**:
- Participant A says "hello"
- Participant B hears it through LiveKit audio
- Participant B's STT transcribes it
- Participant B broadcasts "hello" as their own transcript
- Now BOTH participants show "hello" twice

**Root Cause**:
- STT picks up remote participant audio from LiveKit
- No audio source isolation
- No transcript deduplication

**Solution**:
- Add transcript deduplication by message ID
- Track processed message IDs
- Skip if already processed
- OR: Use speaker detection to filter out remote audio

---

### 3. Hero LLM Not Working (CRITICAL) ❌
**Logs**:
```
Question: "hero who is Narendra Modi"
Response: "I am sorry, but I do not have any information about Narendra Modi"
```

**Problem**:
- Basic general knowledge questions failing
- Gemini API should know this

**Root Cause**:
- Anti-hallucination prompt too restrictive?
- Context not being sent correctly?
- API key issue?

**Solution**:
- Check Gemini API key
- Relax anti-hallucination rules for general knowledge
- Check API call logs
- Test with simple question

---

### 4. Speaker Name Using Identity (HIGH) ❌
**Logs**:
```
speaker: 'akshit-233b8265'  // Should be 'akshit'
```

**Problem**:
- Using UUID-suffixed identity instead of display name
- Ugly in transcripts

**Solution**:
- Use `room.localParticipant.name` instead of `.identity`
- Fall back to `participantName` state

---

### 5. Excessive Re-renders (MEDIUM) ❌
**Logs**:
```
🔧 [TILE] Setting up tracks for hero-bot (x100+)
```

**Problem**:
- ParticipantTile re-rendering on every state change
- Causes performance issues

**Solution**:
- Memoize ParticipantTile component
- Use React.memo()
- Optimize useEffect dependencies

---

## Implementation Priority

1. **FIX STT TRANSCRIBING HERO** (Blocks testing)
2. **FIX DUPLICATE TRANSCRIPTS** (Blocks testing)
3. **FIX SPEAKER NAMES** (UX issue)
4. **FIX HERO LLM** (Core feature)
5. **FIX RE-RENDERS** (Performance)

---

## Code Changes Required

### Fix 1: Pause STT During Hero Playback

```typescript
// Add ref
const isHeroSpeakingRef = useRef(false);

// In handleHeroTrigger, before playing audio:
isHeroSpeakingRef.current = true;
if (sttServiceRef.current) {
  await sttServiceRef.current.stopTranscription();
  console.log('⏸️ [STT] Paused during Hero playback');
}

// After audio ends:
isHeroSpeakingRef.current = false;
if (sttServiceRef.current) {
  await sttServiceRef.current.startTranscription();
  console.log('▶️ [STT] Resumed after Hero playback');
}
```

### Fix 2: Deduplicate Transcripts

```typescript
const processedMessageIds = useRef<Set<string>>(new Set());

// In DataReceived handler:
if (data.type === 'transcript') {
  if (processedMessageIds.current.has(data.messageId)) {
    console.log('⏭️ [TRANSCRIPT] Skipping duplicate message:', data.messageId);
    return;
  }
  processedMessageIds.current.add(data.messageId);
  // ... rest of logic
}
```

### Fix 3: Fix Speaker Names

```typescript
// In STT callback:
const speakerName = room?.localParticipant?.name || participantName || 'Participant';
```

### Fix 4: Check Hero LLM

Check `/pages/api/hero-join.ts`:
- Verify GEMINI_API_KEY is set
- Check anti-hallucination prompt
- Test with curl
- Check rate limits

---

## Testing Plan

After fixes:

1. **Test Duplicate Transcripts**:
   - Participant A: "I am apple"
   - Participant B: "I am banana"
   - Check each sees ONLY one instance of each message

2. **Test Hero Audio Transcription**:
   - Ask "Hero, what is capital of India?"
   - Check Hero's response is NOT transcribed in STT

3. **Test Hero LLM**:
   - Ask "Hero, what is the capital of India?"
   - Expected: "New Delhi" or similar
   - NOT: "I don't have that information"

4. **Test Speaker Names**:
   - Check transcript shows "akshit" not "akshit-233b8265"

---

## Additional Observations

- Video rendering issue: Remote video not showing despite tracks being subscribed
- Need to fix participant tile video attachment
- Consider disabling "missed track check" - running too frequently

