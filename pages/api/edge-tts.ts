import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createWriteStream, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const pipelineAsync = promisify(pipeline);

// Python-based Edge TTS implementation
async function generateAudioWithPython(text: string, voice: string, speed: number): Promise<Buffer> {
  console.log('🐍 [EDGE-TTS-PYTHON] Using Python-based Edge TTS...');
  
  // Escape text for Python script
  const escapedText = text.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  
  const pythonScript = `
import sys
try:
    import edge_tts
    import asyncio
    import tempfile
    import os
    import base64

    async def synthesize():
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                tmp_path = tmp_file.name
            
            # Generate audio
            communicate = edge_tts.Communicate(text="${escapedText}", voice="${voice}")
            await communicate.save(tmp_path)
            
            # Read file and return as base64
            with open(tmp_path, 'rb') as f:
                audio_data = f.read()
            
            # Clean up
            os.unlink(tmp_path)
            
            # Return base64 encoded data
            print(base64.b64encode(audio_data).decode('utf-8'))
            
        except Exception as e:
            print(f"ERROR: {str(e)}", file=sys.stderr)
            sys.exit(1)

    asyncio.run(synthesize())
except ImportError:
    print("ERROR: edge_tts module not available", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;

  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['-c', pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000 // 30 second timeout
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        try {
          const audioBuffer = Buffer.from(stdout.trim(), 'base64');
          console.log('✅ [EDGE-TTS-PYTHON] Audio generated, size:', audioBuffer.length, 'bytes');
          resolve(audioBuffer);
        } catch (error) {
          console.error('❌ [EDGE-TTS-PYTHON] Failed to decode base64:', error);
          reject(new Error('Failed to decode audio data'));
        }
      } else {
        console.error('❌ [EDGE-TTS-PYTHON] Python process failed:', stderr);
        reject(new Error(`Python process failed: ${stderr}`));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('❌ [EDGE-TTS-PYTHON] Python process error:', error);
      reject(error);
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🎙️ [EDGE-TTS-API] === REQUEST RECEIVED ===');
  console.log('🎙️ [EDGE-TTS-API] Method:', req.method);
  console.log('🎙️ [EDGE-TTS-API] Headers:', req.headers);
  console.log('🎙️ [EDGE-TTS-API] Body keys:', Object.keys(req.body || {}));
  
  if (req.method !== 'POST') {
    console.log('❌ [EDGE-TTS-API] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice = 'en-US-AriaNeural', speed = 1.0 } = req.body;

    console.log('🎙️ [EDGE-TTS-API] === SYNTHESIZE START ===');
    console.log('🎙️ [EDGE-TTS-API] Text length:', text?.length || 'undefined');
    console.log('🎙️ [EDGE-TTS-API] Voice:', voice);
    console.log('🎙️ [EDGE-TTS-API] Speed:', speed);
    console.log('🎙️ [EDGE-TTS-API] Text preview:', text?.substring(0, 100) + '...');

    if (!text || typeof text !== 'string') {
      console.log('❌ [EDGE-TTS-API] Invalid text:', { text, type: typeof text });
      return res.status(400).json({ error: 'Text is required' });
    }

    // Sanitize text
    const sanitizedText = text
      .replace(/\*\*/g, "") // remove bold markdown (**text**)
      .replace(/\*/g, "") // remove italic markdown (*text*)
      .replace(/#/g, "") // remove headers (# Header)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // remove links [text](url) -> text
      .replace(/`([^`]+)`/g, "$1") // remove code blocks `code` -> code
      .replace(/\n+/g, " ") // replace newlines with spaces
      .trim();

    if (!sanitizedText || sanitizedText.length < 2) {
      console.error('❌ [EDGE-TTS-API] Invalid text - too short');
      return res.status(400).json({ error: 'No valid text to synthesize' });
    }

    // Create temporary file for output
    const tempFile = join(tmpdir(), `edge-tts-${Date.now()}.wav`);
    
    console.log('🌐 [EDGE-TTS-API] Generating audio using edge-tts CLI...');
    console.log('🌐 [EDGE-TTS-API] Temp file:', tempFile);
    console.log('🌐 [EDGE-TTS-API] Sanitized text length:', sanitizedText.length);
    console.log('🌐 [EDGE-TTS-API] Sanitized text preview:', sanitizedText.substring(0, 100) + '...');

    // Try Python-based Edge TTS first (more reliable on Netlify)
    let audioBuffer: Buffer;
    
    try {
      console.log('🐍 [EDGE-TTS-API] Attempting Python-based Edge TTS...');
      audioBuffer = await generateAudioWithPython(sanitizedText, voice, speed);
      console.log('✅ [EDGE-TTS-API] Python-based Edge TTS successful');
    } catch (pythonError) {
      console.warn('⚠️ [EDGE-TTS-API] Python-based Edge TTS failed, trying CLI:', pythonError instanceof Error ? pythonError.message : 'Unknown error');
      
      // Fallback to CLI approach
      try {
        console.log('🔍 [EDGE-TTS-API] Checking if edge-tts CLI is available...');
        
        // Use edge-tts CLI to generate audio
        const edgeTtsProcess = spawn('edge-tts', [
          '--text', sanitizedText,
          '--voice', voice,
          '--rate', `+${Math.round((speed - 1) * 100)}%`,
          '--write-media', tempFile
        ], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        console.log('🌐 [EDGE-TTS-API] Edge TTS process spawned with PID:', edgeTtsProcess.pid);

        // Capture stderr for debugging
        let stderr = '';
        edgeTtsProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        // Wait for the process to complete
        await new Promise((resolve, reject) => {
          edgeTtsProcess.on('close', (code) => {
            console.log('🔍 [EDGE-TTS-API] Process exit code:', code);
            console.log('🔍 [EDGE-TTS-API] Process stderr length:', stderr.length);
            if (stderr) {
              console.log('🔍 [EDGE-TTS-API] Stderr:', stderr);
            }
            if (code === 0) {
              console.log('✅ [EDGE-TTS-API] Process completed successfully');
              resolve(code);
            } else {
              console.error('❌ [EDGE-TTS-API] Process failed with code:', code);
              reject(new Error(`edge-tts process exited with code ${code}. Stderr: ${stderr}`));
            }
          });
          
          edgeTtsProcess.on('error', (error) => {
            console.error('❌ [EDGE-TTS-API] Process error:', error);
            console.error('❌ [EDGE-TTS-API] Error details:', {
              name: error.name,
              message: error.message,
              code: error.code,
              errno: error.errno,
              syscall: error.syscall
            });
            reject(error);
          });
        });

        // Read the generated audio file
        const fs = await import('fs');
        audioBuffer = fs.readFileSync(tempFile);
        console.log('✅ [EDGE-TTS-API] CLI-based Edge TTS successful');
        
      } catch (cliError) {
        console.error('❌ [EDGE-TTS-API] Both Python and CLI failed:', cliError instanceof Error ? cliError.message : 'Unknown error');
        
        // Final fallback: return error to trigger Google TTS fallback in the service
        return res.status(500).json({ 
          error: `Edge TTS synthesis failed: ${cliError instanceof Error ? cliError.message : 'Unknown error'}`,
          fallback: 'Use Google TTS instead'
        });
      }
    }
    
    // Clean up temporary file
    try {
      unlinkSync(tempFile);
      console.log('🧹 [EDGE-TTS-API] Temp file cleaned up');
    } catch (cleanupError) {
      console.warn('⚠️ [EDGE-TTS-API] Failed to clean up temp file:', cleanupError);
    }

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = sanitizedText.split(' ').length;
    const estimatedDuration = (wordCount / 150) * 60 / speed;

    console.log('✅ [EDGE-TTS-API] Audio generated, size:', audioBuffer.length, 'bytes');
    console.log('✅ [EDGE-TTS-API] Estimated duration:', estimatedDuration, 'seconds');
    console.log('✅ [EDGE-TTS-API] === SYNTHESIZE COMPLETE ===\n');

    // Return the audio buffer as base64
    res.status(200).json({
      success: true,
      audioBuffer: audioBuffer.toString('base64'),
      duration: estimatedDuration,
      size: audioBuffer.length
    });

  } catch (error) {
    console.error('❌ [EDGE-TTS-API] Error:', error);
    
    // Clean up temp file on error
    try {
      const tempFile = join(tmpdir(), `edge-tts-${Date.now()}.wav`);
      unlinkSync(tempFile);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    res.status(500).json({ 
      error: `Edge TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
}
