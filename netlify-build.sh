#!/bin/bash

# Netlify Build Script for Edge TTS Installation
echo "🚀 Starting Netlify build process..."

# Check if Python is available
if command -v python3 &> /dev/null; then
    echo "✅ Python3 found"
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    echo "✅ Python found"
    PYTHON_CMD="python"
else
    echo "❌ Python not found, skipping Edge TTS installation"
    echo "🔄 Will use Google TTS fallback"
    npm run build:next
    exit 0
fi

# Check if pip is available
if command -v pip3 &> /dev/null; then
    echo "✅ pip3 found"
    PIP_CMD="pip3"
elif command -v pip &> /dev/null; then
    echo "✅ pip found"
    PIP_CMD="pip"
else
    echo "❌ pip not found, skipping Edge TTS installation"
    echo "🔄 Will use Google TTS fallback"
    npm run build:next
    exit 0
fi

# Install Edge TTS
echo "📦 Installing Edge TTS..."
if $PIP_CMD install -r requirements.txt; then
    echo "✅ Edge TTS installed successfully"
else
    echo "⚠️ Edge TTS installation failed, will use Google TTS fallback"
fi

# Build Next.js application
echo "🏗️ Building Next.js application..."
npm run build:next

echo "✅ Build process completed"
