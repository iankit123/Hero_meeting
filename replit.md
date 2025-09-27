# Overview

Hero Meet is an AI-powered video conferencing platform that integrates an intelligent assistant called "Hero" into meeting experiences. The application combines real-time video/audio communication with AI capabilities including speech-to-text transcription, natural language processing, and text-to-speech responses. Users can create meetings where the Hero bot joins as an audio-only participant, transcribes conversations, and responds to questions when triggered with "Hey Hero" phrases.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: Next.js 14 with React and TypeScript for type safety and modern development experience
- **Pages Structure**: File-based routing with dynamic routes for meeting rooms (`/meeting/[roomName]`)
- **Component Architecture**: Modular React components including LandingPage, MeetingPage, and ChatPanel for organized UI structure
- **State Management**: React hooks for local component state management without external state libraries
- **Styling**: Custom CSS with utility classes for rapid UI development

## Backend Architecture
- **API Routes**: Next.js API routes for server-side functionality including room creation and Hero bot integration
- **Bot Service**: Separate TypeScript bot service (`bot/hero.ts`) that runs independently from the web application
- **Service Layer**: Modular service architecture with separate services for STT, LLM, and TTS functionality
- **Process Management**: PM2 ecosystem configuration for running both web server and bot service in production

## Real-time Communication
- **Video Infrastructure**: LiveKit Cloud for WebRTC-based video conferencing with token-based authentication
- **Room Management**: Dynamic room creation with UUID-based naming for unique meeting spaces
- **Participant Handling**: Support for multiple participants with the Hero bot joining as a special audio-only participant

## AI Integration Pipeline
- **Speech-to-Text**: Deepgram streaming API with speaker diarization for real-time transcription
- **Language Model**: Google Gemini 2.5 Flash for generating intelligent responses to user queries
- **Text-to-Speech**: Dual TTS implementation supporting both ElevenLabs and gTTS for converting AI responses to audio
- **Trigger System**: Voice activation using "Hey Hero" phrases to initiate AI assistant responses

## Authentication & Security
- **Token-based Access**: LiveKit access tokens for secure room joining with granular permissions
- **Environment Configuration**: Secure API key management through environment variables
- **CORS Headers**: Custom headers configuration for cross-origin resource sharing

# External Dependencies

## Core Infrastructure
- **LiveKit Cloud**: WebRTC video conferencing infrastructure with SDK integration for real-time communication
- **Vercel**: Recommended deployment platform for the Next.js application with serverless functions

## AI Services
- **Deepgram**: Real-time speech-to-text API with streaming capabilities and speaker identification
- **Google Gemini**: Large language model API for natural language understanding and response generation
- **ElevenLabs** (Optional): Premium text-to-speech service for high-quality voice synthesis
- **gTTS**: Google Text-to-Speech as fallback TTS service

## Development Tools
- **TypeScript**: Static type checking for improved code quality and developer experience
- **ESLint**: Code linting with Next.js core web vitals configuration
- **tsx**: TypeScript execution for running the bot service
- **PM2**: Process manager for production deployment of multiple services

## Runtime Dependencies
- **WebSocket**: Real-time communication for LiveKit and bot interactions
- **UUID**: Unique identifier generation for rooms and participants
- **dotenv**: Environment variable management for configuration