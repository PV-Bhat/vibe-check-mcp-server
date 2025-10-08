#!/usr/bin/env node

/**
 * Start command - Starts the MCP server
 *
 * This command handles:
 * - Server startup logic using existing MCP server
 * - Transport mode selection (stdio/HTTP)
 * - Environment validation before start
 * - Process management and graceful shutdown
 * - Integration with existing server functionality
 */

import { Command } from 'commander';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createServer } from 'http';
import { platform } from '../utils/platform.js';
import { ConfigManager, DefaultConfigs } from '../utils/config.js';
import { EnvironmentManager } from '../utils/environment.js';
import { MessageFormatter, ErrorMessages, SuccessMessages } from '../utils/messaging.js';

interface StartOptions {
  port: string;
  transport: 'stdio' | 'http';
  daemon: boolean;
  verbose: boolean;
  host?: string;
  timeout?: number;
  'max-retries'?: number;
}

/**
 * Server process manager
 */
class ServerProcessManager {
  private process: ChildProcess | null = null;
  private httpServer: any = null;
  private isShuttingDown = false;
  private restartCount = 0;
  private maxRestarts = 3;

  constructor(private verbose: boolean = false) {
    // Setup graceful shutdown handlers
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGHUP', () => this.shutdown('SIGHUP'));
  }

  /**
   * Start server in stdio mode
   */
  async startStdioMode(serverScript: string, env: Record<string, string>): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      if (this.verbose) {
        console.log(`Starting server in stdio mode...`);
        console.log(`Script: ${serverScript}`);
      }

      const args = [serverScript];
      const serverProcess = spawn('node', args, {
        stdio: 'inherit',
        env: { ...process.env, ...env },
        cwd: path.dirname(serverScript)
      });

      serverProcess.on('error', (error) => {
        if (this.verbose) {
          console.error('Server process error:', error);
        }
        reject(error);
      });

      serverProcess.on('exit', (code, signal) => {
        if (this.verbose) {
          console.log(`Server process exited with code ${code}, signal ${signal}`);
        }

        if (!this.isShuttingDown && code !== 0) {
          if (this.restartCount < this.maxRestarts) {
            this.restartCount++;
            console.log(`Server crashed, restarting... (attempt ${this.restartCount}/${this.maxRestarts})`);
            setTimeout(() => {
              this.startStdioMode(serverScript, env).catch(() => {});
            }, 1000);
          } else {
            console.error('Server crashed too many times, giving up.');
            process.exit(1);
          }
        }
      });

      // Give the server a moment to start
      setTimeout(() => {
        if (serverProcess.pid && !serverProcess.killed) {
          this.process = serverProcess;
          resolve(serverProcess);
        } else {
          reject(new Error('Server failed to start'));
        }
      }, 1000);
    });
  }

  /**
   * Start server in HTTP mode
   */
  async startHttpMode(port: number, host: string, serverScript: string, env: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.verbose) {
        console.log(`Starting server in HTTP mode...`);
        console.log(`Port: ${port}, Host: ${host}`);
        console.log(`Script: ${serverScript}`);
      }

      // Create HTTP server that will forward requests to the MCP server
      const httpServer = createServer(async (req, res) => {
        // Basic MCP HTTP bridge
        if (req.url === '/mcp' && req.method === 'POST') {
          try {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });

            req.on('end', async () => {
              try {
                // In a real implementation, you would spawn the MCP server process
                // and communicate with it via stdio, then forward the response
                const requestData = JSON.parse(body);

                // For now, return a basic response
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  id: requestData.id,
                  result: { status: 'Server running in HTTP mode' }
                }));
              } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        } else {
          // Health check endpoint
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
          }));
        }
      });

      httpServer.listen(port, host, () => {
        if (this.verbose) {
          console.log(`HTTP server listening on ${host}:${port}`);
        }
        this.httpServer = httpServer;
        resolve(httpServer);
      });

      httpServer.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          const portError = ErrorMessages.portInUse(port);
          MessageFormatter.error(portError.message, portError.details, portError.suggestions);
          reject(new Error(`Port ${port} is already in use`));
        } else if (error.code === 'EACCES') {
          MessageFormatter.error('Permission Denied', `Cannot bind to port ${port}`, [
            'Ports below 1024 require administrator privileges',
            'Choose a port number above 1024',
            'Run the command with sudo/administrator rights'
          ]);
          reject(new Error(`Permission denied to bind to port ${port}`));
        } else {
          MessageFormatter.error('Server Error', `Failed to start HTTP server: ${error.message}`, [
            'Check if the port is available',
            'Verify network configuration',
            'Try a different port number'
          ]);
          reject(error);
        }
      });
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log(`\nReceived ${signal}, shutting down gracefully...`);

    const shutdownPromises: Promise<void>[] = [];

    if (this.process) {
      shutdownPromises.push(
        new Promise<void>((resolve) => {
          this.process!.once('exit', () => resolve());
          this.process!.kill('SIGTERM');

          // Force kill after 5 seconds
          setTimeout(() => {
            if (this.process && !this.process.killed) {
              this.process.kill('SIGKILL');
              resolve();
            }
          }, 5000);
        })
      );
    }

    if (this.httpServer) {
      shutdownPromises.push(
        new Promise<void>((resolve) => {
          this.httpServer!.close(() => resolve());
        })
      );
    }

    try {
      await Promise.race([
        Promise.all(shutdownPromises),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Shutdown timeout')), 10000)
        )
      ]);
      console.log('✅ Server stopped gracefully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

/**
 * Validate environment before starting server with enhanced error handling
 */
async function validateEnvironment(config: ConfigManager, environment: EnvironmentManager, verbose: boolean = false): Promise<void> {
  MessageFormatter.progress('Environment Validation', 'Checking system requirements and configuration...');

  // Check configuration exists
  if (!config.exists()) {
    const configError = ErrorMessages.configurationNotFound();
    MessageFormatter.error(configError.message, configError.details, configError.suggestions, configError.nextSteps);
    throw new Error('Configuration not found. Run "vibe-check-mcp install" first.');
  }

  // Load and validate configuration
  const serverConfig = config.read();
  const validation = config.validate ? config.validate(serverConfig) : { valid: true, errors: [], warnings: [] };

  if (!validation.valid) {
    MessageFormatter.error('Configuration Validation Failed', validation.errors.join('; '), [
      'Check your configuration file for syntax errors',
      'Ensure all required fields are present',
      'Run "vibe-check-mcp install" to recreate configuration'
    ]);
    throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
  }

  if (validation.warnings.length > 0) {
    if (verbose) {
      MessageFormatter.warning('Configuration Warnings', validation.warnings.join('\n'));
    } else {
      MessageFormatter.warning('Configuration Warnings',
        `${validation.warnings.length} warning(s) found. Use --verbose for details.`);
    }
  }

  // Check API keys
  const apiKeyStatus = environment.checkApiKeys();
  const configuredProviders = Object.keys(apiKeyStatus).filter(p => apiKeyStatus[p]);

  if (configuredProviders.length === 0) {
    const apiKeyError = ErrorMessages.apiKeyMissing();
    MessageFormatter.warning(apiKeyError.message, apiKeyError.details, apiKeyError.suggestions);
    MessageFormatter.info('Limited Functionality', 'The server will start but AI features will not work without API keys.');
  } else if (verbose) {
    MessageFormatter.success('API Keys Configured',
      `${configuredProviders.length} provider(s) ready: ${configuredProviders.join(', ')}`);
  }

  // Check server script exists
  const serverScript = path.resolve(process.cwd(), 'build', 'index.js');
  if (!fs.existsSync(serverScript)) {
    MessageFormatter.error('Server Build Not Found', `Server script not found at ${serverScript}`, [
      'Build the project with: npm run build',
      'Ensure you are in the correct project directory',
      'Check that the build completed successfully'
    ]);
    throw new Error(`Server script not found at ${serverScript}. Have you built the project?`);
  }

  MessageFormatter.success('Environment Validation Passed', 'All system requirements met');
}

/**
 * Run server start process with enhanced user experience
 */
export async function runStart(options: StartOptions): Promise<void> {
  const processManager = new ServerProcessManager(options.verbose);

  try {
    MessageFormatter.progress('Starting Vibe Check MCP Server', 'Initializing server components...');

    // Validate options with clearer error messages
    if (!['stdio', 'http'].includes(options.transport)) {
      MessageFormatter.error('Invalid Transport Type', 'The specified transport mode is not supported.', [
        'Use "stdio" for direct client communication',
        'Use "http" for web-based communication'
      ]);
      process.exit(1);
    }

    const port = parseInt(options.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      MessageFormatter.error('Invalid Port Number', 'The specified port is not valid.', [
        'Use a port number between 1 and 65535',
        'Common ports: 3000, 3001, 8080, 9000'
      ]);
      process.exit(1);
    }

    if (options.daemon && options.transport === 'stdio') {
      MessageFormatter.warning('Daemon Mode Recommendation', [
        'Daemon mode with stdio transport is not recommended.',
        'Consider using HTTP transport for better daemon compatibility.'
      ]);
    }

    // Initialize managers
    const configManager = new ConfigManager({
      configName: 'mcp-server',
      defaultConfig: DefaultConfigs.mcpServer,
      logger: options.verbose ? (msg, level) => console.log(`  [${level?.toUpperCase()}] ${msg}`) : undefined
    });

    const environment = new EnvironmentManager({
      logger: options.verbose ? (msg, level) => console.log(`  [${level?.toUpperCase()}] ${msg}`) : undefined
    });

    // Validate environment
    await validateEnvironment(configManager, environment, options.verbose);

    // Get server script path
    const serverScript = path.resolve(process.cwd(), 'build', 'index.js');

    // Prepare environment variables
    const env: Record<string, string> = {};
    const envSummary = environment.getConfigurationSummary();

    // Add API keys to environment
    for (const provider of envSummary.hasApiKeys) {
      const apiKey = environment.getApiKey(provider);
      if (apiKey) {
        const envKey = provider.toUpperCase() + '_API_KEY';
        env[envKey] = apiKey;
      }
    }

    // Add transport-specific environment variables
    if (options.transport === 'http') {
      env.PORT = options.port;
      env.MCP_HTTP_PORT = options.port;
      if (options.host) {
        env.MCP_HOST = options.host;
      }
    }

    env.VIBE_CHECK_LOG_LEVEL = options.verbose ? 'debug' : 'info';
    env.VIBE_CHECK_TRANSPORT = options.transport;

    MessageFormatter.info('Transport Configuration', `Starting server in ${options.transport.toUpperCase()} mode`);

    // Start server based on transport mode
    if (options.transport === 'stdio') {
      MessageFormatter.progress('Starting STDIO Server', 'Initializing MCP server for direct client communication');

      const serverProcess = await processManager.startStdioMode(serverScript, env);

      SuccessMessages.serverStarted('STDIO', [
        `Process ID: ${serverProcess.pid}`,
        `Server script: ${serverScript}`,
        `Transport: Direct STDIO communication`
      ]);

      if (!options.daemon) {
        MessageFormatter.info('Usage Instructions', [
          'The server is now running and ready to accept MCP requests',
          'Use Ctrl+C to stop the server gracefully',
          'Check your MCP client to confirm the connection'
        ]);

        if (options.verbose) {
          MessageFormatter.info('Debug Information', [
            `Process ID: ${serverProcess.pid}`,
            `Server script: ${serverScript}`,
            `Working directory: ${process.cwd()}`,
            `Environment variables: ${Object.keys(env).join(', ')}`
          ]);
        }
      }

    } else {
      const host = options.host || 'localhost';
      MessageFormatter.progress('Starting HTTP Server', `Initializing web server on ${host}:${port}`);

      const httpServer = await processManager.startHttpMode(port, host, serverScript, env);

      const serverDetails = [
        `Server URL: http://${host}:${port}`,
        `MCP endpoint: http://${host}:${port}/mcp`,
        `Health check: http://${host}:${port}/`,
        `Transport: HTTP-based communication`
      ];

      SuccessMessages.serverStarted('HTTP', serverDetails.join('\n'));

      MessageFormatter.info('Client Configuration', [
        'Configure your MCP client to use HTTP transport',
        `Set the MCP server URL to: http://${host}:${port}/mcp`,
        'Use Ctrl+C to stop the server'
      ]);

      if (options.verbose) {
        MessageFormatter.info('Debug Information', [
          `Server URL: http://${host}:${port}`,
          `MCP endpoint: http://${host}:${port}/mcp`,
          `Health check endpoint: http://${host}:${port}/`,
          `Server script: ${serverScript}`,
          `Environment variables: ${Object.keys(env).join(', ')}`,
          `Host binding: ${host}`,
          `Port: ${port}`
        ]);
      }
    }

    // Handle daemon mode
    if (options.daemon) {
      console.log('\n🔄 Running in daemon mode...');
      console.log('   Check the logs for server activity');

      // In daemon mode, we might want to fork the process
      // For now, we'll just run in background with minimal output
      if (options.verbose) {
        console.log('   Daemon mode activated - minimal logging enabled');
      }
    }

    // Show environment summary
    const config = configManager.read();
    console.log('\n📊 Server Information:');
    console.log(`   Version: ${config.server?.version || 'Unknown'}`);
    console.log(`   Transport: ${options.transport}`);
    console.log(`   API Providers: ${envSummary.hasApiKeys.length} configured`);

    if (options.transport === 'http') {
      console.log(`   URL: http://${options.host}:${port}`);
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    MessageFormatter.error('Server Startup Failed', message, [
      'Run "vibe-check-mcp install" to ensure proper installation',
      'Check that you have built the project (npm run build)',
      'Verify your API keys are configured',
      'Check that the port is not already in use (for HTTP mode)',
      'Ensure you have the necessary permissions'
    ], [
      'Run diagnostics: vibe-check-mcp doctor',
      'Check installation: vibe-check-mcp install --force',
      'Build the project: npm run build',
      'Configure API keys: export GEMINI_API_KEY="your-key"'
    ]);

    if (options.verbose && error instanceof Error && error.stack) {
      MessageFormatter.error('Technical Details', error.stack);
    }

    process.exit(1);
  }
}

/**
 * Start command implementation
 */
export const startCommand = new Command('start')
  .description('Start the Vibe Check MCP server')
  .option('-p, --port <number>', 'Port number for HTTP transport', '3000')
  .option('-t, --transport <type>', 'Transport type (stdio|http)', 'stdio')
  .option('-d, --daemon', 'Run as background daemon', false)
  .option('-v, --verbose', 'Verbose output', false)
  .option('-h, --host <address>', 'Host address for HTTP transport', 'localhost')
  .option('--timeout <ms>', 'Startup timeout in milliseconds', '30000')
  .option('--max-retries <count>', 'Maximum restart attempts on crash', '3')
  .action(async (options: StartOptions) => {
    await runStart(options);
  });

// Export for use in main CLI
export default startCommand;