# Hero Meet - AI-Powered Meeting Platform

Hero Meet is a prototype web application that combines video conferencing with an AI assistant called "Hero" that can join meetings, transcribe conversations, and respond to questions in real-time.

## 🚀 Features

- **Video Conferencing**: Powered by LiveKit for high-quality video/audio
- **AI Assistant**: Hero bot joins meetings as an audio-only participant
- **Real-time Transcription**: Speech-to-text using Deepgram with speaker identification
- **Smart Responses**: AI-powered responses using Google Gemini
- **Text-to-Speech**: Converts AI responses to audio using gTTS
- **Live Chat**: Real-time chat panel with transcript display
- **Trigger Phrases**: Say "Hey Hero" to activate the AI assistant

## 🛠 Tech Stack

- **Frontend**: Next.js 14 + React + TypeScript
- **Video Infrastructure**: LiveKit Cloud
- **STT**: Deepgram Streaming API
- **LLM**: Google Gemini API
- **TTS**: gTTS (Google Text-to-Speech)
- **Deployment**: Vercel (recommended)

## 📋 Prerequisites

Before setting up Hero Meet, you'll need accounts and API keys for:

1. **LiveKit Cloud** - [Sign up here](https://cloud.livekit.io/)
2. **Deepgram** - [Get API key here](https://deepgram.com/)
3. **Google Gemini** - [Get API key here](https://ai.google.dev/)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd hero-meet
npm install
```

### 2. Environment Setup

Copy the example environment file and fill in your API keys:

```bash
cp env.example .env.local
```

Edit `.env.local` with your actual API keys:

```env
# LiveKit Configuration
LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# Deepgram STT Configuration
DEEPGRAM_API_KEY=your-deepgram-api-key

# Google Gemini LLM Configuration
GEMINI_API_KEY=your-gemini-api-key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run the Application

Start the Next.js development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### 4. Start the Hero Bot (Separate Terminal)

In a new terminal, start the Hero bot for a specific room:

```bash
npm run bot room-name-here
```

## 🏗 Project Structure

```
hero-meet/
├── components/           # React components
│   ├── LandingPage.tsx  # Home page component
│   ├── MeetingPage.tsx  # Main meeting interface
│   └── ChatPanel.tsx    # Chat and transcript panel
├── services/            # Service wrappers (easily swappable)
│   ├── stt.ts          # Speech-to-text service
│   ├── llm.ts          # Large language model service
│   └── tts.ts          # Text-to-speech service
├── pages/              # Next.js pages and API routes
│   ├── api/
│   │   ├── create-room.ts  # Creates LiveKit rooms
│   │   └── hero-join.ts   # Handles Hero bot operations
│   ├── meeting/
│   │   └── [roomName].tsx  # Dynamic meeting page
│   ├── _app.tsx        # App wrapper
│   └── index.tsx       # Landing page
├── bot/
│   └── hero.ts         # Hero bot node script
└── README.md
```

## 🎯 How It Works

### Meeting Flow

1. **Create Meeting**: User clicks "Create Meeting" on landing page
2. **Room Creation**: Backend creates LiveKit room and generates join token
3. **User Joins**: User joins video/audio via LiveKit React component
4. **Hero Bot Joins**: Hero bot automatically joins as audio-only participant
5. **Transcription**: Hero bot receives mixed audio and transcribes using Deepgram
6. **Chat Display**: Transcript appears in chat panel with speaker identification
7. **Trigger Detection**: When "Hey Hero" is detected, extracts the question
8. **AI Response**: Calls Gemini API with question + recent context
9. **Audio Response**: Converts response to speech and streams back to meeting

### Service Architecture

The application uses a service-oriented architecture that makes it easy to swap providers:

- **STT Service**: Currently Deepgram, easily swappable to Whisper
- **LLM Service**: Currently Gemini, easily swappable to OpenAI, Claude, etc.
- **TTS Service**: Currently gTTS, easily swappable to ElevenLabs, Azure, etc.

## 🔧 API Endpoints

### POST `/api/create-room`

Creates a new LiveKit room and returns join token.

**Request Body:**
```json
{
  "roomName": "optional-room-name"
}
```

**Response:**
```json
{
  "roomName": "room-uuid",
  "token": "livekit-jwt-token",
  "url": "wss://your-livekit-url"
}
```

### POST `/api/hero-join`

Handles Hero bot operations (joining rooms, processing messages).

**Request Body:**
```json
{
  "roomName": "room-name",
  "action": "join" | "message",
  "message": "user message",
  "context": "recent conversation context"
}
```

## 🤖 Hero Bot

The Hero bot is a Node.js script that:

1. Connects to LiveKit rooms as an audio-only participant
2. Receives mixed audio streams from all participants
3. Transcribes audio using Deepgram with speaker diarization
4. Detects "Hey Hero" trigger phrases
5. Extracts questions and generates responses using Gemini
6. Converts responses to speech and streams back to the meeting

### Running the Hero Bot

```bash
# For a specific room
npm run bot my-meeting-room

# The bot will automatically join and start processing audio
```

## 🚀 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Make sure to set these in your deployment platform:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `DEEPGRAM_API_KEY`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_APP_URL` (your production URL)

### Running Hero Bot in Production

For production, you'll need to run the Hero bot on a server that can maintain persistent connections. Consider using:

- **PM2** for process management
- **Docker** for containerization
- **Cloud services** like Railway, Render, or AWS EC2

## 🔧 Configuration

### LiveKit Setup

1. Create a LiveKit Cloud account
2. Create a new project
3. Copy the WebSocket URL, API Key, and API Secret
4. Add them to your environment variables

### Deepgram Setup

1. Sign up for Deepgram
2. Create a new project
3. Generate an API key
4. Add to environment variables

### Google Gemini Setup

1. Visit [Google AI Studio](https://ai.google.dev/)
2. Create a new project
3. Generate an API key
4. Add to environment variables

## 🐛 Troubleshooting

### Common Issues

1. **"LiveKit configuration missing"**
   - Check that all LiveKit environment variables are set
   - Verify the WebSocket URL format (should start with `wss://`)

2. **"Failed to get join token"**
   - Verify LiveKit API credentials
   - Check that the room name is valid

3. **Hero bot not responding**
   - Ensure the bot script is running
   - Check that all API keys are valid
   - Verify network connectivity

4. **Audio not working**
   - Check browser permissions for microphone
   - Verify LiveKit audio track publishing

### Debug Mode

Enable debug logging by setting:

```env
NODE_ENV=development
```

## 🔮 Future Enhancements

- **Multi-language Support**: Add support for multiple languages
- **Custom Wake Words**: Allow custom trigger phrases
- **Meeting Summaries**: Generate AI-powered meeting summaries
- **Screen Sharing**: Add screen sharing capabilities
- **Recording**: Record meetings with AI-generated transcripts
- **Integration**: Connect with calendar systems and meeting tools

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For support, please open an issue on GitHub or contact the development team.

---

**Note**: This is a prototype application. For production use, consider implementing additional security measures, error handling, and scalability improvements.
