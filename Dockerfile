# Dockerfile for Hero Bot
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port (if needed)
EXPOSE 3000

# Command to run the bot
CMD ["npm", "run", "bot"]
