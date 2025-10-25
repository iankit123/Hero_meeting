import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, voice = 'en-US-AriaNeural' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }

  console.log('🎙️ [EDGE-TTS] === SYNTHESIZE START ===');
  console.log('🎙️ [EDGE-TTS] Text length:', text.length);
  console.log('🎙️ [EDGE-TTS] Voice:', voice);

  try {
    // Check if Python and edge-tts are available
    const pythonCheck = await checkPythonAvailability();
    if (!pythonCheck.available) {
      console.warn('⚠️ [EDGE-TTS] Python/edge-tts not available:', pythonCheck.error);
      return res.status(503).json({ 
        error: 'Edge TTS not available in this environment',
        fallback: 'Please use Google TTS or ElevenLabs instead'
      });
    }

    // Create temporary file path
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `edge-tts-${Date.now()}.mp3`);
    
    console.log('📁 [EDGE-TTS] Output path:', outputPath);

    // Sanitize text for Python (escape quotes and special characters)
    const sanitizedText = text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');

    // Python script to generate TTS
    const pythonScript = `
import edge_tts
import asyncio
import sys
import os

async def main():
    try:
        text = "${sanitizedText}"
        voice = "${voice}"
        output_path = "${outputPath}"
        
        print(f"Generating TTS for text: {text[:50]}...")
        print(f"Using voice: {voice}")
        print(f"Output path: {output_path}")
        
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)
        
        print("TTS generation completed successfully")
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
`;

    console.log('🐍 [EDGE-TTS] Executing Python script...');

    // Execute Python script
    const pythonProcess = spawn('python3', ['-c', pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Wait for Python process to complete
    await new Promise<void>((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ [EDGE-TTS] Python script completed successfully');
          console.log('📝 [EDGE-TTS] Python output:', stdout);
          resolve();
        } else {
          console.error('❌ [EDGE-TTS] Python script failed with code:', code);
          console.error('❌ [EDGE-TTS] Python error:', stderr);
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('❌ [EDGE-TTS] Python process error:', error);
        reject(new Error(`Python process error: ${error.message}`));
      });
    });

    // Check if output file exists
    if (!fs.existsSync(outputPath)) {
      throw new Error('Output file was not created');
    }

    // Read the generated audio file
    const audioBuffer = fs.readFileSync(outputPath);
    console.log('✅ [EDGE-TTS] Audio file generated, size:', audioBuffer.length, 'bytes');

    // Clean up temporary file
    try {
      fs.unlinkSync(outputPath);
      console.log('🧹 [EDGE-TTS] Temporary file cleaned up');
    } catch (cleanupError) {
      console.warn('⚠️ [EDGE-TTS] Failed to clean up temporary file:', cleanupError);
    }

    // Estimate duration (~60ms per character)
    const duration = text.length * 0.06;
    console.log('✅ [EDGE-TTS] Estimated duration:', duration, 'seconds');

    // Set response headers
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length.toString());
    res.setHeader('X-Duration', duration.toString());

    console.log('✅ [EDGE-TTS] === SYNTHESIZE COMPLETE ===\n');

    // Send the audio buffer
    res.send(audioBuffer);

  } catch (error) {
    console.error('❌ [EDGE-TTS] Error:', error);
    res.status(500).json({ 
      error: 'Edge TTS generation failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      fallback: 'Please use Google TTS or ElevenLabs instead'
    });
  }
}

// Helper function to check Python availability
async function checkPythonAvailability(): Promise<{ available: boolean; error?: string }> {
  return new Promise((resolve) => {
    const pythonProcess = spawn('python3', ['-c', 'import edge_tts; print("edge-tts available")'], {
      stdio: ['pipe', 'pipe', 'pipe']
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
      if (code === 0 && stdout.includes('edge-tts available')) {
        resolve({ available: true });
      } else {
        resolve({ 
          available: false, 
          error: `Python/edge-tts check failed with code ${code}: ${stderr || stdout}` 
        });
      }
    });

    pythonProcess.on('error', (error) => {
      resolve({ 
        available: false, 
        error: `Python process error: ${error.message}` 
      });
    });
  });
}
