# 🎤 STT Configuration Guide

## Overview
Your Hero Meeting app now supports **two configurable Speech-to-Text providers**:

1. **Web Speech API** (Free, browser-native)
2. **Deepgram** (Premium, high accuracy)

## 🔧 Current Configuration

### Environment Variables (`.env.local`)
```bash
# STT Provider Selection
NEXT_PUBLIC_STT_PROVIDER=deepgram  # ✅ Currently set to Deepgram

# Deepgram Configuration
NEXT_PUBLIC_DEEPGRAM_API_KEY=d1d79c0113fa0818d0b793f715ff63db4ffadf73  # ✅ Your API key

# Other providers...
TTS_PROVIDER=gtts
```

## 🔄 How to Switch Providers

### Option 1: Switch to Web Speech API (Free)
```bash
# In .env.local, change:
NEXT_PUBLIC_STT_PROVIDER=webspeech
```

### Option 2: Switch to Deepgram (Premium)
```bash
# In .env.local, change:
NEXT_PUBLIC_STT_PROVIDER=deepgram
NEXT_PUBLIC_DEEPGRAM_API_KEY=your_deepgram_api_key
```

### Option 3: Runtime Switch (Advanced)
You can also modify `components/MeetingPage.tsx` to add a UI toggle for switching providers dynamically.

## 🎯 Provider Comparison

| Feature | Web Speech API | Deepgram |
|---------|----------------|----------|
| **Cost** | Free | Pay-per-use |
| **Accuracy** | Good | Excellent |
| **Languages** | Limited | 30+ languages |
| **Speaker Diarization** | No | Yes |
| **Real-time** | Yes | Yes |
| **Browser Support** | Chrome/Edge | All browsers |

## 🚀 Testing

### Test Web Speech API
1. Set `NEXT_PUBLIC_STT_PROVIDER=webspeech`
2. Restart server: `npm run dev`
3. Open meeting room
4. Look for `🎤 [WEBSPEECH]` logs in console

### Test Deepgram
1. Set `NEXT_PUBLIC_STT_PROVIDER=deepgram`
2. Restart server: `npm run dev`
3. Open meeting room
4. Look for `🎤 [DEEPGRAM]` logs in console

## 🔍 Console Logs

### Web Speech API Logs
```
🎤 [WEBSPEECH] Recognition started - listening for voice input
🎤 [WEBSPEECH] Raw transcript received: hello world
💓 [WEBSPEECH] Keepalive - still listening...
```

### Deepgram Logs
```
🎤 [DEEPGRAM] DeepgramSTTService initialized with API key
🔗 [DEEPGRAM] WebSocket connected
🎵 [DEEPGRAM] Audio processing setup complete
📥 [DEEPGRAM] Received: {...}
🎤 [DEEPGRAM] Raw transcript received: hello world
```

## 🛠️ Troubleshooting

### Deepgram Not Working?
1. **Check API Key**: Verify `NEXT_PUBLIC_DEEPGRAM_API_KEY` is correct
2. **Check Credits**: Ensure you have Deepgram credits available
3. **Check Network**: WebSocket connection requires stable internet
4. **Check Console**: Look for `❌ [DEEPGRAM]` error messages

### Web Speech API Not Working?
1. **Browser Support**: Use Chrome or Edge (best support)
2. **Microphone Permission**: Allow microphone access
3. **HTTPS**: Some browsers require HTTPS for speech recognition
4. **Check Console**: Look for `❌ [WEBSPEECH]` error messages

## 📝 Current Status

✅ **Deepgram Integration**: Implemented with WebSocket API  
✅ **Web Speech Integration**: Implemented with browser API  
✅ **Configurable Switching**: Via environment variable  
✅ **Error Handling**: Comprehensive logging and fallbacks  
✅ **TypeScript Support**: Fully typed interfaces  

## 🎉 Ready to Use!

Your app now supports both STT providers. The system will automatically:
- Initialize the correct provider based on `NEXT_PUBLIC_STT_PROVIDER`
- Handle errors gracefully with fallbacks
- Provide detailed logging for debugging
- Support both free and premium transcription services

**Current Setting**: Deepgram (Premium)  
**Next Steps**: Test the meeting room and verify transcription works!
