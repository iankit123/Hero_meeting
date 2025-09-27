#!/bin/bash

echo "🚀 Hero Meet Setup Script"
echo "========================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local from template..."
    cp env.example .env.local
    echo "✅ Created .env.local file"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env.local and add your API keys:"
    echo "   - LiveKit Cloud credentials"
    echo "   - Deepgram API key"
    echo "   - Google Gemini API key"
    echo ""
    echo "   Then run: npm run dev"
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your API keys"
echo "2. Run 'npm run dev' to start the web app"
echo "3. In another terminal, run 'npm run bot <room-name>' to start the Hero bot"
echo ""
echo "For more information, see README.md"
