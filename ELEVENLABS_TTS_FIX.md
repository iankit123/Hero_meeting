# ElevenLabs TTS Fix - Stale Provider Reference

## Bug Fixed ✅

**Problem**: After switching UI to ElevenLabs, Hero still uses Google TTS voice

**Evidence**:
- UI dropdown shows "ElevenLabs" ✅
- TTS sync complete message appears ✅
- Hero responds with Google TTS voice ❌

---

## Root Cause

**Same closure issue as STT fix!**

When `handleHeroTrigger` is defined, it captures the `ttsProvider` state variable's value at that moment. When the function is called later (after user says "Hero..."), it uses the **old captured value**, not the current one.

**Backend analogy**:
```python
# Configuration captured at startup
class ApiClient:
    def __init__(self):
        self.api_key = config.get('API_KEY')  # Captured once
        
    def make_request(self):
        # Always uses the OLD api_key, even if config changed!
        headers = {'Authorization': self.api_key}
```

**Frontend issue**:
```typescript
// ❌ BAD - Captures state value at function definition
const handleHeroTrigger = async (transcript) => {
  fetch('/api/hero-join', {
    body: JSON.stringify({
      ttsProvider: ttsProvider  // Stale value!
    })
  });
};
```

---

## Fix Applied

### 1. Added Provider Refs

**File**: `components/MeetingPage.tsx`

```typescript
// Added refs for TTS and STT providers
const ttsProviderRef = useRef<'elevenlabs' | 'gtts'>('gtts');
const sttProviderRef = useRef<'webspeech' | 'deepgram'>('webspeech');

// Keep refs in sync with state
useEffect(() => {
  ttsProviderRef.current = ttsProvider;
  console.log('🔄 [TTS-REF] TTS provider ref updated to:', ttsProvider);
}, [ttsProvider]);

useEffect(() => {
  sttProviderRef.current = sttProvider;
  console.log('🔄 [STT-REF] STT provider ref updated to:', sttProvider);
}, [sttProvider]);
```

### 2. Updated handleHeroTrigger to Use Ref

```typescript
const handleHeroTrigger = async (transcript: string) => {
  const currentTtsProvider = ttsProviderRef.current; // ✅ Always current!
  
  console.log('🎵 [FRONTEND] TTS Provider being sent to Hero:', currentTtsProvider);
  
  fetch('/api/hero-join', {
    body: JSON.stringify({
      ttsProvider: currentTtsProvider  // Now uses latest value!
    })
  });
};
```

### 3. Enhanced Backend Logging

**File**: `pages/api/hero-join.ts`

```typescript
console.log('📥 [API] TTS Provider from request:', ttsProvider);
console.log('📥 [API] TTS Provider from env:', process.env.TTS_PROVIDER);
console.log(`🎵 [TTS] Selected TTS Provider: ${selectedTtsProvider}`);
console.log(`🎵 [TTS] TTS Service created for: ${selectedTtsProvider}`);
```

### 4. Enhanced TTS Service Logging

**File**: `services/tts.ts`

**ElevenLabs**:
```typescript
console.log('🔑 [ELEVENLABS] Initializing with API key:', apiKey.substring(0, 10) + '...');
console.log('🎙️ [ELEVENLABS] === SYNTHESIZE START ===');
console.log('📤 [ELEVENLABS] Sending request to ElevenLabs API...');
console.log('📡 [ELEVENLABS] API response status:', response.status);
console.log('✅ [ELEVENLABS] Audio buffer received, size:', audioBuffer.length, 'bytes');
console.log('✅ [ELEVENLABS] === SYNTHESIZE COMPLETE ===');
```

**Google TTS**:
```typescript
console.log('🎙️ [GTTS] === SYNTHESIZE START ===');
console.log('📦 [GTTS] Split into', chunks.length, 'chunk(s)');
console.log('🌐 [GTTS] Fetching audio for chunk X/Y...');
console.log('✅ [GTTS] === SYNTHESIZE COMPLETE ===');
```

---

## Testing Instructions (2 Laptops)

### Test 1: Verify TTS Provider Ref Updates

**Either laptop**: 
1. Change TTS dropdown from "Google TTS" → "ElevenLabs"
2. **Check console** for:
   ```
   🔄 [TTS-REF] TTS provider ref updated to: elevenlabs
   ```

**Expected**: ✅ Should appear immediately after selecting ElevenLabs

---

### Test 2: Verify Hero Uses Correct Provider

**Setup**: Both laptops with TTS set to "ElevenLabs"

**Either laptop**: Say "Hero, what is the capital of India?"

**Expected Console Logs**:

**Frontend (Browser)**:
```
🚀 [FRONTEND] === SENDING TO HERO ===
🎵 [FRONTEND] TTS Provider being sent to Hero: elevenlabs  ← MUST show "elevenlabs"!
🌐 [FRONTEND] Making API call to /api/hero-join...
```

**Backend (Terminal/Server logs)**:
```
🎯 [API] === HERO PIPELINE START ===
📥 [API] Received message: Hero, what is the capital of India?
📥 [API] TTS Provider from request: elevenlabs              ← MUST show "elevenlabs"!
🎵 [TTS] Selected TTS Provider: elevenlabs                  ← MUST show "elevenlabs"!
🎵 [TTS] TTS Service created for: elevenlabs

[Then during TTS generation]
🔑 [ELEVENLABS] Initializing with API key: sk_2c0a063d...  ← ElevenLabs being used!
🎙️ [ELEVENLABS] === SYNTHESIZE START ===
🎙️ [ELEVENLABS] Text length: 38
🎙️ [ELEVENLABS] Voice ID: UzYWd2rD2PPFPjXRG3Ul
🎙️ [ELEVENLABS] API Key present: true
🌐 [ELEVENLABS] API URL: https://api.elevenlabs.io/v1/text-to-speech/...
📤 [ELEVENLABS] Sending request to ElevenLabs API...
📡 [ELEVENLABS] API response status: 200
📡 [ELEVENLABS] API response ok: true
✅ [ELEVENLABS] Audio buffer received, size: XXXXX bytes
✅ [ELEVENLABS] Estimated duration: X.XX seconds
✅ [ELEVENLABS] === SYNTHESIZE COMPLETE ===
```

**Expected Audio**: Higher quality, more natural Indian English voice (ElevenLabs)

---

### Test 3: Switch to Google TTS

**Either laptop**: Change TTS back to "Google TTS"

**Expected Console**:
```
🔄 [TTS-REF] TTS provider ref updated to: gtts
```

**Ask Hero again**: "Hero, what time is it?"

**Expected Backend Logs**:
```
📥 [API] TTS Provider from request: gtts                    ← MUST show "gtts"!
🎵 [TTS] Selected TTS Provider: gtts

[Then during TTS generation]
🎙️ [GTTS] === SYNTHESIZE START ===                         ← Google TTS being used!
🎙️ [GTTS] Text length: XX
📦 [GTTS] Split into X chunk(s)
🌐 [GTTS] Fetching audio for chunk 1/1...
✅ [GTTS] All chunks combined, size: XXXXX bytes
✅ [GTTS] === SYNTHESIZE COMPLETE ===
```

**Expected Audio**: Standard Google TTS voice (free, simpler quality)

---

## How to Distinguish Audio Quality

### Google TTS Characteristics:
- Robotic, mechanical voice
- Flat intonation
- Faster speech
- Free service

### ElevenLabs Characteristics:
- Natural, human-like voice
- Better intonation and emotion
- Indian English accent (voice ID: UzYWd2rD2PPFPjXRG3Ul)
- Premium quality

**You should be able to HEAR the difference immediately!**

---

## Debugging Failed Provider Detection

### If Still Hearing Google TTS When ElevenLabs Selected

**Step 1: Check Frontend Ref Update**
```
🔄 [TTS-REF] TTS provider ref updated to: ?
```
- ✅ Should show: `elevenlabs`
- ❌ If shows: `gtts` → UI state not updating

**Step 2: Check What's Sent to API**
```
🎵 [FRONTEND] TTS Provider being sent to Hero: ?
```
- ✅ Should show: `elevenlabs`
- ❌ If shows: `gtts` → Ref not being read correctly

**Step 3: Check Backend Receives Correct Provider**
```
📥 [API] TTS Provider from request: ?
```
- ✅ Should show: `elevenlabs`
- ❌ If shows: `gtts` or `undefined` → Frontend not sending correctly

**Step 4: Check Which Service Is Created**
```
🎵 [TTS] Selected TTS Provider: ?
🎵 [TTS] TTS Service created for: ?
```
- ✅ Should both show: `elevenlabs`
- ❌ If shows: `gtts` → Fallback being used

**Step 5: Check Which Service Actually Runs**
```
Option A (ElevenLabs):
🔑 [ELEVENLABS] Initializing with API key...
🎙️ [ELEVENLABS] === SYNTHESIZE START ===

Option B (Google TTS):
🎙️ [GTTS] === SYNTHESIZE START ===
```
- ✅ For ElevenLabs: Should see ELEVENLABS logs
- ❌ If see GTTS logs: Wrong service being used

---

## Common Issues & Solutions

### Issue 1: "Provider ref updated but still using old provider"

**Check**: All 5 debug checkpoints above
**Most likely**: API key missing or invalid

**Verify API key**:
```bash
grep ELEVENLABS_API_KEY .env.local
```
Should show: `ELEVENLABS_API_KEY=sk_...`

**If missing**: Set it in `.env.local`
**If present**: Check backend logs for ElevenLabs API errors

### Issue 2: "ElevenLabs API error"

**Backend logs to check**:
```
❌ [ELEVENLABS] API error response: ...
```

**Common errors**:
- `401 Unauthorized`: Invalid API key
- `429 Too Many Requests`: Rate limit exceeded
- `402 Payment Required`: Insufficient credits

**Solution**: Check your ElevenLabs account/credits

### Issue 3: "Falls back to Google TTS"

**Cause**: Exception in ElevenLabs service constructor or synthesize method

**Backend logs show**:
```
🎵 [TTS] Selected TTS Provider: elevenlabs
[Then fallback to GTTS]
🎙️ [GTTS] === SYNTHESIZE START ===
```

**Solution**: Check for error logs between provider selection and synthesize

---

## Verification Checklist

**After switching to ElevenLabs, verify**:

### Frontend Console (Browser):
- [ ] `🔄 [TTS-REF] TTS provider ref updated to: elevenlabs`
- [ ] `🎵 [FRONTEND] TTS Provider being sent to Hero: elevenlabs`

### Backend Terminal (Server):
- [ ] `📥 [API] TTS Provider from request: elevenlabs`
- [ ] `🎵 [TTS] Selected TTS Provider: elevenlabs`
- [ ] `🔑 [ELEVENLABS] Initializing with API key: sk_2c0a063d...`
- [ ] `🎙️ [ELEVENLABS] === SYNTHESIZE START ===`
- [ ] `📤 [ELEVENLABS] Sending request to ElevenLabs API...`
- [ ] `📡 [ELEVENLABS] API response status: 200`
- [ ] `✅ [ELEVENLABS] Audio buffer received`
- [ ] `✅ [ELEVENLABS] === SYNTHESIZE COMPLETE ===`

### Audio Quality:
- [ ] Hero's voice sounds natural and human-like
- [ ] Clear Indian English accent
- [ ] Better than previous robotic Google TTS voice

---

## What Changed (Technical Summary)

### Files Modified:

**1. components/MeetingPage.tsx**
- Added `ttsProviderRef` and `sttProviderRef`
- Added `useEffect` hooks to keep refs synced with state
- Updated `handleHeroTrigger` to use `ttsProviderRef.current`
- Updated chat hero function to use `ttsProviderRef.current`
- Added logging: "TTS Provider being sent to Hero"

**2. pages/api/hero-join.ts**
- Added logging for received TTS provider
- Added logging for selected TTS provider
- Shows which service is being created

**3. services/tts.ts**
- Added comprehensive logging to ElevenLabsTTSService
- Added comprehensive logging to GTTSService
- Both services now show start/complete messages
- Easy to identify which service is actually running

---

## Testing Scenarios

### Scenario 1: Switch to ElevenLabs Before Asking Hero

**Steps**:
1. Join meeting
2. Change TTS to "ElevenLabs"
3. Wait for sync (both laptops show ElevenLabs)
4. Say: "Hero, what is 2 + 2?"

**Expected**:
- ✅ Both laptops hear ElevenLabs voice
- ✅ Backend logs show ELEVENLABS service being used
- ✅ No GTTS logs appear

---

### Scenario 2: Switch to ElevenLabs During Conversation

**Steps**:
1. Both on Google TTS
2. Ask Hero: "Hero, hello" → hears Google TTS
3. Change to ElevenLabs (wait for sync)
4. Ask Hero: "Hero, goodbye" → should hear ElevenLabs

**Expected**:
- ✅ First response: Google TTS voice
- ✅ Second response: ElevenLabs voice (noticeable quality jump!)

---

### Scenario 3: Rapid Provider Switching

**Steps**:
1. Google TTS → Ask Hero
2. Switch to ElevenLabs → Ask Hero
3. Switch back to Google TTS → Ask Hero
4. Switch to ElevenLabs again → Ask Hero

**Expected**:
- ✅ Each Hero response uses the currently selected provider
- ✅ Backend logs confirm switching between services
- ✅ Audio quality changes match selected provider

---

### Scenario 4: One Person Changes, Other Asks Hero

**Steps**:
1. **Laptop A**: Change to ElevenLabs
2. **Laptop B**: Receives sync (dropdown changes to ElevenLabs)
3. **Laptop B**: Say "Hero, test"

**Expected**:
- ✅ Laptop B's console shows: `🎵 [FRONTEND] TTS Provider being sent to Hero: elevenlabs`
- ✅ Hero uses ElevenLabs voice
- ✅ Both laptops hear ElevenLabs quality

---

## Console Log Flow (Complete)

### When Changing to ElevenLabs:

**Browser Console**:
```
[User clicks dropdown to select ElevenLabs]

🔄 [TTS] === SWITCHING TTS PROVIDER ===
🔄 [TTS] Initiated by: akshit (local)
🔄 [TTS] Target provider: elevenlabs
🔄 [TTS] Switching from gtts to elevenlabs
📡 [TTS] Broadcasting provider change to all participants...
✅ [TTS] === PROVIDER SWITCH COMPLETE ===

[React re-renders]
🔄 [TTS-REF] TTS provider ref updated to: elevenlabs  ← KEY LINE!
```

### When Asking Hero (After ElevenLabs Selected):

**Browser Console**:
```
[User says "Hero, what is the capital of India?"]

🚀 [FRONTEND] === SENDING TO HERO ===
🎵 [FRONTEND] TTS Provider being sent to Hero: elevenlabs  ← CRITICAL - Must show "elevenlabs"!
🌐 [FRONTEND] Making API call to /api/hero-join...
```

**Server Terminal**:
```
🎯 [API] === HERO PIPELINE START ===
📥 [API] Received message: what is the capital of India?
📥 [API] TTS Provider from request: elevenlabs              ← CRITICAL - Must show "elevenlabs"!
📥 [API] TTS Provider from env: undefined
🎵 [TTS] Selected TTS Provider: elevenlabs                  ← CRITICAL - Must show "elevenlabs"!
🎵 [TTS] TTS Service created for: elevenlabs

[ElevenLabs Service Initialization]
🔑 [ELEVENLABS] Initializing with API key: sk_2c0a063d...  ← Shows ElevenLabs is being used!
✅ [ELEVENLABS] API key found and configured

[LLM generates response]
🧠 [GEMINI] === SENDING TO LLM ===
📥 [GEMINI] Received response from Gemini...

[TTS Synthesis]
🎙️ [ELEVENLABS] === SYNTHESIZE START ===
🎙️ [ELEVENLABS] Text length: 38
🎙️ [ELEVENLABS] Voice ID: UzYWd2rD2PPFPjXRG3Ul
🎙️ [ELEVENLABS] API Key present: true
🌐 [ELEVENLABS] API URL: https://api.elevenlabs.io/v1/text-to-speech/...
🧹 [ELEVENLABS] Sanitized text: The capital of India is New Delhi...
📤 [ELEVENLABS] Sending request to ElevenLabs API...
📡 [ELEVENLABS] API response status: 200
📡 [ELEVENLABS] API response ok: true
✅ [ELEVENLABS] Audio buffer received, size: 45678 bytes
✅ [ELEVENLABS] Estimated duration: 2.28 seconds
✅ [ELEVENLABS] === SYNTHESIZE COMPLETE ===

✅ [API] === HERO PIPELINE COMPLETE ===
```

**Browser Console** (after response):
```
📥 [FRONTEND] === HERO RESPONSE RECEIVED ===
🎵 [FRONTEND] === BROADCASTING TTS AUDIO TO ALL PARTICIPANTS ===
🎵 [FRONTEND] Audio buffer size: 60904 characters (base64)
🎵 [FRONTEND] Audio duration: 2.28 seconds
```

**Audio**: Should hear **natural, human-like Indian English voice** (ElevenLabs)

---

### Compare: Google TTS Logs

**If using Google TTS, backend logs would show**:
```
📥 [API] TTS Provider from request: gtts
🎵 [TTS] Selected TTS Provider: gtts

🎙️ [GTTS] === SYNTHESIZE START ===                        ← Different service!
🎙️ [GTTS] Text length: 38
📦 [GTTS] Split into 1 chunk(s)
🌐 [GTTS] Fetching audio for chunk 1/1...
✅ [GTTS] All chunks combined, size: 12345 bytes
✅ [GTTS] === SYNTHESIZE COMPLETE ===
```

**Audio**: Robotic Google TTS voice

---

## Troubleshooting

### "Still hearing Google TTS after switching to ElevenLabs"

**Debug Steps**:

1. **Check browser console after provider change**:
   ```
   🔄 [TTS-REF] TTS provider ref updated to: ?
   ```
   - ✅ Should show `elevenlabs`
   - ❌ If shows `gtts`: State not updating

2. **Check what's sent to Hero**:
   ```
   🎵 [FRONTEND] TTS Provider being sent to Hero: ?
   ```
   - ✅ Should show `elevenlabs`
   - ❌ If shows `gtts`: Ref not being used

3. **Check backend receives it**:
   ```
   📥 [API] TTS Provider from request: ?
   ```
   - ✅ Should show `elevenlabs`
   - ❌ If shows `undefined` or `gtts`: Not sent from frontend

4. **Check which service runs**:
   ```
   Either: 🎙️ [ELEVENLABS] === SYNTHESIZE START ===
   Or:     🎙️ [GTTS] === SYNTHESIZE START ===
   ```
   - ✅ Should see ELEVENLABS
   - ❌ If see GTTS: Wrong service being used despite correct provider

5. **Check for ElevenLabs errors**:
   ```
   ❌ [ELEVENLABS] API error response: ...
   ```
   - If present: API key issue or quota exceeded
   - Falls back to GTTS on error

---

### "ElevenLabs API Error"

**Common errors**:

**401 Unauthorized**:
```
❌ [ELEVENLABS] API error response: Unauthorized
```
**Fix**: Check API key in `.env.local`

**402 Payment Required**:
```
❌ [ELEVENLABS] API error response: Payment Required
```
**Fix**: Add credits to your ElevenLabs account

**429 Rate Limit**:
```
❌ [ELEVENLABS] API error response: Too Many Requests
```
**Fix**: Wait a few minutes or upgrade plan

---

## Quick Verification Test

**Do this simple test**:

1. **Both laptops**: Set TTS to "Google TTS"
2. **Say**: "Hero, say apple"
3. **Listen**: Should hear robotic Google voice saying "apple"
4. **Change to**: "ElevenLabs"
5. **Both laptops**: Wait for dropdown to update
6. **Say**: "Hero, say banana"
7. **Listen**: Should hear natural ElevenLabs voice saying "banana"

**If step 7 sounds the same as step 3**: Provider ref is still stale

**What to check in console**:
```
Step 5: 🔄 [TTS-REF] TTS provider ref updated to: elevenlabs
Step 6: 🎵 [FRONTEND] TTS Provider being sent to Hero: elevenlabs
Backend: 🎙️ [ELEVENLABS] === SYNTHESIZE START ===
```

---

## Files Changed Summary

1. **components/MeetingPage.tsx**
   - Added `ttsProviderRef` and `sttProviderRef`
   - Added sync `useEffect` hooks with logging
   - Updated 2 places using `ttsProvider` to use `ttsProviderRef.current`

2. **pages/api/hero-join.ts**
   - Added logging for received TTS provider
   - Added logging for env TTS provider
   - Added logging for selected TTS provider

3. **services/tts.ts**
   - Added comprehensive logging to ElevenLabsTTSService
   - Added comprehensive logging to GTTSService
   - Added API key check logging
   - Added synthesis step-by-step logging

---

## Success Indicators

**After fix, you should**:
- ✅ See "elevenlabs" in frontend ref update log
- ✅ See "elevenlabs" sent to Hero API
- ✅ See "elevenlabs" received by backend
- ✅ See ELEVENLABS service logs (not GTTS)
- ✅ Hear high-quality natural voice (not robotic)
- ✅ Both participants hear same quality

**Ready to test - ElevenLabs should now work!** 🚀

