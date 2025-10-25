# Hero Meet - AI-Powered Meeting Platform

Hero Meet is a production-ready web application that combines video conferencing with an AI assistant called "Hero" that can join meetings, transcribe conversations, answer questions using past meeting context, and provide intelligent responses in real-time.

## 🚀 Features

### Core Features
- **Video Conferencing**: Powered by LiveKit for high-quality video/audio
- **AI Assistant**: Hero bot joins meetings as an audio-only participant
- **Real-time Transcription**: Speech-to-text using Web Speech API and Deepgram
- **Smart Responses**: AI-powered responses using Google Gemini or Groq (configurable)
- **Text-to-Speech**: Converts AI responses to audio using Google TTS or ElevenLabs
- **Live Chat**: Real-time chat panel with transcript display
- **Trigger Phrases**: Say "Hey Hero" to activate the AI assistant

### Advanced Features
- **Multi-Tenant Organization Support**: Separate meetings by organization name
- **Dashboard**: Professional WordPress-style dashboard with collapsible sidebar
- **Past Meetings**: View and manage past meeting transcripts
- **Meeting Summaries**: AI-generated summaries for each meeting
- **Vector Search (RAG)**: Retrieve relevant context from past meetings using embeddings
- **Export Transcripts**: Download meeting transcripts as text files
- **Participant Names**: Capture and display participant names in meetings
- **Beautiful Landing Page**: Modern design with gradient themes

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 14 + React + TypeScript
- **Styling**: Inline styles with modern gradients
- **Icons**: Custom SVG icons

### Backend Services
- **Video Infrastructure**: LiveKit Cloud
- **STT**: Web Speech API (default) + Deepgram Streaming API (premium)
- **LLM**: Google Gemini API (default) + Groq LLM (configurable)
- **TTS**: Google Text-to-Speech (default) + ElevenLabs (premium)
- **Database**: Supabase (PostgreSQL with vector search)
- **Embeddings**: Hugging Face Inference API

### Deployment
- **Deployment**: Netlify (configured)
- **Alternatives**: Vercel, Railway, Render

## 📋 Prerequisites

Before setting up Hero Meet, you'll need accounts and API keys for:

1. **LiveKit Cloud** - [Sign up here](https://cloud.livekit.io/)
2. **Supabase** - [Get started here](https://supabase.com/)
3. **Google Gemini** - [Get API key here](https://ai.google.dev/)
4. **Hugging Face** - [Get API key here](https://huggingface.co/)
5. **Optional**: Deepgram, ElevenLabs, Groq

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd hero-meet
npm install
```

### 2. Database Setup

Run the SQL schema in Supabase SQL Editor:

```bash
# See SUPABASE_ORG_SCHEMA_UPDATE.sql for full schema
# The schema includes:
# - meetings table with org_name column
# - transcripts table with org_name column
# - meeting_summaries table
# - Vector search indexes
```

### 3. Environment Setup

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

# STT Configuration
NEXT_PUBLIC_STT_PROVIDER=webspeech
NEXT_PUBLIC_DEEPGRAM_API_KEY=your-deepgram-api-key

# LLM Configuration
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

# TTS Configuration
TTS_PROVIDER=gtts
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# Hugging Face for Embeddings
HUGGINGFACE_API_KEY=your-huggingface-api-key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run the Application

Start the Next.js development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### 5. Start the Hero Bot (Separate Terminal)

In a new terminal, start the Hero bot for a specific room:

```bash
npm run bot room-name-here
```

## 🏗 Project Structure

```
hero-meet/
├── components/                    # React components
│   ├── ChatPanel.tsx            # Chat and transcript panel
│   ├── Dashboard.tsx             # Main dashboard layout
│   ├── HeroOrb.tsx              # Hero AI visual indicator
│   ├── LandingPage.tsx          # Beautiful landing page
│   ├── MeetingPage.tsx          # Main meeting interface
│   ├── MeetingsTab.tsx          # Active meetings tab
│   ├── NameInputModal.tsx       # Participant name capture
│   ├── OrgEntry.tsx             # Organization name entry
│   ├── ParticipantTile.tsx     # Individual participant display
│   ├── PastMeetingsTab.tsx      # Past meetings management
│   └── TranscriptModal.tsx     # Transcript viewer modal
├── services/                    # Service wrappers (easily swappable)
│   ├── context.ts              # General context service
│   ├── embeddings-hf.ts        # Hugging Face embeddings
│   ├── embeddings.ts           # Embedding service interface
│   ├── llm.ts                  # LLM service (Gemini/Groq)
│   ├── meeting-context.ts      # RAG for past meetings
│   ├── stt.ts                  # Speech-to-text service
│   ├── supabase-context.ts     # Supabase database operations
│   └── tts.ts                  # Text-to-speech service
├── pages/                      # Next.js pages and API routes
│   ├── api/
│   │   ├── create-room.ts      # Creates LiveKit rooms
│   │   ├── hero-join.ts        # Handles Hero bot operations
│   │   ├── store-speech.ts     # Stores transcripts
│   │   ├── meetings/
│   │   │   ├── by-org.ts       # Get meetings by organization
│   │   │   ├── delete.ts       # Delete meeting
│   │   │   ├── end.ts          # End meeting
│   │   │   ├── export-transcript.ts # Export transcript
│   │   │   ├── generate-summary.ts  # Generate summary
│   │   │   └── list.ts         # List all meetings
│   │   └── embeddings/
│   │       └── batch-process.ts # Batch process embeddings
│   ├── dashboard.tsx           # Dashboard page
│   ├── org-entry.tsx           # Organization entry page
│   ├── meeting/
│   │   └── [roomName].tsx      # Dynamic meeting page
│   ├── _app.tsx                # App wrapper
│   └── index.tsx               # Landing page
├── bot/
│   └── hero.ts                 # Hero bot node script
├── public/
│   └── meeting-illustration.svg # Landing page illustration
└── README.md
```

## 🎯 How It Works

### Meeting Flow

1. **Organization Entry**: User enters organization name (stored in localStorage)
2. **Create Meeting**: User clicks "Create Meeting" on dashboard
3. **Room Creation**: Backend creates LiveKit room and generates join token
4. **Participant Name**: User enters their name before joining
5. **User Joins**: User joins video/audio via LiveKit React component
6. **Hero Bot Joins**: Hero bot automatically joins as audio-only participant
7. **Transcription**: Participants' speech is transcribed using Web Speech API or Deepgram
8. **Chat Display**: Transcript appears in chat panel with speaker names
9. **Trigger Detection**: When "Hey Hero" is detected, extracts the question
10. **RAG Context**: Retrieves relevant past meeting context using vector search
11. **AI Response**: Calls Gemini/Groq API with question + context
12. **Audio Response**: Converts response to speech and streams back to meeting
13. **Storage**: Transcripts and metadata saved to Supabase

### Organization Features

- **Multi-Tenant Architecture**: Each organization has isolated meetings
- **Case-Insensitive Names**: "ABC Inc" and "abc inc" are treated as the same
- **Dashboard Access**: View all meetings for your organization
- **Past Meetings**: Browse, view, and delete past meeting transcripts
- **Meeting Summaries**: AI-generated summaries for quick reference

### RAG (Retrieval Augmented Generation)

Hero uses vector embeddings to find relevant context from past meetings:
1. Transcripts are converted to embeddings using Hugging Face
2. Stored in Supabase with pgvector extension
3. When user asks a question, similar past conversations are retrieved
4. Combined with current context for more accurate responses

### Service Architecture

The application uses a service-oriented architecture that makes it easy to swap providers:

- **STT Service**: Web Speech API (default) or Deepgram (premium)
- **LLM Service**: Google Gemini (default) or Groq (configurable)
- **TTS Service**: Google TTS (default) or ElevenLabs (premium)
- **Database**: Supabase with PostgreSQL and vector search
- **Embeddings**: Hugging Face Inference API

## 🔧 API Endpoints

### Meeting Management

#### POST `/api/create-room`
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

#### POST `/api/hero-join`
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

#### POST `/api/store-speech`
Stores transcribed speech to database.

**Request Body:**
```json
{
  "roomName": "room-name",
  "text": "transcribed text",
  "speaker": "participant-name",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Organization Endpoints

#### GET `/api/meetings/by-org`
Get all meetings for a specific organization.

**Query Parameters:**
- `orgName`: Organization name (required)
- `limit`: Maximum number of results (optional, default: 50)

#### DELETE `/api/meetings/delete`
Delete a meeting and all its transcripts.

**Request Body:**
```json
{
  "meetingId": "meeting-id"
}
```

#### POST `/api/meetings/end`
End a meeting and calculate duration.

**Request Body:**
```json
{
  "roomName": "room-name"
}
```

#### POST `/api/meetings/generate-summary`
Generate AI summary for a meeting.

**Request Body:**
```json
{
  "meetingId": "meeting-id"
}
```

#### GET `/api/meetings/export-transcript`
Export meeting transcript as text file.

**Query Parameters:**
- `meetingId`: Meeting ID (required)

### Batch Processing

#### POST `/api/embeddings/batch-process`
Process embeddings for existing transcripts.

**Request Body:**
```json
{
  "meetingId": "meeting-id"
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

### Netlify Deployment

1. Push your code to GitHub
2. Connect your repository to Netlify
3. Add environment variables in Netlify dashboard
4. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
5. Deploy!

### Environment Variables for Production

Make sure to set these in your deployment platform:

**Required:**
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `GEMINI_API_KEY`
- `HUGGINGFACE_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` (your production URL)

**Optional:**
- `NEXT_PUBLIC_STT_PROVIDER` (default: webspeech)
- `NEXT_PUBLIC_DEEPGRAM_API_KEY`
- `LLM_PROVIDER` (default: gemini)
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `TTS_PROVIDER` (default: gtts)
- `ELEVENLABS_API_KEY`

### Running Hero Bot in Production

For production, you'll need to run the Hero bot on a server that can maintain persistent connections. Consider using:

- **PM2** for process management
- **Docker** for containerization
- **Cloud services** like Railway, Render, or AWS EC2

### Database Setup for Production

1. Create a Supabase project
2. Run the SQL schema from `SUPABASE_ORG_SCHEMA_UPDATE.sql`
3. Enable pgvector extension for vector search
4. Add environment variables to your deployment platform

## 🔧 Configuration

### Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com/)
2. Go to SQL Editor and run:
   ```sql
   -- Enable pgvector extension
   CREATE EXTENSION IF NOT EXISTS vector;
   
   -- Create meetings table
   CREATE TABLE IF NOT EXISTS meetings (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     room_name VARCHAR(255) UNIQUE NOT NULL,
     org_name VARCHAR(100),
     started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     ended_at TIMESTAMP WITH TIME ZONE,
     duration_seconds INTEGER,
     metadata JSONB DEFAULT '{}',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Create transcripts table
   CREATE TABLE IF NOT EXISTS transcripts (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
     org_name VARCHAR(100),
     text TEXT NOT NULL,
     speaker VARCHAR(255),
     timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     embedding vector(384),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Create indexes
   CREATE INDEX IF NOT EXISTS idx_meetings_org_name ON meetings(org_name);
   CREATE INDEX IF NOT EXISTS idx_transcripts_org_name ON transcripts(org_name);
   CREATE INDEX IF NOT EXISTS idx_transcripts_embedding ON transcripts USING ivfflat (embedding vector_cosine_ops);
   ```
3. Copy your project URL and anon key
4. Add them to environment variables

### LiveKit Setup

1. Create a LiveKit Cloud account at [cloud.livekit.io](https://cloud.livekit.io/)
2. Create a new project
3. Copy the WebSocket URL, API Key, and API Secret
4. Add them to your environment variables

### Google Gemini Setup

1. Visit [Google AI Studio](https://ai.google.dev/)
2. Create a new project
3. Generate an API key
4. Add to environment variables

### Hugging Face Setup

1. Visit [Hugging Face](https://huggingface.co/)
2. Create an account and generate an access token
3. Add `HUGGINGFACE_API_KEY` to environment variables

### Optional: Deepgram Setup

1. Sign up for Deepgram
2. Create a new project
3. Generate an API key
4. Add `NEXT_PUBLIC_DEEPGRAM_API_KEY` to environment variables

### Optional: Groq Setup

1. Visit [Groq](https://groq.com/)
2. Create an account and get API key
3. Add `GROQ_API_KEY` to environment variables
4. Set `LLM_PROVIDER=groq` to use Groq instead of Gemini

### Optional: ElevenLabs Setup

1. Sign up for ElevenLabs
2. Get your API key
3. Add `ELEVENLABS_API_KEY` to environment variables
4. Set `TTS_PROVIDER=elevenlabs` to use ElevenLabs instead of Google TTS

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

5. **Supabase connection errors**
   - Verify Supabase URL and keys
   - Check that pgvector extension is enabled
   - Ensure database schema is set up correctly

6. **Organization not showing meetings**
   - Check that org_name is stored in localStorage
   - Verify case-insensitive matching is working
   - Check Supabase for stored meetings

7. **Duplicate transcripts**
   - Issue is fixed with deduplication logic
   - WebSpeech API may fire duplicate events

8. **Hero not retrieving past context**
   - Check that embeddings are generated
   - Verify vector search is enabled
   - Run batch embedding processing if needed

### Debug Mode

Enable debug logging by setting:

```env
NODE_ENV=development
```

### Network Issues

If experiencing latency or connection issues:
- Check LiveKit connection quality
- Verify API rate limits
- Monitor Supabase connection pool

## 🔮 Future Enhancements

- **Multi-language Support**: Add support for multiple languages
- **Custom Wake Words**: Allow custom trigger phrases
- **Screen Sharing**: Add screen sharing capabilities
- **Recording**: Record meetings with AI-generated transcripts
- **Integration**: Connect with calendar systems and meeting tools
- **Mobile App**: Native mobile applications
- **Advanced Analytics**: Meeting insights and analytics dashboard
- **Team Collaboration**: Shared meeting spaces and collaboration features

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

**Note**: This is a production-ready application with multi-tenant organization support, vector search, and comprehensive meeting management features.

## 📚 Additional Documentation

- **Organization Schema**: See `SUPABASE_ORG_SCHEMA_UPDATE.sql` for database schema
- **Case-Insensitive Orgs**: See `CASE_INSENSITIVE_ORG_MIGRATION.md` for migration guide
- **Deployment**: See `replit.md` for Replit deployment instructions
- **Multiple Fixes**: See various `*_FIX*.md` files for specific issue resolutions
