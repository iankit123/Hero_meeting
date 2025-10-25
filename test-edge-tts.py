#!/usr/bin/env python3
"""
Test script for Edge TTS functionality
Run this to verify Edge TTS is working before deploying
"""

import asyncio
import edge_tts
import os
import sys

async def test_edge_tts():
    """Test Edge TTS with a simple text"""
    try:
        print("🎙️ Testing Edge TTS...")
        
        # Test text
        text = "Hello, this is a test of Edge TTS integration."
        voice = "en-US-AriaNeural"
        output_file = "test_output.mp3"
        
        print(f"📝 Text: {text}")
        print(f"🎵 Voice: {voice}")
        print(f"📁 Output: {output_file}")
        
        # Generate TTS
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_file)
        
        # Check if file was created
        if os.path.exists(output_file):
            file_size = os.path.getsize(output_file)
            print(f"✅ Success! Audio file created: {file_size} bytes")
            
            # Clean up
            os.remove(output_file)
            print("🧹 Test file cleaned up")
            return True
        else:
            print("❌ Error: Audio file was not created")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

async def list_voices():
    """List available voices"""
    try:
        print("🎵 Available voices:")
        voices = await edge_tts.list_voices()
        
        # Show first 10 voices as example
        for i, voice in enumerate(voices[:10]):
            print(f"  {i+1}. {voice['Name']} ({voice['Locale']}) - {voice['Gender']}")
        
        print(f"... and {len(voices) - 10} more voices available")
        return True
        
    except Exception as e:
        print(f"❌ Error listing voices: {str(e)}")
        return False

async def main():
    """Main test function"""
    print("🚀 Edge TTS Test Suite")
    print("=" * 40)
    
    # Test 1: List voices
    print("\n1. Testing voice listing...")
    await list_voices()
    
    # Test 2: Generate TTS
    print("\n2. Testing TTS generation...")
    success = await test_edge_tts()
    
    if success:
        print("\n✅ All tests passed! Edge TTS is working correctly.")
        sys.exit(0)
    else:
        print("\n❌ Tests failed! Check your Edge TTS installation.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
