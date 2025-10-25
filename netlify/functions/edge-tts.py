import json
import os
import tempfile
import subprocess
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            text = data.get('text', '')
            voice = data.get('voice', 'en-US-AriaNeural')
            speed = data.get('speed', 1.0)
            
            if not text:
                self.send_error(400, 'Text is required')
                return
            
            # Generate audio using edge-tts
            audio_buffer = self.generate_audio(text, voice, speed)
            
            # Calculate duration estimate
            word_count = len(text.split())
            duration = (word_count / 150) * 60 / speed
            
            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response = {
                'success': True,
                'audioBuffer': audio_buffer.decode('base64') if isinstance(audio_buffer, str) else audio_buffer,
                'duration': duration,
                'size': len(audio_buffer)
            }
            
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, f'Edge TTS synthesis failed: {str(e)}')
    
    def generate_audio(self, text, voice, speed):
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
            
            # Run edge-tts command
            cmd = [
                'edge-tts',
                '--text', text,
                '--voice', voice,
                '--rate', f'+{int((speed - 1) * 100)}%',
                '--write-media', temp_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                raise Exception(f'edge-tts failed: {result.stderr}')
            
            # Read generated audio file
            with open(temp_path, 'rb') as f:
                audio_data = f.read()
            
            # Clean up
            os.unlink(temp_path)
            
            # Return base64 encoded audio
            import base64
            return base64.b64encode(audio_data).decode('utf-8')
            
        except Exception as e:
            raise Exception(f'Failed to generate audio: {str(e)}')
