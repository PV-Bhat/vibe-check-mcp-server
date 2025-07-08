# Automatic Docker Setup

This guide shows how to run the Vibe Check MCP server in Docker and configure it to start automatically with Cursor.

## Prerequisites

- Docker and Docker Compose installed and available in your `PATH`.
- A Gemini API key for the server.

## Quick Start

Run the provided setup script from the repository root:

```bash
bash scripts/docker-setup.sh
```

The script performs the following actions:

1. Creates `~/vibe-check-mcp` and copies required files.
2. Builds the Docker image and sets up `docker-compose.yml`.
3. Prompts for your `GEMINI_API_KEY` and stores it in `~/vibe-check-mcp/.env`.
4. Configures a systemd service on Linux or a LaunchAgent on macOS so the container starts on login.
5. Generates `vibe-check-tcp-wrapper.sh` which proxies STDIO to the container on port 3000.
6. Starts the container in the background.

After running the script, configure Cursor IDE:

1. Open **Settings** → **MCP**.
2. Choose **Add New MCP Server**.
3. Set the type to **Command** and use the wrapper script path:
   `~/vibe-check-mcp/vibe-check-tcp-wrapper.sh`.
4. Save and refresh.

Vibe Check MCP will now launch automatically whenever you log in and be available to Cursor without additional manual steps.
