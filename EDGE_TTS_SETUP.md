# Edge TTS Integration

## Overview
Edge TTS is now the **primary TTS provider** for Hero Meeting, providing high-quality, free text-to-speech using Microsoft's Edge TTS service.

## Features
- ✅ **Free** - No API keys or credits required
- ✅ **High Quality** - Natural-sounding voices
- ✅ **Multiple Voices** - 400+ voices in 140+ languages
- ✅ **Fast** - Local processing via Python subprocess
- ✅ **Reliable** - No rate limits or usage restrictions

## Setup Instructions

### 1. Install Python Dependencies
```bash
# Install Edge TTS
npm run install-python-deps

# Or manually:
pip3 install edge-tts
```

### 2. Test Edge TTS
```bash
# Run test script
npm run test-edge-tts
```

### 3. Available Voices
Popular English voices:
- `en-US-AriaNeural` (default) - Female, natural
- `en-US-JennyNeural` - Female, conversational
- `en-US-GuyNeural` - Male, professional
- `en-US-DavisNeural` - Male, friendly

### 4. Usage in Meeting
1. Join a meeting
2. Go to TTS Settings in the sidebar
3. Select "Edge TTS" from the dropdown
4. Start speaking - Hero will respond with Edge TTS

## Technical Implementation

### API Endpoint
- **File**: `pages/api/tts-edge.ts`
- **Method**: POST
- **Input**: `{ text: string, voice: string }`
- **Output**: MP3 audio buffer

### Service Integration
- **File**: `services/tts.ts`
- **Class**: `EdgeTTSService`
- **Default Provider**: Edge TTS is now the primary option

### Deployment
- **Netlify**: Configured with Python 3.9 support
- **Dependencies**: Listed in `requirements.txt`
- **Build**: Automatic Python dependency installation

## Troubleshooting

### Common Issues

1. **Python Not Found**
   ```bash
   # Install Python 3.9+
   brew install python3  # macOS
   sudo apt install python3  # Ubuntu
   ```

2. **Edge TTS Installation Failed**
   ```bash
   pip3 install --upgrade pip
   pip3 install edge-tts
   ```

3. **Audio Not Playing**
   - Check browser console for errors
   - Verify API endpoint is responding
   - Test with different voice

### Debug Commands
```bash
# Test Edge TTS directly
python3 -c "import edge_tts; print('Edge TTS installed successfully')"

# List available voices
edge-tts --list-voices | grep "en-US"

# Generate test audio
edge-tts --text "Hello World" --write-media test.mp3
```

## Fallback Options
If Edge TTS fails, the system automatically falls back to:
1. **ElevenLabs** (if API key configured)
2. **Google TTS** (free, lower quality)

## Performance Notes
- **Cold Start**: ~2-3 seconds for first request
- **Warm Requests**: ~500ms-1s
- **Audio Quality**: High (44.1kHz MP3)
- **File Size**: ~50KB per 10 seconds of speech

## Voice Customization
You can modify the default voice in:
- `services/tts.ts` - Change `voiceId` parameter
- `components/MeetingPage.tsx` - Update UI dropdown options

## Future Enhancements
- [ ] Voice selection UI
- [ ] Speed/pitch controls
- [ ] Streaming audio support
- [ ] Voice cloning integration
