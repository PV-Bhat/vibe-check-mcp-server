# Vibe Check MCP CLI Reference

Welcome to the official command-line interface (CLI) reference for the Vibe Check MCP Server. This guide provides a comprehensive overview of the `vibe-check-mcp` CLI tool, its commands, and configuration options.

## Table of Contents
- [Introduction](#introduction)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Command Reference](#command-reference)
  - [Installation Command](#installation-command)
  - [Server Management](#server-management)
  - [Diagnostics & Troubleshooting](#diagnostics--troubleshooting)
- [Configuration](#configuration)
  - [Configuration File](#configuration-file)
  - [Environment Variables](#environment-variables)
- [API Key Setup](#api-key-setup)
- [Client Integration Guides](#client-integration-guides)
  - [Claude Desktop App](#claude-desktop-app)
  - [Cursor IDE](#cursor-ide)
  - [Generic MCP Clients](#generic-mcp-clients)
- [Real-World Usage Scenarios](#real-world-usage-scenarios)
- [Advanced Configuration](#advanced-configuration)
- [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)

## Introduction

The `vibe-check-mcp` CLI is the primary tool for installing, configuring, and managing your Vibe Check MCP server instance. It provides a one-liner installation that eliminates the need for manual cloning, building, and configuration.

## Installation

### Prerequisites
- Node.js 18+ (required for NPX installer)
- npm (comes with Node.js)

### One-Liner Installation (Recommended)

```bash
npx vibe-check-mcp install
```

This single command downloads, installs, and configures the Vibe Check MCP server with interactive prompts for API key setup.

## Quick Start

Get your Vibe Check MCP server running in just a few steps:

1.  **Install with the one-liner:**
    ```bash
    npx vibe-check-mcp install
    ```

2.  **Follow the interactive prompts** to set up your API keys

3.  **Start the server:**
    ```bash
    vibe-check start
    ```

4.  **Check the server status:**
    ```bash
    vibe-check doctor
    ```
    Your server is now running and ready to serve MCP clients.

## Command Reference

The CLI provides four main commands for managing your Vibe Check MCP installation.

### Installation Command

#### `vibe-check-mcp install`
Installs or updates the Vibe Check MCP server. This is the primary installation method.

**Usage:**
```bash
npx vibe-check-mcp install [OPTIONS]
```

**Options:**
| Option          | Description                                        | Default       |
|-----------------|----------------------------------------------------|---------------|
| `--provider`    | Set default LLM provider (gemini, openai, openrouter) | `gemini`      |
| `--key`         | Provide API key non-interactively                   | Interactive  |
| `--path`        | Custom installation directory path                  | `~/.vibe-check-mcp` |

**Examples:**
```bash
# Standard interactive installation
npx vibe-check-mcp install

# Install with specific provider and key
npx vibe-check-mcp install --provider openai --key "sk-..."

# Install to custom directory
npx vibe-check-mcp install --path ./my-vibe-check
```

### Server Management

#### `vibe-check start`
Starts the Vibe Check MCP server process.

**Usage:**
```bash
vibe-check start [OPTIONS]
```

**Options:**
| Option          | Description                                        | Default       |
|-----------------|----------------------------------------------------|---------------|
| `--port`        | The port to run the server on.                     | `3000`        |
| `--host`        | The network host to bind the server to.            | `127.0.0.1`   |

**Examples:**
```bash
# Start the server on default port 3000
vibe-check start

# Start the server on port 8080
vibe-check start --port 8080

# Start the server on all interfaces
vibe-check start --host 0.0.0.0
```

#### `vibe-check uninstall`
Removes the server and all configuration files.

**Usage:**
```bash
vibe-check uninstall [OPTIONS]
```

**Options:**
| Option          | Description                                        | Default       |
|-----------------|----------------------------------------------------|---------------|
| `--force`       | Skip confirmation prompts                         | Interactive  |

**Example:**
```bash
# Interactive uninstall (recommended)
vibe-check uninstall

# Force uninstall without prompts
vibe-check uninstall --force
```

### Diagnostics & Troubleshooting

#### `vibe-check doctor`
Checks the status and configuration of your installation. This is the primary diagnostic tool.

**Usage:**
```bash
vibe-check doctor
```

**Example Output:**
```
🩺 Vibe Check MCP Doctor Report
================================
✅ Node.js version: 20.11.0 (supported)
✅ Installation directory: ~/.vibe-check-mcp
✅ Configuration file: ~/.vibe-check-mcp/.env
✅ Gemini API key: configured
✅ Server executable: found
⚠️  Server status: not running

🔧 Recommendations:
- Run 'vibe-check start' to start the server
```

## Configuration

### Configuration File

The primary configuration file is `.env`, located in your installation directory:
- **Default location:** `~/.vibe-check-mcp/.env`

**Example `.env` file:**
```bash
# Primary LLM provider
DEFAULT_LLM_PROVIDER=gemini

# Default model for the provider
DEFAULT_MODEL=gemini-2.5-pro

# API Keys
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Server configuration
SERVER_PORT=3000
SERVER_HOST=127.0.0.1
```

### Environment Variables

You can override configuration using environment variables:

| Environment Variable      | Description                               | Example                              |
|---------------------------|-------------------------------------------|--------------------------------------|
| `GEMINI_API_KEY`          | Google Gemini API key                     | `export GEMINI_API_KEY="..."`        |
| `OPENAI_API_KEY`          | OpenAI API key                            | `export OPENAI_API_KEY="sk-..."`     |
| `OPENROUTER_API_KEY`      | OpenRouter API key                        | `export OPENROUTER_API_KEY="..."`    |
| `DEFAULT_LLM_PROVIDER`    | Default LLM provider                      | `export DEFAULT_LLM_PROVIDER=openai`  |
| `DEFAULT_MODEL`           | Default model for the provider            | `export DEFAULT_MODEL=gpt-4`         |
| `SERVER_PORT`             | Server port                               | `export SERVER_PORT=8080`            |
| `SERVER_HOST`             | Server host                               | `export SERVER_HOST=0.0.0.0`         |

## API Key Setup

### Supported Providers

1. **Google Gemini** (Default)
   - Get API key: https://makersuite.google.com/app/apikey
   - Models: gemini-2.5-pro, gemini-1.5-pro, gemini-1.5-flash

2. **OpenAI**
   - Get API key: https://platform.openai.com/api-keys
   - Models: gpt-4, gpt-4-turbo, gpt-3.5-turbo

3. **OpenRouter**
   - Get API key: https://openrouter.ai/keys
   - Models: Access to multiple providers through one API

### Setting API Keys

**Interactive Setup (Recommended):**
```bash
npx vibe-check-mcp install
```
Follow the prompts to securely set your API keys.

**Manual Setup:**
Edit the `.env` file in your installation directory:
```bash
# ~/.vibe-check-mcp/.env
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

## Client Integration Guides

Configure your favorite AI clients to use your local Vibe Check MCP server instance.

### Claude Desktop App

1.  Open Claude Desktop settings
2.  Go to "Developer" or "MCP" section
3.  Add new MCP server configuration:
    ```json
    {
      "mcpServers": {
        "vibe-check": {
          "command": "node",
          "args": ["~/.vibe-check-mcp/node_modules/@pv-bhat/vibe-check-mcp/build/index.js"],
          "env": {
            "GEMINI_API_KEY": "your_gemini_api_key"
          }
        }
      }
    }
    ```
4.  Restart Claude Desktop

### Cursor IDE

1.  Open Cursor settings (Ctrl/Cmd + ,)
2.  Navigate to "MCP Servers" section
3.  Add Vibe Check MCP server:
    - **Name:** `vibe-check`
    - **Command:** `node ~/.vibe-check-mcp/node_modules/@pv-bhat/vibe-check-mcp/build/index.js`
    - **Environment:** Add your API keys
4.  Restart Cursor

### Generic MCP Clients

For any MCP-compatible client:

1.  Use the server executable at: `~/.vibe-check-mcp/node_modules/@pv-bhat/vibe-check-mcp/build/index.js`
2.  Configure environment variables with your API keys
3.  Set the server command as: `node /path/to/vibe-check-mcp/build/index.js`

## Real-World Usage Scenarios

### Scenario 1: Development with AI Code Review

A developer wants to add metacognitive oversight to their AI coding assistant:

1.  **Install Vibe Check MCP:**
    ```bash
    npx vibe-check-mcp install --provider gemini
    ```

2.  **Start the server:**
    ```bash
    vibe-check start
    ```

3.  **Configure Cursor IDE:** Add Vibe Check as an MCP server

4.  **Use in development:** The AI assistant will now automatically call `vibe_check` before major actions to prevent overengineering and maintain alignment with requirements.

### Scenario 2: Multi-Provider Setup

A user wants to compare responses across different LLM providers:

1.  **Install with multiple providers:**
    ```bash
    npx vibe-check-mcp install
    # Follow prompts to add Gemini, OpenAI, and OpenRouter keys
    ```

2.  **Configure environment:** Edit `.env` to include all API keys

3.  **Switch providers:**
    ```bash
    # Use Gemini
    export DEFAULT_LLM_PROVIDER=gemini
    vibe-check start

    # Use OpenAI
    export DEFAULT_LLM_PROVIDER=openai
    vibe-check start
    ```

### Scenario 3: Team Collaboration

A team wants to share a Vibe Check MCP instance:

1.  **Install on shared server:**
    ```bash
    npx vibe-check-mcp install --path /opt/vibe-check-mcp
    ```

2.  **Start for network access:**
    ```bash
    vibe-check start --host 0.0.0.0 --port 3000
    ```

3.  **Team members configure:** Each team member adds the server to their MCP client configuration

## Advanced Configuration

### Custom Installation Directory

Install to a specific directory for better control:

```bash
npx vibe-check-mcp install --path /opt/vibe-check-mcp
```

### Production Deployment

For production use, consider these settings:

```bash
# Install to system directory
sudo npx vibe-check-mcp install --path /opt/vibe-check-mcp

# Start with specific configuration
export DEFAULT_LLM_PROVIDER=openrouter
export DEFAULT_MODEL=anthropic/claude-3-opus
vibe-check start --host 0.0.0.0 --port 3000
```

### Custom Server Configuration

You can modify the server startup by editing the configuration files in your installation directory:

- **Server settings:** `~/.vibe-check-mcp/config.json`
- **Environment:** `~/.vibe-check-mcp/.env`
- **Client configs:** `~/.vibe-check-mcp/clients/`

## Frequently Asked Questions (FAQ)

**Q: How do I update my installation?**
A: Run the installer again: `npx vibe-check-mcp install`. It will detect your existing installation and offer to update it.

**Q: Where are the configuration files stored?**
A: By default in `~/.vibe-check-mcp/`. Use `vibe-check doctor` to see the exact paths.

**Q: Can I use multiple API keys for the same provider?**
A: Currently, only one API key per provider is supported. You can switch providers using the `DEFAULT_LLM_PROVIDER` environment variable.

**Q: How do I reset my configuration?**
A: Run `vibe-check uninstall --force` and then reinstall with `npx vibe-check-mcp install`.

**Q: Is the NPX installer safe?**
A: Yes. The NPX installer downloads the official package from npm and runs it in a sandboxed environment. Always verify you're using the correct package: `@pv-bhat/vibe-check-mcp`.

**Q: Can I run multiple instances of Vibe Check MCP?**
A: Yes, but you need to use different ports for each instance. Use the `--port` option when starting: `vibe-check start --port 3001`.

**Q: How do I contribute to the project?**
A: See the [Contributing Guide](../CONTRIBUTING.md) for detailed information on how to contribute to Vibe Check MCP.

## Platform-Specific Notes

### Windows
- CLI works in both Command Prompt and PowerShell
- Installation adds the `vibe-check` command to your user PATH
- May need terminal restart for PATH changes to take effect

### macOS
- Installation adds PATH configuration to `.zshrc`, `.bashrc`, or `.profile`
- Run `source ~/.zshrc` or restart terminal for changes to take effect
- Compatible with both Intel and Apple Silicon Macs

### Linux
- Installation adds PATH configuration to `.bashrc` or `.profile`
- Run `source ~/.bashrc` or restart terminal for changes to take effect
- Tested on Ubuntu, CentOS, and Arch Linux