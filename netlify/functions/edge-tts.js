const { spawn } = require('child_process');

// Python-based Edge TTS implementation for Netlify
async function generateAudioWithPython(text, voice, speed) {
  console.log('🐍 [NETLIFY-EDGE-TTS] Using Python-based Edge TTS...');
  
  // Escape text for Python script
  const escapedText = text.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  
  const pythonScript = `
import sys
import os
import asyncio
import tempfile
import base64

async def synthesize():
    try:
        import edge_tts
        
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
        
    except ImportError as e:
        print(f"ERROR: edge_tts module not available: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

asyncio.run(synthesize())
`;

  return new Promise((resolve, reject) => {
    console.log('🐍 [NETLIFY-EDGE-TTS] Spawning Python process...');
    
    const pythonProcess = spawn('python', ['-c', pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
      env: { ...process.env, PYTHONPATH: '/opt/buildhome/.cache/pip' }
    });

    console.log('🐍 [NETLIFY-EDGE-TTS] Python process spawned with PID:', pythonProcess.pid);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log('🐍 [NETLIFY-EDGE-TTS] stdout chunk length:', chunk.length);
    });

    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log('🐍 [NETLIFY-EDGE-TTS] stderr:', chunk);
    });

    pythonProcess.on('close', (code) => {
      console.log('🐍 [NETLIFY-EDGE-TTS] Python process closed with code:', code);
      console.log('🐍 [NETLIFY-EDGE-TTS] stdout length:', stdout.length);
      console.log('🐍 [NETLIFY-EDGE-TTS] stderr length:', stderr.length);
      
      if (code === 0 && stdout.trim()) {
        try {
          const audioBuffer = Buffer.from(stdout.trim(), 'base64');
          console.log('✅ [NETLIFY-EDGE-TTS] Audio generated, size:', audioBuffer.length, 'bytes');
          resolve(audioBuffer);
        } catch (error) {
          console.error('❌ [NETLIFY-EDGE-TTS] Failed to decode base64:', error);
          reject(new Error('Failed to decode audio data'));
        }
      } else {
        console.error('❌ [NETLIFY-EDGE-TTS] Python process failed with code:', code);
        console.error('❌ [NETLIFY-EDGE-TTS] stderr:', stderr);
        reject(new Error(`Python process failed: ${stderr}`));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('❌ [NETLIFY-EDGE-TTS] Python process error:', error);
      reject(error);
    });
  });
}

exports.handler = async (event, context) => {
  console.log('🎙️ [NETLIFY-EDGE-TTS] === REQUEST RECEIVED ===');
  console.log('🎙️ [NETLIFY-EDGE-TTS] Method:', event.httpMethod);
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { text, voice = 'en-US-AriaNeural', speed = 1.0 } = body;

    console.log('🎙️ [NETLIFY-EDGE-TTS] === SYNTHESIZE START ===');
    console.log('🎙️ [NETLIFY-EDGE-TTS] Text length:', text?.length || 'undefined');
    console.log('🎙️ [NETLIFY-EDGE-TTS] Voice:', voice);
    console.log('🎙️ [NETLIFY-EDGE-TTS] Speed:', speed);

    if (!text || typeof text !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Text is required' })
      };
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
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No valid text to synthesize' })
      };
    }

    console.log('🌐 [NETLIFY-EDGE-TTS] Sanitized text length:', sanitizedText.length);
    console.log('🌐 [NETLIFY-EDGE-TTS] Sanitized text preview:', sanitizedText.substring(0, 100) + '...');

    // Generate audio using Python Edge TTS
    const audioBuffer = await generateAudioWithPython(sanitizedText, voice, speed);
    
    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = sanitizedText.split(' ').length;
    const estimatedDuration = (wordCount / 150) * 60 / speed;

    console.log('✅ [NETLIFY-EDGE-TTS] Audio generated, size:', audioBuffer.length, 'bytes');
    console.log('✅ [NETLIFY-EDGE-TTS] Estimated duration:', estimatedDuration, 'seconds');
    console.log('✅ [NETLIFY-EDGE-TTS] === SYNTHESIZE COMPLETE ===\n');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        audioBuffer: audioBuffer.toString('base64'),
        duration: estimatedDuration,
        size: audioBuffer.length
      })
    };

  } catch (error) {
    console.error('❌ [NETLIFY-EDGE-TTS] Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        error: `Edge TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
    };
  }
};
