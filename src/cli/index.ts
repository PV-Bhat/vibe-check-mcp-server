#!/usr/bin/env node

/**
 * Vibe Check MCP CLI - Main entry point for the npx one-liner installer
 *
 * This CLI provides easy installation and management of the Vibe Check MCP server,
 * including setup, configuration, and maintenance operations.
 *
 * @author PV Bhat
 * @version 2.5.1
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Import command modules
import { installCommand, startCommand, uninstallCommand, doctorCommand, cleanupCommand } from './commands/index.js';
import { runInstall } from './commands/install.js';
import { runStart } from './commands/start.js';
import { ConfigManager, DefaultConfigs } from './utils/config.js';

// Get package.json version dynamically
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

/**
 * CLI error class for consistent error handling
 */
class CLIError extends Error {
  constructor(message: string, public code?: string, public recoverySteps?: string[]) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Enhanced error handling for different error types
 */
class ErrorHandler {
  /**
   * Handle filesystem permission errors
   */
  static handleFilesystemError(error: NodeJS.ErrnoException): CLIError {
    switch (error.code) {
      case 'EACCES':
        return new CLIError(
          `Permission denied: ${error.message}`,
          'PERMISSION_DENIED',
          [
            'Try running the command with administrator privileges',
            'Check if you have read/write access to the required directories',
            'On Windows: Right-click and "Run as administrator"',
            'On macOS/Linux: Use sudo if appropriate'
          ]
        );

      case 'EPERM':
        return new CLIError(
          `Operation not permitted: ${error.message}`,
          'OPERATION_NOT_PERMITTED',
          [
            'Check file and directory permissions',
            'Ensure the process has necessary rights',
            'On Windows: Check UAC settings and file ownership',
            'On macOS/Linux: Check SELinux/AppArmor policies'
          ]
        );

      case 'EBUSY':
        return new CLIError(
          `Resource busy: ${error.message}`,
          'RESOURCE_BUSY',
          [
            'Another process may be using the file',
            'Close any applications that might be locking the file',
            'Wait a moment and try again',
            'Restart the system if the issue persists'
          ]
        );

      case 'EMFILE':
      case 'ENFILE':
        return new CLIError(
          `Too many open files: ${error.message}`,
          'TOO_MANY_OPEN_FILES',
          [
            'Close some unused applications',
            'Increase system file descriptor limits',
            'Restart the system if needed'
          ]
        );

      case 'ENOSPC':
        return new CLIError(
          `No space left on device: ${error.message}`,
          'DISK_FULL',
          [
            'Free up disk space',
            'Clean temporary files and cache',
            'Remove unnecessary files'
          ]
        );

      case 'EROFS':
        return new CLIError(
          `Read-only file system: ${error.message}`,
          'READ_ONLY_FS',
          [
            'Check if the filesystem is mounted read-only',
            'Remount the filesystem with write permissions',
            'Choose a different installation directory'
          ]
        );

      default:
        return new CLIError(
          `Filesystem error: ${error.message}`,
          'FILESYSTEM_ERROR',
          ['Check file permissions and disk space']
        );
    }
  }

  /**
   * Handle network-related errors
   */
  static handleNetworkError(error: Error): CLIError {
    const message = error.message.toLowerCase();

    if (message.includes('enotfound') || message.includes('getaddrinfo')) {
      return new CLIError(
        `Network resolution failed: ${error.message}`,
        'NETWORK_RESOLUTION',
        [
          'Check your internet connection',
          'Verify DNS settings',
          'Try using a different network',
          'Check if the service is accessible'
        ]
      );
    }

    if (message.includes('econnrefused') || message.includes('connection refused')) {
      return new CLIError(
        `Connection refused: ${error.message}`,
        'CONNECTION_REFUSED',
        [
          'Check if the service is running',
          'Verify firewall settings',
          'Check if the correct port is being used',
          'Try again later'
        ]
      );
    }

    if (message.includes('timeout') || message.includes('etimedout')) {
      return new CLIError(
        `Network timeout: ${error.message}`,
        'NETWORK_TIMEOUT',
        [
          'Check your internet connection speed',
          'Try again with a better connection',
          'Increase timeout values if available',
          'Try during off-peak hours'
        ]
      );
    }

    if (message.includes('certificate') || message.includes('ssl') || message.includes('tls')) {
      return new CLIError(
        `SSL/TLS error: ${error.message}`,
        'SSL_ERROR',
        [
          'Check system date and time',
          'Update CA certificates',
          'Check proxy settings',
          'Try with certificate verification disabled if appropriate'
        ]
      );
    }

    return new CLIError(
      `Network error: ${error.message}`,
      'NETWORK_ERROR',
      ['Check internet connection and try again']
    );
  }

  /**
   * Handle API key validation errors
   */
  static handleAPIKeyError(error: Error): CLIError {
    const message = error.message.toLowerCase();

    if (message.includes('invalid') || message.includes('unauthorized')) {
      return new CLIError(
        `Invalid API key: ${error.message}`,
        'INVALID_API_KEY',
        [
          'Check your API key for typos',
          'Ensure the API key is active and valid',
          'Generate a new API key from the provider dashboard',
          'Check if the API key has the required permissions'
        ]
      );
    }

    if (message.includes('quota') || message.includes('rate limit')) {
      return new CLIError(
        `API quota exceeded: ${error.message}`,
        'API_QUOTA_EXCEEDED',
        [
          'Check your API usage statistics',
          'Wait for quota to reset (daily/monthly)',
          'Upgrade your plan if needed',
          'Use multiple API keys if supported'
        ]
      );
    }

    return new CLIError(
      `API key validation failed: ${error.message}`,
      'API_KEY_ERROR',
      ['Verify API key and try again']
    );
  }
}

/**
 * Gracefully exit with enhanced error handling
 */
function exitWithError(error: CLIError | Error, code?: string): never {
  if (error instanceof CLIError) {
    console.error(`❌ ${error.message}`);
    console.error(`\nError Code: ${error.code || 'UNKNOWN'}`);

    if (error.recoverySteps && error.recoverySteps.length > 0) {
      console.error('\n🔧 Recovery Steps:');
      error.recoverySteps.forEach((step, index) => {
        console.error(`   ${index + 1}. ${step}`);
      });
    }

    console.error('\nUse --help for usage information.');
    process.exit(1);
  } else {
    console.error(`❌ Unexpected error: ${error.message}`);
    console.error('\nUse --help for usage information.');
    process.exit(1);
  }
}

/**
 * Validate Node.js version compatibility
 */
function validateNodeVersion(): void {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  if (majorVersion < 18) {
    exitWithError(new CLIError(
      `Node.js v${nodeVersion} is not supported. Vibe Check MCP requires Node.js >= 18.0.0`,
      'UNSUPPORTED_NODE_VERSION'
    ));
  }
}

/**
 * Main CLI program setup
 */
const program = new Command();

// Configure program metadata
program
  .name('vibe-check-mcp')
  .description('Metacognitive AI agent oversight: adaptive CPI interrupts for alignment, reflection and safety')
  .version(packageJson.version, '-v, --version', 'Display version number')
  .helpOption('-h, --help', 'Display help for command');

/**
 * Global error handling
 */
program.configureOutput({
  writeErr: (str: string) => process.stderr.write(str),
  writeOut: (str: string) => process.stdout.write(str)
});

// Add global error handler
program.exitOverride((err: any) => {
  if (err.code === 'commander.help') {
    process.exit(0);
  }
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  throw err;
});

/**
 * Add all command modules to the program
 */
program.addCommand(installCommand);
program.addCommand(startCommand);
program.addCommand(uninstallCommand);
program.addCommand(doctorCommand);
program.addCommand(cleanupCommand);

/**
 * Intelligent first-time detection and routing
 */
program.action(async () => {
  console.log('🚀 Vibe Check MCP - Metacognitive AI Agent Oversight\n');

  try {
    // Initialize config manager for detection
    const configManager = new ConfigManager({
      configName: 'mcp-server',
      defaultConfig: DefaultConfigs.mcpServer
    });

    // Check if configuration exists
    const isFirstTime = !configManager.exists();

    if (isFirstTime) {
      console.log('🔍 First-time setup detected!');
      console.log('📋 Running automatic interactive installation...\n');

      // Set up SIGINT handler for graceful interruption during auto-install
      const sigintHandler = () => {
        console.log('\n\n⚠️  Installation interrupted by user.');
        console.log('💡 You can run "vibe-check-mcp install" later to complete setup.');
        process.exit(0);
      };

      process.on('SIGINT', sigintHandler);

      try {
        // Run interactive installation
        await runInstall({
          directory: process.cwd(),
          force: false,
          verbose: false,
          interactive: true,
          mode: 'stdio',
          skipClientSetup: false
        });

        console.log('\n🎉 Setup completed successfully!');
        console.log('🔄 You can now start the server with: vibe-check-mcp start');

      } catch (error) {
        console.error('\n❌ Setup failed:', error instanceof Error ? error.message : String(error));
        console.log('\n💡 You can try running "vibe-check-mcp install" manually.');
        process.exit(1);
      } finally {
        // Remove SIGINT handler after installation completes
        process.off('SIGINT', sigintHandler);
      }

    } else {
      console.log('✅ Configuration found, starting server...\n');

      try {
        // Start the server with default options
        await runStart({
          port: '3000',
          transport: 'stdio',
          daemon: false,
          verbose: false,
          host: 'localhost',
          timeout: 30000,
          'max-retries': 3
        });

      } catch (error) {
        console.error('\n❌ Failed to start server:', error instanceof Error ? error.message : String(error));
        console.log('\n💡 You can try:');
        console.log('   - "vibe-check-mcp start" to manually start the server');
        console.log('   - "vibe-check-mcp doctor" to diagnose issues');
        console.log('   - "vibe-check-mcp install --force" to reinstall');
        process.exit(1);
      }
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : String(error));
    console.log('\n💡 You can try:');
    console.log('   - "vibe-check-mcp install" to set up the service');
    console.log('   - "vibe-check-mcp doctor" to diagnose issues');
    console.log('   - "vibe-check-mcp --help" for available commands');
    process.exit(1);
  }
});

/**
 * Main execution block with comprehensive error handling
 */
async function main(): Promise<void> {
  try {
    // Validate environment
    validateNodeVersion();

    // Parse command line arguments
    await program.parseAsync(process.argv);

  } catch (error) {
    // Handle different error types with enhanced error processing
    if (error instanceof CLIError) {
      exitWithError(error);
    } else if (error instanceof Error) {
      // Check for filesystem errors
      if ('code' in error) {
        const fsError = error as NodeJS.ErrnoException;
        if (['EACCES', 'EPERM', 'EBUSY', 'EMFILE', 'ENFILE', 'ENOSPC', 'EROFS'].includes(fsError.code || '')) {
          exitWithError(ErrorHandler.handleFilesystemError(fsError));
        }
      }

      // Check for network errors
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('enotfound') || errorMessage.includes('econnrefused') ||
          errorMessage.includes('timeout') || errorMessage.includes('network') ||
          errorMessage.includes('certificate') || errorMessage.includes('ssl')) {
        exitWithError(ErrorHandler.handleNetworkError(error));
      }

      // Check for API key errors
      if (errorMessage.includes('api key') || errorMessage.includes('unauthorized') ||
          errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
        exitWithError(ErrorHandler.handleAPIKeyError(error));
      }

      // Handle specific known errors
      if (error.message.includes('unknown command')) {
        exitWithError(new CLIError(
          'Unknown command. Use --help for available commands.',
          'UNKNOWN_COMMAND',
          ['Check the command spelling', 'Use --help to see available commands']
        ));
      }

      exitWithError(new CLIError(
        error.message,
        'UNEXPECTED_ERROR',
        ['Try running the command again', 'Check system requirements', 'Report the issue if it persists']
      ));
    } else {
      exitWithError(new CLIError(
        'An unexpected error occurred',
        'UNKNOWN_ERROR',
        ['Try running the command again', 'Check system requirements', 'Report the issue if it persists']
      ));
    }
  }
}

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  process.exit(1);
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}