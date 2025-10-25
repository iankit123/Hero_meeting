// Simple Edge TTS simulation for Netlify using free TTS services
// This provides Edge TTS-like quality without requiring Python or API keys

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

    // Use Google TTS as Edge TTS simulation (since it's free and reliable)
    let audioBuffer;
    let success = false;
    let errorMessage = '';

    try {
      console.log('🌐 [NETLIFY-EDGE-TTS] Using Google TTS as Edge TTS simulation...');
      
      // Map Edge TTS voices to Google TTS voices
      let googleVoice = 'en';
      if (voice.includes('en-US')) {
        googleVoice = 'en';
      } else if (voice.includes('en-GB')) {
        googleVoice = 'en-gb';
      } else if (voice.includes('en-AU')) {
        googleVoice = 'en-au';
      }

      const gttsResponse = await fetch('https://translate.google.com/translate_tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: new URLSearchParams({
          'ie': 'UTF-8',
          'q': sanitizedText,
          'tl': googleVoice,
          'client': 'tw-ob'
        })
      });

      if (gttsResponse.ok) {
        const audioArrayBuffer = await gttsResponse.arrayBuffer();
        audioBuffer = Buffer.from(audioArrayBuffer);
        success = true;
        console.log('✅ [NETLIFY-EDGE-TTS] Google TTS simulation successful, size:', audioBuffer.length, 'bytes');
        console.log('ℹ️ [NETLIFY-EDGE-TTS] Using Google TTS as Edge TTS simulation');
      } else {
        console.log('❌ [NETLIFY-EDGE-TTS] Google TTS failed with status:', gttsResponse.status);
        errorMessage += `Google TTS failed: ${gttsResponse.status}; `;
      }
    } catch (gttsError) {
      console.log('❌ [NETLIFY-EDGE-TTS] Google TTS failed:', gttsError.message);
      errorMessage += `Google TTS failed: ${gttsError.message}; `;
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
        method: 'edge-tts-simulation'
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