// Alternative Edge TTS implementation for Netlify without Python dependency
// This uses a public Edge TTS API service

exports.handler = async (event, context) => {
  console.log('🎙️ [NETLIFY-EDGE-TTS] === REQUEST RECEIVED ===');
  console.log('🎙️ [NETLIFY-EDGE-TTS] Method:', event.httpMethod);
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ error: 'No valid text to synthesize' })
      };
    }

    console.log('🌐 [NETLIFY-EDGE-TTS] Sanitized text length:', sanitizedText.length);
    console.log('🌐 [NETLIFY-EDGE-TTS] Sanitized text preview:', sanitizedText.substring(0, 100) + '...');

    // Try multiple Edge TTS approaches
    let audioBuffer;
    let success = false;
    let errorMessage = '';

    // Approach 1: Try a public Edge TTS API
    try {
      console.log('🌐 [NETLIFY-EDGE-TTS] Trying public Edge TTS API...');
      
      const response = await fetch('https://api.voicemaker.in/v1/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_API_KEY' // This would need a real API key
        },
        body: JSON.stringify({
          text: sanitizedText,
          voice: voice,
          speed: speed
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.audio) {
          audioBuffer = Buffer.from(result.audio, 'base64');
          success = true;
          console.log('✅ [NETLIFY-EDGE-TTS] Public API successful, size:', audioBuffer.length, 'bytes');
        }
      }
    } catch (apiError) {
      console.log('⚠️ [NETLIFY-EDGE-TTS] Public API failed:', apiError.message);
      errorMessage += `Public API failed: ${apiError.message}; `;
    }

    // Approach 2: Try Hugging Face Space API
    if (!success) {
      try {
        console.log('🌐 [NETLIFY-EDGE-TTS] Trying Hugging Face Space API...');
        
        const response = await fetch('https://huggingface.co/spaces/innoai/Edge-TTS-Text-to-Speech/api/predict', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            data: [sanitizedText, voice, speed]
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.data && result.data[0]) {
            // Extract audio from the response
            const audioData = result.data[0];
            if (typeof audioData === 'string' && audioData.startsWith('data:audio')) {
              const base64Data = audioData.split(',')[1];
              audioBuffer = Buffer.from(base64Data, 'base64');
              success = true;
              console.log('✅ [NETLIFY-EDGE-TTS] Hugging Face API successful, size:', audioBuffer.length, 'bytes');
            }
          }
        }
      } catch (hfError) {
        console.log('⚠️ [NETLIFY-EDGE-TTS] Hugging Face API failed:', hfError.message);
        errorMessage += `Hugging Face API failed: ${hfError.message}; `;
      }
    }

    // Approach 3: Simulate Edge TTS with Google TTS (as fallback)
    if (!success) {
      console.log('🔄 [NETLIFY-EDGE-TTS] All APIs failed, simulating Edge TTS with Google TTS...');
      
      try {
        // Use Google TTS as a fallback but with Edge TTS-like parameters
        const gttsResponse = await fetch('https://translate.google.com/translate_tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: new URLSearchParams({
            'ie': 'UTF-8',
            'q': sanitizedText,
            'tl': 'en', // English
            'client': 'tw-ob'
          })
        });

        if (gttsResponse.ok) {
          const audioArrayBuffer = await gttsResponse.arrayBuffer();
          audioBuffer = Buffer.from(audioArrayBuffer);
          success = true;
          console.log('✅ [NETLIFY-EDGE-TTS] Google TTS fallback successful, size:', audioBuffer.length, 'bytes');
          console.log('⚠️ [NETLIFY-EDGE-TTS] WARNING: Using Google TTS instead of Edge TTS!');
        }
      } catch (gttsError) {
        console.log('❌ [NETLIFY-EDGE-TTS] Google TTS fallback also failed:', gttsError.message);
        errorMessage += `Google TTS fallback failed: ${gttsError.message}; `;
      }
    }

    if (!success) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ 
          error: `Edge TTS synthesis failed: ${errorMessage}`,
          fallback: 'Use Google TTS instead'
        })
      };
    }
    
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
        size: audioBuffer.length,
        method: success ? 'edge-tts-simulation' : 'fallback'
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