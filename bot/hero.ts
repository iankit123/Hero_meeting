import { config } from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';
import { createSTTService } from '../services/stt';
import { createLLMService } from '../services/llm';
import { createTTSService } from '../services/tts';

// Load environment variables
config({ path: '.env.local' });

class HeroBot {
  private sttService = createSTTService();
  private llmService = createLLMService();
  private ttsService = createTTSService();
  private recentTranscripts: string[] = [];
  private isProcessing = false;

  async joinRoom(roomName: string) {
    try {
      console.log(`Hero bot joining room: ${roomName}`);

      // Get join token from API
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/hero-join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          action: 'join',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get join token');
      }

      const { token } = await response.json();
      console.log('Hero bot token received:', token ? 'Yes' : 'No');

      // For now, just simulate the bot being ready
      console.log('Hero bot is ready to process audio and respond to questions');
      console.log('Bot will listen for "Hey Hero" trigger phrases and respond with AI-generated answers');

    } catch (error) {
      console.error('Error joining room:', error);
      throw error;
    }
  }

  async processMessage(message: string, context?: string) {
    if (this.isProcessing) return;

    const text = message?.trim();
    if (!text) return;

    console.log(`Processing message: ${text}`);

    // Add to recent transcripts
    this.recentTranscripts.push(text);
    if (this.recentTranscripts.length > 10) {
      this.recentTranscripts.shift();
    }

    // Check for "hey hero" trigger phrase
    const triggerPhrase = /hey\s+hero/i;
    if (!triggerPhrase.test(text)) {
      console.log('No trigger phrase detected');
      return;
    }

    this.isProcessing = true;

    try {
      // Extract the question after the trigger phrase
      const question = text.replace(triggerPhrase, '').trim();
      if (!question) {
        console.log('No question detected after trigger phrase');
        return;
      }

      console.log(`Processing question: ${question}`);

      // Get recent context
      const recentContext = context || this.recentTranscripts.slice(-5).join(' ');

      // Generate LLM response
      const llmResponse = await this.llmService.generateResponse(question, recentContext);
      console.log(`Hero response: ${llmResponse.text}`);

      // Generate TTS audio
      const ttsResult = await this.ttsService.synthesize(llmResponse.text);
      console.log(`TTS audio generated (${ttsResult.duration}s duration)`);

      // Send response to chat (this would be handled by the frontend)
      await this.sendChatMessage(llmResponse.text);

    } catch (error) {
      console.error('Error processing message:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async sendChatMessage(message: string) {
    try {
      // Send message to the chat system
      console.log(`Sending chat message: ${message}`);
      
      // In a real implementation, you'd send this to the frontend via WebSocket
      // or store it in a database for the chat component to fetch
      
    } catch (error) {
      console.error('Error sending chat message:', error);
    }
  }

  async disconnect() {
    console.log('Hero bot disconnecting...');
    this.sttService.stopTranscription();
  }
}

// Main execution
async function main() {
  const roomName = process.argv[2];
  
  if (!roomName) {
    console.error('Usage: npm run bot <room-name>');
    process.exit(1);
  }

  // Validate environment variables
  const requiredEnvVars = [
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'DEEPGRAM_API_KEY',
    'GEMINI_API_KEY',
    'NEXT_PUBLIC_APP_URL'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  const heroBot = new HeroBot();

  try {
    await heroBot.joinRoom(roomName);
    console.log('Hero bot is running. Press Ctrl+C to exit.');
    
    // Keep the process running and simulate message processing
    setInterval(async () => {
      // Simulate receiving a message with "Hey Hero" trigger
      const testMessage = "Hey Hero, what is the weather like today?";
      await heroBot.processMessage(testMessage);
    }, 30000); // Process a test message every 30 seconds
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\nShutting down Hero bot...');
      await heroBot.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start Hero bot:', error);
    process.exit(1);
  }
}

// Run the bot
main().catch(console.error);
