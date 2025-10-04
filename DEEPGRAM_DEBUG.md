# 🔧 Deepgram Transcription Debug Guide

## 🎯 **Issue Fixed: WebSocket Closing Immediately**

I've made several improvements to fix the transcription issue:

### ✅ **Changes Made:**

1. **Better Message Handling**: Now properly detects `Results` type messages from Deepgram
2. **WebSocket Reconnection**: Automatically reconnects if connection drops unexpectedly  
3. **Keep-Alive Mechanism**: Sends ping every 30 seconds to prevent timeout
4. **Improved Logging**: Better visibility into what Deepgram is sending

### 🔍 **What to Look For Now:**

**When you speak, you should see:**
```
🔗 [DEEPGRAM] WebSocket connected
📊 [DEEPGRAM] Connection metadata received
💓 [DEEPGRAM] Sending keep-alive ping
📥 [DEEPGRAM] Received: Results {type: 'Results', channel: {...}}
🎤 [DEEPGRAM] Raw transcript received: your speech here
```

### 🧪 **Test Steps:**

1. **Open meeting room**: `http://localhost:3000`
2. **Allow microphone access** when prompted
3. **Start speaking clearly** - say "Hello, this is a test"
4. **Check console logs** for Deepgram messages
5. **Say "Hey Hero"** to test the full pipeline

### 🚨 **If Still Not Working:**

**Check these in console:**

1. **WebSocket Connection:**
   ```
   🔗 [DEEPGRAM] WebSocket connected
   ```

2. **Audio Processing:**
   ```
   🎵 [DEEPGRAM] Audio processing setup complete
   ```

3. **Keep-Alive Pings:**
   ```
   💓 [DEEPGRAM] Sending keep-alive ping
   ```

4. **Speech Results:**
   ```
   📥 [DEEPGRAM] Received: Results
   🎤 [DEEPGRAM] Raw transcript received: your text
   ```

### 🔧 **Troubleshooting:**

**If WebSocket keeps closing:**
- Check your internet connection
- Verify Deepgram API key is valid
- Check browser console for CORS errors

**If no audio processing:**
- Ensure microphone permission is granted
- Check if other apps are using the microphone
- Try refreshing the page

**If no transcripts:**
- Speak clearly and loudly
- Try different phrases
- Check if Deepgram credits are available

### 🎉 **Expected Behavior:**

1. **Connection**: WebSocket connects and stays open
2. **Audio**: Microphone audio is processed and sent to Deepgram
3. **Transcription**: Speech is converted to text in real-time
4. **Hero Trigger**: "Hey Hero" activates the AI assistant
5. **Response**: Hero responds with voice output

### 📊 **Current Configuration:**

```bash
NEXT_PUBLIC_STT_PROVIDER=deepgram
NEXT_PUBLIC_DEEPGRAM_API_KEY=d1d79c0113fa0818d0b793f715ff63db4ffadf73
```

**The system is now ready for testing!** 🎤✨
