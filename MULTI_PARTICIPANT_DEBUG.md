# 🔍 Multi-Participant Debugging Guide

## 🎯 Understanding How It SHOULD Work

### **Architecture:**
```
Participant 1 (Alice)              LiveKit Server              Participant 2 (Bob)
─────────────────────              ──────────────              ───────────────────
[Browser 1]                                                    [Browser 2]

Alice speaks into mic
     ↓
STT transcribes (local)
     ↓
addTranscript() called
     ↓
broadcastTranscript() ─────────→  LiveKit  ─────────→  DataReceived event
                                                              ↓
                                                        addTranscript(false)
                                                              ↓
                                                        Bob sees Alice's text ✅
```

### **Hero Audio Flow:**
```
Alice: "Hero, what time is it?"
     ↓
handleHeroTrigger() [Alice's browser]
     ↓
API call to /api/hero-join
     ↓
Hero responds with audio buffer
     ↓
Alice publishes 'hero-tts-audio' track ────→  LiveKit  ────→  TrackSubscribed [Bob's browser]
     ↓                                                              ↓
Alice hears locally                                           Bob's audio element plays
✅ Both hear Hero!
```

---

## 🐛 Known Issues & Checks

### **Issue 1: Transcripts Not Shared**

**Symptoms:**
- Alice speaks: Alice sees it, Bob doesn't
- Bob speaks: Bob sees it, Alice doesn't

**Debug Steps:**

1. **Check if broadcast is called:**
   - Alice's console should show:
   ```
   📤 [TRANSCRIPT] Broadcasting to all participants: "hello" by Alice
   📤 [TRANSCRIPT-BROADCAST] Transcript broadcasted to all participants
   ```

2. **Check if Bob receives it:**
   - Bob's console should show:
   ```
   📨 [DATA] Received data from Alice-abc123: {type: 'transcript', text: 'hello', speaker: 'Alice'}
   📝 [TRANSCRIPT] Received transcript from another participant
   📥 [TRANSCRIPT] Received broadcast, not re-broadcasting: "hello"
   ```

3. **If Bob doesn't receive:**
   - Problem: LiveKit data channel not working
   - Check: Room connection state
   - Check: `room.numParticipants` > 1

**Possible Causes:**
- ❌ Room not fully connected when broadcast happens
- ❌ Data channel permissions not granted
- ❌ `publishData()` failing silently

---

### **Issue 2: Hero Audio Only Heard by Initiator**

**Symptoms:**
- Alice triggers Hero: Alice hears, Bob doesn't
- Bob triggers Hero: Bob hears, Alice doesn't

**Debug Steps:**

1. **Check if audio track is published:**
   - Initiator's console (Alice) should show:
   ```
   🎵 [FRONTEND] Creating LiveKit audio track from TTS...
   ✅ [FRONTEND] Hero TTS audio published to LiveKit!
   📢 [FRONTEND] Broadcasting Hero audio to 2 participants
   ```

2. **Check if other participant receives track:**
   - Other participant's console (Bob) should show:
   ```
   🎵 [AUDIO-TRACK] Processing audio track from Alice-abc123
   🎵 [AUDIO-TRACK] Track name: hero-tts-audio, Source: microphone
   🤖 [HERO-AUDIO] Hero TTS audio track detected!
   ✅ [HERO-AUDIO] All participants in the room should now hear Hero speaking!
   🔊 [HERO-AUDIO] Hero audio playing successfully!
   ```

3. **If Bob doesn't see TrackSubscribed logs:**
   - Problem: Track not being subscribed
   - Check: LiveKit track subscription permissions
   - Check: Track publication settings

**Possible Causes:**
- ❌ Track published but not subscribed (LiveKit permissions)
- ❌ TrackSubscribed event not firing
- ❌ Track name doesn't match ('hero-tts-audio')
- ❌ Autoplay blocked by browser

---

### **Issue 3: STT Stops Listening**

**Symptoms:**
- With 2 participants, STT randomly stops
- "Not listening" after someone speaks

**Root Cause:**
- Web Speech API is **browser-specific** (each participant has their own)
- Each browser only transcribes its OWN microphone
- This is CORRECT behavior (prevents echo/feedback)

**But there might be:**
- ❌ Recognition stopping when other participant speaks (shouldn't happen)
- ❌ Keepalive not working properly
- ❌ `onend` event firing unexpectedly

**Debug:**
- Check console for:
  ```
  🔴 [WEBSPEECH] Recognition ended - preparing to restart
  🔄 [WEBSPEECH] Restarting speech recognition...
  ```

---

## 🧪 Comprehensive Test Script

### **Setup:**
1. Open TWO browser tabs/windows
2. Tab 1: http://localhost:8002 → Join as "Alice"
3. Tab 2: http://localhost:8002 → Join as "Bob" (SAME room)

### **Test 1: Transcript Sharing**

**Step 1:** Alice says "hello"
**Check Alice's console:**
```
🎤 [STT] Transcript received: hello
📤 [TRANSCRIPT] Broadcasting to all participants: "hello" by Alice
```

**Check Bob's console:**
```
📨 [DATA] Received data from Alice-xxx: {type: 'transcript', text: 'hello', speaker: 'Alice'}
📥 [TRANSCRIPT] Received broadcast
```

**Check Bob's UI:** Should show "Alice: hello" in transcript panel

**If Bob doesn't see it:**
- Room not connected
- Data channel not working
- Need to check LiveKit permissions

### **Test 2: Hero Audio**

**Step 1:** Alice says "Hero, what time is it?"
**Check Alice's console:**
```
✅ [FRONTEND] Hero TTS audio published to LiveKit!
trackName: hero-tts-audio
```

**Check Bob's console (CRITICAL):**
```
⬇️ [TRACK] Subscribed to audio from Alice-xxx
🎵 [AUDIO-TRACK] Track name: hero-tts-audio
🤖 [HERO-AUDIO] Hero TTS audio track detected!
🔊 [HERO-AUDIO] Hero audio playing successfully!
```

**If Bob doesn't see TrackSubscribed:**
- Track not being published correctly
- LiveKit not forwarding track
- Permissions issue

### **Test 3: STT Independence**

**Step 1:** Alice speaks (don't stop)
**Check Bob's console:** Should still show keepalive messages (Bob's STT unaffected)

**Step 2:** Bob speaks while Alice is speaking
**Check:** Both STT should work independently

---

## 🔧 Quick Fixes to Try

### **Fix A: Add More Logging**

In both browsers' consoles, run:
```javascript
// Enable verbose logging
localStorage.setItem('hero_debug', 'true');
```

### **Fix B: Check Room State**

In Alice's console:
```javascript
// Check if room is connected
room.state  // Should be 'connected'
room.numParticipants  // Should be 2
room.remoteParticipants.size  // Should be 1 (Bob)
```

### **Fix C: Force Re-Subscribe to Tracks**

If Hero audio doesn't work, in Bob's console:
```javascript
// List all tracks from Alice
room.remoteParticipants.forEach(p => {
  console.log(`Participant: ${p.identity}`);
  p.trackPublications.forEach(pub => {
    console.log(` - Track: ${pub.trackName}, Kind: ${pub.kind}, Subscribed: ${pub.isSubscribed}`);
  });
});
```

---

## 📊 Expected Console Output (Both Participants)

### **Alice's Console:**
```
✅ [CONNECT] Connected to room
📊 [PARTICIPANT] Connected: Bob-xyz
🎤 [STT] Transcript received: hello
📤 [TRANSCRIPT-BROADCAST] Transcript broadcasted
✅ [TRIGGER] Hero trigger detected!
✅ [FRONTEND] Hero TTS audio published to LiveKit!
```

### **Bob's Console:**
```
✅ [CONNECT] Connected to room
📊 [PARTICIPANT] Connected: Alice-abc
📨 [DATA] Received data from Alice: {type: 'transcript', text: 'hello'}
📥 [TRANSCRIPT] Received broadcast
🎵 [AUDIO-TRACK] Track name: hero-tts-audio
🤖 [HERO-AUDIO] Hero TTS audio track detected!
🔊 [HERO-AUDIO] Hero audio playing!
```

---

## 🚨 Critical Questions

1. **Does Bob's console show `📨 [DATA] Received data`?**
   - YES → Data channel works, check addTranscript logic
   - NO → Data channel broken, check LiveKit permissions

2. **Does Bob's console show `⬇️ [TRACK] Subscribed to audio from Alice`?**
   - YES → Check if trackName === 'hero-tts-audio'
   - NO → Track subscription failing, check LiveKit config

3. **Does Alice's console show `room.numParticipants = 2`?**
   - YES → Both connected
   - NO → Bob not fully connected

---

**Run these tests and share the console logs from BOTH participants!** This will tell us exactly what's failing. 🔍

