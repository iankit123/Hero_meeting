# Provider Synchronization - Testing Guide

## What Was Implemented

**SYNCHRONIZED STT/TTS PROVIDERS** across all participants in the same meeting room.

When ANY participant changes the Speech-to-Text or Text-to-Speech provider, ALL participants in the room automatically switch to that provider.

---

## How It Works (Backend Developer Perspective)

### Data Flow

```
Participant A                 LiveKit Server              Participant B
     |                              |                            |
     | 1. Change provider           |                            |
     |    (click dropdown)           |                            |
     |                              |                            |
     | 2. Update local state        |                            |
     |    setSttProvider()           |                            |
     |                              |                            |
     | 3. Broadcast change          |                            |
     |    publishData()       ----> |                            |
     |                              | 4. Forward message   ----> |
     |                              |                            |
     |                              |                      5. Receive change
     |                              |                         DataReceived event
     |                              |                            |
     |                              |                      6. Update local state
     |                              |                         setSttProvider()
     |                              |                            |
     |                              |                      7. UI updates
     |                              |                         dropdown shows new value
```

### Message Types (Data Channel)

**1. STT Provider Change**
```json
{
  "type": "stt_provider_change",
  "provider": "deepgram",
  "changedBy": "akshit",
  "timestamp": 1760545000000
}
```

**2. TTS Provider Change**
```json
{
  "type": "tts_provider_change",
  "provider": "elevenlabs",
  "changedBy": "ankit",
  "timestamp": 1760545000000
}
```

### Code Components

**1. Broadcasting** (Sender Side)
```typescript
// When user changes STT provider
const broadcastSttProviderChange = async (provider) => {
  const payload = JSON.stringify({
    type: 'stt_provider_change',
    provider: provider,
    changedBy: participantName,
    timestamp: Date.now()
  });
  
  await room.localParticipant.publishData(payload);
}
```

**2. Receiving** (Receiver Side)
```typescript
// When receiving provider change from another participant
room.on(RoomEvent.DataReceived, (payload, participant) => {
  const data = JSON.parse(payload);
  
  if (data.type === 'stt_provider_change') {
    if (data.provider !== sttProvider) {
      handleSttProviderSwitch(data.provider, false); // false = don't re-broadcast
    }
  }
});
```

**3. Prevention of Infinite Loops**
- `shouldBroadcast` parameter in handler functions
- When receiving a remote change, call handler with `shouldBroadcast=false`
- This prevents "ping-pong" broadcasting

---

## Testing Instructions (2 Laptops Required)

### Test 1: STT Provider Synchronization

**Setup**: 2 separate laptops in same meeting

**Steps**:
1. **Laptop A (akshit)**: Join meeting
2. **Laptop B (ankit)**: Join same meeting
3. **Both laptops**: Verify STT shows "Web Speech API" (default)
4. **Laptop A**: Change dropdown to "Deepgram"

**Expected Results**:
- ✅ **Laptop A**: 
  - Dropdown changes to "Deepgram"
  - Console shows:
    ```
    🔄 [STT] === SWITCHING STT PROVIDER ===
    🔄 [STT] Initiated by: akshit (local)
    🔄 [STT] Target provider: deepgram
    🔄 [STT] Should broadcast: true
    📡 [STT] Broadcasting provider change to all participants...
    📡 [PROVIDER-BROADCAST] STT provider change broadcasted: deepgram
    ✅ [STT] === PROVIDER SWITCH COMPLETE ===
    ```
  - Transcript shows: "🎤 akshit switched to Deepgram STT"

- ✅ **Laptop B**: 
  - Dropdown AUTOMATICALLY changes to "Deepgram"
  - Console shows:
    ```
    📨 [DATA] Received data from akshit-xxx: {type: 'stt_provider_change', provider: 'deepgram', ...}
    🔄 [PROVIDER-SYNC] Received STT provider change from akshit-xxx
    🔄 [PROVIDER-SYNC] New STT provider: deepgram
    🔄 [PROVIDER-SYNC] Changed by: akshit
    📡 [PROVIDER-SYNC] Syncing STT provider to: deepgram
    🔄 [STT] === SWITCHING STT PROVIDER ===
    🔄 [STT] Initiated by: remote participant
    📥 [STT] Provider change received from remote - not re-broadcasting
    ✅ [STT] === PROVIDER SWITCH COMPLETE ===
    ```
  - Transcript shows: "🎤 another participant switched to Deepgram STT"

---

### Test 2: TTS Provider Synchronization

**Setup**: Same 2 laptops still in meeting

**Steps**:
1. **Both laptops**: Verify TTS shows "Google TTS" (default)
2. **Laptop B (ankit)**: Change dropdown to "ElevenLabs"

**Expected Results**:
- ✅ **Laptop B**: 
  - Dropdown changes to "ElevenLabs"
  - Console shows:
    ```
    🔄 [TTS] === SWITCHING TTS PROVIDER ===
    🔄 [TTS] Initiated by: ankit (local)
    🔄 [TTS] Target provider: elevenlabs
    🔄 [TTS] Should broadcast: true
    📡 [TTS] Broadcasting provider change to all participants...
    📡 [PROVIDER-BROADCAST] TTS provider change broadcasted: elevenlabs
    ✅ [TTS] === PROVIDER SWITCH COMPLETE ===
    ```
  - Transcript shows: "🎵 ankit switched to ElevenLabs TTS"

- ✅ **Laptop A**: 
  - Dropdown AUTOMATICALLY changes to "ElevenLabs"
  - Console shows:
    ```
    📨 [DATA] Received data from ank-xxx: {type: 'tts_provider_change', provider: 'elevenlabs', ...}
    🔄 [PROVIDER-SYNC] Received TTS provider change from ank-xxx
    🔄 [PROVIDER-SYNC] New TTS provider: elevenlabs
    🔄 [PROVIDER-SYNC] Changed by: ankit
    📡 [PROVIDER-SYNC] Syncing TTS provider to: elevenlabs
    🔄 [TTS] === SWITCHING TTS PROVIDER ===
    🔄 [TTS] Initiated by: remote participant
    📥 [TTS] Provider change received from remote - not re-broadcasting
    ✅ [TTS] === PROVIDER SWITCH COMPLETE ===
    ```
  - Transcript shows: "🎵 another participant switched to ElevenLabs TTS"

---

### Test 3: Multiple Switches

**Steps**:
1. **Laptop A**: Change STT back to "Web Speech API"
2. **Laptop B**: Change TTS back to "Google TTS"
3. **Laptop A**: Change both providers again

**Expected Results**:
- ✅ All changes sync to both laptops
- ✅ UI dropdowns match on both sides
- ✅ Transcript shows who made each change
- ✅ No duplicate notifications (each change notified once)

---

### Test 4: Hero Response Uses Correct Provider

**Steps**:
1. **Laptop A**: Set TTS to "ElevenLabs"
2. **Verify**: Both laptops show "ElevenLabs"
3. **Either laptop**: Say "Hero, what is the capital of India?"

**Expected Results**:
- ✅ Hero uses ElevenLabs TTS (higher quality voice)
- ✅ Both participants hear the same audio quality

**Repeat with Google TTS**:
1. **Laptop B**: Set TTS to "Google TTS"
2. **Either laptop**: Say "Hero, what time is it?"
3. ✅ Hero uses Google TTS (free, different voice)

---

## Debug Console Log Checklist

### When Changing Provider Locally

**What to look for**:
```
🔄 [STT/TTS] === SWITCHING PROVIDER ===
🔄 [STT/TTS] Initiated by: <your-name> (local)
🔄 [STT/TTS] Target provider: <new-provider>
🔄 [STT/TTS] Should broadcast: true
🛑 [STT] Stopping current STT service...          (STT only)
✅ [STT] Current STT service stopped              (STT only)
🔄 [STT/TTS] Switching from <old> to <new>
✅ [STT] Created new <provider> service           (STT only)
🎤 [STT] Restarting transcription...              (STT only)
📡 [STT/TTS] Broadcasting provider change to all participants...
📡 [PROVIDER-BROADCAST] <STT/TTS> provider change broadcasted: <provider>
✅ [STT/TTS] === PROVIDER SWITCH COMPLETE ===
```

### When Receiving Provider Change from Remote

**What to look for**:
```
📨 [DATA] Received data from <participant-id>: {type: 'stt_provider_change', ...}
🔄 [PROVIDER-SYNC] Received STT provider change from <participant-id>
🔄 [PROVIDER-SYNC] New STT provider: <provider>
🔄 [PROVIDER-SYNC] Changed by: <participant-name>
📡 [PROVIDER-SYNC] Syncing STT provider to: <provider>
🔄 [STT] === SWITCHING STT PROVIDER ===
🔄 [STT] Initiated by: remote participant
📥 [STT] Provider change received from remote - not re-broadcasting
✅ [STT] === PROVIDER SWITCH COMPLETE ===
```

### If Already Synced (No Action Needed)

**What to look for**:
```
📨 [DATA] Received data from <participant-id>: {type: 'stt_provider_change', ...}
🔄 [PROVIDER-SYNC] Received STT provider change from <participant-id>
✅ [PROVIDER-SYNC] STT provider already matches: <provider>
```

---

## Common Issues & Solutions

### Issue: "Provider change not syncing"

**Check**:
1. **Room connected**: Provider changes only work when room is connected
   - Look for: `⚠️ [PROVIDER-BROADCAST] No room available`
   - Solution: Ensure both participants are in "connected" state

2. **Data channel working**: Verify other data (transcripts, Hero messages) are syncing
   - If transcripts sync but providers don't, check for JS errors in console

3. **Function names match**: Verify data channel handler calls correct functions
   - `handleSttProviderSwitch` (not `toggleSTTProvider`)
   - `handleTtsProviderSwitch` (not `toggleTTSProvider`)

### Issue: "Infinite loop - providers switching back and forth"

**Check**:
- `shouldBroadcast` parameter is being used correctly
- Remote changes call handler with `shouldBroadcast=false`
- Look for: Excessive `📡 [PROVIDER-BROADCAST]` logs

**Solution**: Already implemented - handlers check if provider already matches before switching

### Issue: "Missing speech after provider change"

**Check STT Switch**:
1. Old service stopped: `✅ [STT] Current STT service stopped`
2. New service created: `✅ [STT] Created new <provider> service`
3. Transcription restarted: `✅ [STT] Transcription restarted`
4. For Deepgram: `🔗 [DEEPGRAM] WebSocket connected`
5. For WebSpeech: `🎤 [WEBSPEECH] Recognition started`

**If missing**:
- Check for error logs: `❌ [STT] Error switching`
- Verify API keys for Deepgram: `NEXT_PUBLIC_DEEPGRAM_API_KEY`

---

## Provider Switching Not Working?

### STT Not Switching

**Check environment variables**:
```bash
grep DEEPGRAM_API_KEY .env.local
```

**Expected**: Should show a valid API key

**Console verification**:
```
🎤 [STT] Creating STT service with provider: deepgram
🎤 [DEEPGRAM] DeepgramSTTService initialized with API key
🔗 [DEEPGRAM] WebSocket connected
```

**If you see**: `❌ [DEEPGRAM] Error starting transcription` - API key is missing or invalid

### TTS Not Switching

**Check environment variables**:
```bash
grep ELEVENLABS_API_KEY .env.local
```

**Expected**: Should show a valid API key (if using ElevenLabs)

**Note**: Google TTS is free and doesn't require API key - it always works

---

## Console Log Flow Diagram

### Local Provider Change
```
User clicks dropdown
  ↓
toggleSTTProvider(newProvider) called
  ↓
handleSttProviderSwitch(newProvider, shouldBroadcast=true)
  ↓
├─ Stop old service
├─ Create new service
├─ Restart transcription
├─ broadcastSttProviderChange(newProvider)  ← Sends to others
└─ Add system notification
```

### Remote Provider Change
```
LiveKit receives data from remote
  ↓
DataReceived event fires
  ↓
Parse message: {type: 'stt_provider_change', provider: 'deepgram'}
  ↓
Check if provider != current
  ↓
handleSttProviderSwitch(newProvider, shouldBroadcast=false)  ← Don't re-broadcast!
  ↓
├─ Stop old service
├─ Create new service
├─ Restart transcription
├─ Skip broadcasting (shouldBroadcast=false)
└─ Add system notification ("another participant switched...")
```

---

## Expected Console Logs for Full Sync Test

### Laptop A (Initiator)

**Action**: Change STT from WebSpeech → Deepgram

```log
[User clicks dropdown to select Deepgram]

🔄 [STT] === SWITCHING STT PROVIDER ===
🔄 [STT] Initiated by: akshit (local)
🔄 [STT] Target provider: deepgram
🔄 [STT] Should broadcast: true
🛑 [STT] Stopping current STT service...
🛑 [WEBSPEECH] Stopping Web Speech API transcription...
✅ [WEBSPEECH] Recognition stopped and aborted
✅ [STT] Current STT service stopped
🔄 [STT] Switching from webspeech to deepgram
🎤 [STT] Creating STT service with provider: deepgram
🎤 [DEEPGRAM] DeepgramSTTService initialized with API key
✅ [STT] Created new deepgram service
🎤 [STT] Restarting transcription with deepgram...
🎤 [STT] Starting transcription service...
🎤 [DEEPGRAM] Starting Deepgram WebSocket transcription...
🔗 [DEEPGRAM] Connecting to: wss://api.deepgram.com/v1/listen
✅ [STT] Transcription restarted with deepgram
📡 [STT] Broadcasting provider change to all participants...
📡 [PROVIDER-BROADCAST] STT provider change broadcasted to all participants: deepgram
✅ [STT] === PROVIDER SWITCH COMPLETE ===

[Shortly after]
🔗 [DEEPGRAM] WebSocket connected
🎧 [DEEPGRAM] AudioContext created with sample rate: 48000
🎵 [DEEPGRAM] Audio processing setup complete
```

### Laptop B (Receiver)

**Action**: None - automatic sync

```log
[Receives broadcast from Laptop A]

📨 [DATA] Received data from akshit-19f2cf3f: {type: 'stt_provider_change', provider: 'deepgram', changedBy: 'akshit', timestamp: 1760545000000}
🔄 [PROVIDER-SYNC] Received STT provider change from akshit-19f2cf3f
🔄 [PROVIDER-SYNC] New STT provider: deepgram
🔄 [PROVIDER-SYNC] Changed by: akshit
📡 [PROVIDER-SYNC] Syncing STT provider to: deepgram
🔄 [STT] === SWITCHING STT PROVIDER ===
🔄 [STT] Initiated by: remote participant
🔄 [STT] Target provider: deepgram
🔄 [STT] Should broadcast: false
🛑 [STT] Stopping current STT service...
🛑 [WEBSPEECH] Stopping Web Speech API transcription...
✅ [WEBSPEECH] Recognition stopped and aborted
✅ [STT] Current STT service stopped
🔄 [STT] Switching from webspeech to deepgram
🎤 [STT] Creating STT service with provider: deepgram
✅ [STT] Created new deepgram service
🎤 [STT] Restarting transcription with deepgram...
📥 [STT] Provider change received from remote - not re-broadcasting
✅ [STT] === PROVIDER SWITCH COMPLETE ===

[Shortly after]
🔗 [DEEPGRAM] WebSocket connected
🎧 [DEEPGRAM] AudioContext created with sample rate: 48000
🎵 [DEEPGRAM] Audio processing setup complete
```

---

## Verification Checklist

### ✅ Things That Should Happen

**UI**:
- [ ] Dropdown on Laptop A changes when you click it
- [ ] Dropdown on Laptop B changes automatically (within 1 second)
- [ ] Both dropdowns show same value
- [ ] System notification appears in both transcripts

**Console**:
- [ ] Initiating laptop logs "Initiated by: <name> (local)"
- [ ] Receiving laptop logs "Initiated by: remote participant"
- [ ] Initiating laptop logs "Should broadcast: true"
- [ ] Receiving laptop logs "Should broadcast: false"
- [ ] Broadcast message logged: "📡 [PROVIDER-BROADCAST]"
- [ ] Receive message logged: "📨 [DATA] Received data"
- [ ] Provider sync logged: "📡 [PROVIDER-SYNC] Syncing"

**Functionality**:
- [ ] STT actually switches (test by speaking - check which provider logs appear)
- [ ] TTS actually switches (test by asking Hero - check audio quality difference)
- [ ] No infinite loops (broadcasts happen once, not repeatedly)

### ❌ Things That Should NOT Happen

- [ ] Multiple broadcasts for single change
- [ ] Both laptops logging "Initiated by: <name> (local)"
- [ ] Ping-pong switching (A→B, B→A, A→B...)
- [ ] Provider mismatch after sync (one shows Deepgram, other shows WebSpeech)
- [ ] STT stopping but not restarting
- [ ] Errors: `❌ [STT] Error switching`

---

## Troubleshooting Guide

### "Laptop B's dropdown doesn't change"

**Possible causes**:
1. Room not connected
   - Check: `⚠️ [PROVIDER-BROADCAST] No room available`
   - Solution: Wait for connection, retry

2. Data channel not working
   - Check: Are transcripts syncing? If not, data channel is broken
   - Solution: Fix data channel first

3. Function name mismatch
   - Check: Look for JS errors in console
   - Solution: Verify `handleSttProviderSwitch` is defined and called

### "Provider switches but STT/TTS doesn't work"

**For STT**:
- Deepgram: Check `NEXT_PUBLIC_DEEPGRAM_API_KEY` in `.env.local`
- WebSpeech: Should always work in Chrome/Edge

**For TTS**:
- ElevenLabs: Check `NEXT_PUBLIC_ELEVENLABS_API_KEY` in `.env.local`
- Google TTS: Should always work (free, no key needed)

### "Infinite switching loop"

**If you see**:
```
📡 [PROVIDER-BROADCAST] ... broadcasted
📨 [DATA] Received data ...
📡 [PROVIDER-BROADCAST] ... broadcasted  ← Should NOT repeat!
```

**Cause**: `shouldBroadcast=false` not working

**Solution**: Check data channel handler passes `false`:
```typescript
handleSttProviderSwitch(data.provider, false);  // Must be false!
```

---

## Testing Scenarios

### Scenario 1: Basic Sync (Happy Path)
- ✅ Laptop A changes → Laptop B updates
- ✅ UI matches on both sides
- ✅ Functionality works

### Scenario 2: Rapid Switching
- Change STT → TTS → STT → TTS quickly
- ✅ All changes sync
- ✅ No errors or race conditions

### Scenario 3: Mid-Conversation
- Conversation in progress
- Change provider
- ✅ Conversation continues with new provider
- ✅ No transcripts lost

### Scenario 4: 3+ Participants
- Add 3rd laptop
- Any laptop changes provider
- ✅ All 3 laptops sync
- ✅ All use same provider

---

## Files Modified

**components/MeetingPage.tsx**:
1. Added `broadcastSttProviderChange()` function
2. Added `broadcastTtsProviderChange()` function
3. Renamed `toggleSTTProvider` → split into:
   - `handleSttProviderSwitch(provider, shouldBroadcast)`
   - `toggleSTTProvider()` (UI wrapper)
4. Renamed `toggleTTSProvider` → split into:
   - `handleTtsProviderSwitch(provider, shouldBroadcast)`
   - `toggleTTSProvider()` (UI wrapper)
5. Added data channel handlers for provider change messages
6. Added comprehensive logging throughout

---

## Summary

**What happens now**:
1. **One person** changes STT or TTS provider
2. **Everyone** in the room gets the same provider
3. **UI** updates automatically for all participants
4. **Transcript** shows who made the change
5. **No duplicate** broadcasts or infinite loops

**Like a backend system**:
- Think of it as a pub/sub pattern
- Publisher: Participant changing provider
- Subscribers: All other participants in room
- Message bus: LiveKit data channel
- Idempotency: Check if provider already matches before switching
- Loop prevention: `shouldBroadcast` flag

**Ready to test!** 🚀

