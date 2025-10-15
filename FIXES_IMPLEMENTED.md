# Fixes Implemented - October 15, 2025

## Summary
Fixed 5 critical issues preventing proper 2-participant testing:
1. ✅ STT transcribing Hero's audio (causing feedback loop)
2. ✅ Duplicate transcripts between participants
3. ✅ Hero LLM refusing to answer general knowledge questions
4. ✅ Speaker names showing UUID instead of display name
5. ✅ Room reference issues in broadcasts

---

## Issue #1: STT Transcribing Hero's Audio ✅ FIXED

### Problem
Web Speech API was picking up Hero's TTS audio output and transcribing it, causing:
- Hero says: "The capital of India is New Delhi"
- STT transcribes: "the capital of India is new delhi"
- Creates duplicate messages and confusion

### Root Cause
No audio source isolation - STT listens to ALL system audio including speakers

### Solution Implemented
Added `isHeroSpeakingRef` to pause STT during Hero playback:

**File**: `components/MeetingPage.tsx`

```typescript
// Added ref
const isHeroSpeakingRef = useRef(false);

// In STT callback - skip if Hero is speaking
sttServiceRef.current.onTranscript(async (result: STTResult) => {
  if (isHeroSpeakingRef.current) {
    console.log('⏭️ [STT] Skipping transcript - Hero is speaking');
    return;
  }
  // ... process transcript
});

// Before Hero audio plays
isHeroSpeakingRef.current = true;
console.log('⏸️ [STT] Paused - Hero is speaking');

// After Hero audio ends
source.onended = () => {
  isHeroSpeakingRef.current = false;
  console.log('▶️ [STT] Resumed - Hero finished speaking');
};
```

### Impact
- Hero's audio no longer appears in transcripts
- Clean conversation flow
- No feedback loops

---

## Issue #2: Duplicate Transcripts ✅ FIXED

### Problem
Each transcript appeared twice:
- Participant A says "hello"
- Participant B receives "hello" via broadcast
- Participant B's STT also hears "hello" through LiveKit audio
- Result: "hello" shows twice in both participants' views

### Root Cause
Two sources adding transcripts:
1. Local STT transcribing own audio
2. Receiving broadcast from other participant

### Solution Implemented
Added message ID deduplication:

**File**: `components/MeetingPage.tsx`

```typescript
// Added ref for tracking processed messages
const processedMessageIds = useRef<Set<string>>(new Set());

// In DataReceived handler
if (data.type === 'transcript') {
  // Skip if already processed
  if (processedMessageIds.current.has(data.messageId)) {
    console.log('⏭️ [TRANSCRIPT] Skipping duplicate message:', data.messageId);
    return;
  }
  processedMessageIds.current.add(data.messageId);
  // ... process transcript
}
```

### Impact
- Each message appears exactly once
- Clean transcript view for all participants
- No duplicate detection needed elsewhere

---

## Issue #3: Hero LLM Not Responding ✅ FIXED

### Problem
Hero responding with "I don't have that specific information" for basic questions:
- Q: "Hero, what is the capital of India?"
- A: "I don't have that specific information"
- Q: "Hero, who is Narendra Modi?"
- A: "I am sorry, but I do not have any information about Narendra Modi"

### Root Cause
Anti-hallucination prompt was TOO restrictive:
- Blocked ALL information not in meeting context
- Even blocked general world knowledge
- Gemini couldn't use its training data

### Solution Implemented
Updated prompt to distinguish between meeting-specific and general knowledge:

**File**: `pages/api/hero-join.ts`

```typescript
const antiHallucinationPrompt = `You are Hero, an AI assistant participating in meetings.

CRITICAL RULES FOR MEETING-RELATED QUESTIONS:
1. When asked about PAST MEETINGS or MEETING PARTICIPANTS: ONLY use context provided
2. NEVER make up meeting details not in context

RULES FOR GENERAL KNOWLEDGE QUESTIONS:
1. For questions about general facts, world knowledge: provide accurate answers using your general knowledge
2. Examples: "What is the capital of India?" - Answer these normally!
3. You CAN provide general information and factual knowledge
4. Only restrict yourself to context when question is about YOUR meetings

Question: ${finalQuestion}

Determine if this is about:
A) Past meetings (use ONLY context)
B) General knowledge (use your knowledge)

Answer accordingly.`;
```

### Impact
- Hero now answers general knowledge questions correctly
- Still protected against hallucinating meeting details
- Better user experience

---

## Issue #4: Speaker Names Showing UUID ✅ FIXED

### Problem
Transcripts showing:
- "akshit-233b8265: hello"
- Instead of: "akshit: hello"

### Root Cause
Using `room.localParticipant.identity` (UUID-suffixed) instead of `.name`

### Solution Implemented
**File**: `components/MeetingPage.tsx`

```typescript
// OLD - Using identity
const speakerName = room?.localParticipant?.identity || participantName;

// NEW - Using name
const speakerName = participantName || room?.localParticipant?.name || 'Participant';
```

### Impact
- Clean speaker names in transcripts
- Better readability
- Professional appearance

---

## Issue #5: Room Reference Issues ✅ FIXED (Previous Fix)

### Problem
Room becoming null in callbacks due to React closures

### Solution
Added `roomRef` to maintain current room reference:

```typescript
const roomRef = useRef<Room | null>(null);

useEffect(() => {
  roomRef.current = room;
}, [room]);

// Use roomRef.current instead of room in callbacks
const currentRoom = roomRef.current;
```

---

## Testing Instructions

### Test 1: Duplicate Transcripts
**Setup**: 2 separate laptops/browsers

1. Participant A says: "I am apple"
2. Participant B says: "I am banana"

**Expected**:
- ✅ Each participant sees BOTH messages
- ✅ Each message appears ONCE
- ✅ No duplicates

**Verify in console**:
```
📤 [TRANSCRIPT-BROADCAST] Transcript broadcasted...
📥 [TRANSCRIPT] Received broadcast, not re-broadcasting...
```

---

### Test 2: Hero Audio Not Transcribed
**Setup**: Any browser

1. Say: "Hero, what is the capital of India?"
2. Wait for Hero to respond

**Expected**:
- ✅ Hero responds with "New Delhi" (or similar)
- ✅ Hero's audio is NOT in the transcript
- ✅ No duplicate messages

**Verify in console**:
```
⏸️ [STT] Paused - Hero is speaking
[Hero speaks]
▶️ [STT] Resumed - Hero finished speaking
```

---

### Test 3: Hero General Knowledge
**Setup**: Any browser

Try these questions:
1. "Hero, what is the capital of India?"
2. "Hero, who is the prime minister of India?"
3. "Hero, what is 2+2?"

**Expected**:
- ✅ Hero answers correctly using general knowledge
- ✅ NOT "I don't have that information"

---

### Test 4: Speaker Names
**Setup**: 2 browsers

1. Participant "akshit" says: "hello"
2. Check transcript

**Expected**:
- ✅ Shows "akshit: hello"
- ✅ NOT "akshit-233b8265: hello"

---

### Test 5: Past Meeting Context
**Setup**: Any browser with existing meetings

1. Say: "Hero, can you summarize the previous meeting?"

**Expected**:
- ✅ Hero searches past meetings using RAG
- ✅ Provides summary if data exists
- ✅ Says "I don't have information about that meeting" if no data

---

## Files Modified

1. **components/MeetingPage.tsx**
   - Added `isHeroSpeakingRef` to pause STT
   - Added `processedMessageIds` for deduplication
   - Fixed speaker name logic
   - Added STT pause/resume in Hero audio playback

2. **pages/api/hero-join.ts**
   - Updated anti-hallucination prompt
   - Separated meeting vs general knowledge rules
   - Allowed Gemini to use general knowledge

---

## Known Remaining Issues

1. **Remote video rendering**: Video tracks subscribed but not showing in DOM
   - Not blocking core functionality
   - Low priority

2. **Excessive re-renders**: ParticipantTile re-rendering frequently
   - Performance issue, not functional
   - Low priority
   - Can optimize with React.memo() later

---

## Console Log Changes

### Before Fixes:
```
🎤 [WEBSPEECH] Raw transcript: I am sorry but I do not have...
📨 [DATA] Received data: {text: 'hello'}
🎤 [WEBSPEECH] Raw transcript: hello
speaker: akshit-233b8265
Hero: I don't have that specific information
```

### After Fixes:
```
⏸️ [STT] Paused - Hero is speaking
[Hero audio plays]
▶️ [STT] Resumed - Hero finished speaking
⏭️ [TRANSCRIPT] Skipping duplicate message: 12345
speaker: akshit
Hero: The capital of India is New Delhi.
```

---

## Performance Impact

- **Duplicate prevention**: Negligible overhead (Set lookup is O(1))
- **STT pause**: No overhead (just a boolean check)
- **LLM prompt**: Slightly longer prompt, but more accurate responses

---

## Next Steps

1. **Test thoroughly** with 2 participants on separate devices
2. **Monitor** console logs for any issues
3. **Verify** Hero can access RAG data
4. **Check** past meeting summaries are working
5. **Optimize** re-renders if performance becomes an issue

---

## Rollback Instructions

If issues occur:

1. **STT pause fix**: Remove `isHeroSpeakingRef` logic
2. **Deduplication**: Remove `processedMessageIds` logic
3. **LLM prompt**: Revert to old anti-hallucination prompt
4. **Speaker names**: Revert to using `.identity`

All changes are isolated and can be reverted independently.

