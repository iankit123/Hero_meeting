import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createWriteStream, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const pipelineAsync = promisify(pipeline);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice = 'en-US-AriaNeural', speed = 1.0 } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('🎙️ [EDGE-TTS-API] === SYNTHESIZE START ===');
    console.log('🎙️ [EDGE-TTS-API] Text length:', text.length);
    console.log('🎙️ [EDGE-TTS-API] Voice:', voice);
    console.log('🎙️ [EDGE-TTS-API] Speed:', speed);

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

    // Use edge-tts CLI to generate audio
    const edgeTtsProcess = spawn('edge-tts', [
      '--text', sanitizedText,
      '--voice', voice,
      '--rate', `+${Math.round((speed - 1) * 100)}%`,
      '--write-media', tempFile
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Capture stderr for debugging
    let stderr = '';
    edgeTtsProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Wait for the process to complete
    await new Promise((resolve, reject) => {
      edgeTtsProcess.on('close', (code) => {
        console.log('🔍 [EDGE-TTS-API] Process exit code:', code);
        if (stderr) {
          console.log('🔍 [EDGE-TTS-API] Stderr:', stderr);
        }
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`edge-tts process exited with code ${code}. Stderr: ${stderr}`));
        }
      });
      
      edgeTtsProcess.on('error', (error) => {
        console.error('🔍 [EDGE-TTS-API] Process error:', error);
        reject(error);
      });
    });

    // Read the generated audio file
    const fs = await import('fs');
    const audioBuffer = fs.readFileSync(tempFile);
    
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
