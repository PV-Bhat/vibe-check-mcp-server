#!/bin/bash

echo "========================================================"
echo "Vibe Check MCP Server Installer for Cursor IDE (Mac/Linux)"
echo "========================================================"
echo ""

# Check for Node.js installation
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check for npm installation
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed or not in PATH."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS="Linux";;
    Darwin*)    OS="Mac";;
    *)          OS="Unknown";;
esac

if [ "$OS" = "Unknown" ]; then
    echo "Error: Unsupported operating system. This script works on Mac and Linux only."
    exit 1
fi

echo "Step 1: Installing @pv-bhat/vibe-check-mcp globally..."
npm install -g @pv-bhat/vibe-check-mcp

if [ $? -ne 0 ]; then
    echo "Error: Failed to install @pv-bhat/vibe-check-mcp globally."
    exit 1
fi

echo ""
echo "Step 2: Finding global npm installation path..."
NPM_GLOBAL=$(npm root -g)
VIBE_CHECK_PATH="$NPM_GLOBAL/@pv-bhat/vibe-check-mcp/build/index.js"

if [ ! -f "$VIBE_CHECK_PATH" ]; then
    echo "Error: Could not find @pv-bhat/vibe-check-mcp installation at $VIBE_CHECK_PATH"
    exit 1
fi

echo "Found @pv-bhat/vibe-check-mcp at: $VIBE_CHECK_PATH"
echo ""

echo "Step 3: Enter your Gemini API key for vibe-check-mcp..."
read -p "Enter your Gemini API key: " GEMINI_API_KEY

# Create .env file in user's home directory
echo "Creating .env file for Gemini API key..."
ENV_FILE="$HOME/.vibe-check-mcp.env"
echo "GEMINI_API_KEY=$GEMINI_API_KEY" > "$ENV_FILE"
chmod 600 "$ENV_FILE"  # Secure the API key file

# Create start script
START_SCRIPT="$HOME/start-vibe-check-mcp.sh"
cat > "$START_SCRIPT" << EOL
#!/bin/bash
source "$ENV_FILE"
exec node "$VIBE_CHECK_PATH"
EOL

chmod +x "$START_SCRIPT"
echo "Created startup script: $START_SCRIPT"

echo ""
echo "Step 4: Setting up Cursor IDE configuration..."
echo ""
echo "To complete setup, you need to configure Cursor IDE:"
echo ""
echo "1. Open Cursor IDE"
echo "2. Go to Settings (gear icon) -> MCP"
echo "3. Click \"Add New MCP Server\""
echo "4. Enter the following information:"
echo "   - Name: Vibe Check"
echo "   - Type: Command"
echo "   - Command: env GEMINI_API_KEY=$GEMINI_API_KEY node \"$VIBE_CHECK_PATH\""
echo "5. Click \"Save\" and then \"Refresh\""
echo ""
echo "Installation complete!"
echo ""
echo "You can manually run it by executing: $START_SCRIPT"
echo ""