#!/bin/bash

echo "========================================================"
echo "Vibe Check MCP Docker Setup for Cursor IDE"
echo "========================================================"
echo ""

# Check for Docker installation
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed or not in PATH."
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

# Check for Docker Compose installation
if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed or not in PATH."
    echo "Please install Docker Compose from https://docs.docker.com/compose/install/"
    exit 1
fi

# Create directory for Vibe Check MCP
mkdir -p ~/vibe-check-mcp
cd ~/vibe-check-mcp

# Download or create necessary files
echo "Downloading required files..."

# Create docker-compose.yml
cat > docker-compose.yml << 'EOL'
version: '3'

services:
  vibe-check-mcp:
    build:
      context: .
      dockerfile: Dockerfile
    image: vibe-check-mcp:latest
    container_name: vibe-check-mcp
    restart: always
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - vibe-check-data:/app/data

volumes:
  vibe-check-data:
EOL

# Create Dockerfile if it doesn't exist
cat > Dockerfile << 'EOL'
FROM node:lts-alpine

WORKDIR /app

# Clone the repository
RUN apk add --no-cache git \
    && git clone https://github.com/PV-Bhat/vibe-check-mcp-server.git .

# Install dependencies and build
RUN npm install && npm run build

# Run the MCP server
CMD ["node", "build/index.js"]
EOL

# Create .env file
echo "Enter your Gemini API key:"
read -p "API Key: " GEMINI_API_KEY

cat > .env << EOL
GEMINI_API_KEY=$GEMINI_API_KEY
EOL

chmod 600 .env  # Secure the API key file

# Create startup script
cat > start-vibe-check-docker.sh << 'EOL'
#!/bin/bash
cd ~/vibe-check-mcp
docker-compose up -d
EOL

chmod +x start-vibe-check-docker.sh

# Create a TCP wrapper script to route stdio to TCP port 3000
cat > vibe-check-tcp-wrapper.sh << 'EOL'
#!/bin/bash
# This script connects stdio to the Docker container's TCP port
exec socat STDIO TCP:localhost:3000
EOL

chmod +x vibe-check-tcp-wrapper.sh

# Detect OS for autostart configuration
OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS="Linux";;
    Darwin*)    OS="Mac";;
    *)          OS="Unknown";;
esac

echo "Setting up auto-start for $OS..."

if [ "$OS" = "Mac" ]; then
    # Set up LaunchAgent for Mac
    PLIST_FILE="$HOME/Library/LaunchAgents/com.vibe-check-mcp-docker.plist"
    mkdir -p "$HOME/Library/LaunchAgents"
    
    cat > "$PLIST_FILE" << EOL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vibe-check-mcp-docker</string>
    <key>ProgramArguments</key>
    <array>
        <string>$HOME/vibe-check-mcp/start-vibe-check-docker.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
EOL

    chmod 644 "$PLIST_FILE"
    launchctl load "$PLIST_FILE"
    
    echo "Created and loaded LaunchAgent for automatic Docker startup on login."
    
elif [ "$OS" = "Linux" ]; then
    # Set up systemd user service for Linux
    SERVICE_DIR="$HOME/.config/systemd/user"
    mkdir -p "$SERVICE_DIR"
    
    cat > "$SERVICE_DIR/vibe-check-mcp-docker.service" << EOL
[Unit]
Description=Vibe Check MCP Docker Container
After=docker.service

[Service]
ExecStart=$HOME/vibe-check-mcp/start-vibe-check-docker.sh
Type=oneshot
RemainAfterExit=yes

[Install]
WantedBy=default.target
EOL

    systemctl --user daemon-reload
    systemctl --user enable vibe-check-mcp-docker.service
    systemctl --user start vibe-check-mcp-docker.service
    
    echo "Created and started systemd user service for automatic Docker startup."
fi

# Start the container
echo "Starting Vibe Check MCP Docker container..."
./start-vibe-check-docker.sh

echo ""
echo "Vibe Check MCP Docker setup complete!"
echo ""
echo "To complete the setup, configure Cursor IDE:"
echo ""
echo "1. Open Cursor IDE"
echo "2. Go to Settings (gear icon) -> MCP"
echo "3. Click \"Add New MCP Server\""
echo "4. Enter the following information:"
echo "   - Name: Vibe Check"
echo "   - Type: Command"
echo "   - Command: $HOME/vibe-check-mcp/vibe-check-tcp-wrapper.sh"
echo "5. Click \"Save\" and then \"Refresh\""
echo ""
echo "Vibe Check MCP will now start automatically when you log in."
echo ""