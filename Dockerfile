# Use Node.js base image
FROM node:lts-alpine

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install dependencies (ignores lifecycle scripts for safety)
RUN npm install --ignore-scripts

# Build the TypeScript project
RUN npm run build

# Expose port for WebSocket (can be any; MCP spec often uses 3000 or 8080)
EXPOSE 3000

# Run the WebSocket MCP server
CMD ["node", "build/index.js"]
