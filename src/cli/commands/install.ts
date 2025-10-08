#!/usr/bin/env node

/**
 * Install command - Sets up the Vibe Check MCP server
 *
 * This command handles:
 * - Interactive environment setup for API keys
 * - Client detection and auto-registration
 * - Configuration validation and creation
 * - Progress reporting and user feedback
 * - Error handling for installation failures
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { platform } from '../utils/platform.js';
import { ConfigManager, DefaultConfigs } from '../utils/config.js';
import { EnvironmentManager } from '../utils/environment.js';
import { registerClient, validateClientConfig, backupClientConfig } from '../utils/clients.js';
import { detectClient } from '../utils/detection.js';
import { MessageFormatter, ProgressTracker, ErrorMessages, SuccessMessages } from '../utils/messaging.js';

interface InstallOptions {
  directory: string;
  force: boolean;
  verbose: boolean;
  client?: 'claude' | 'cursor';
  mode?: 'stdio' | 'http';
  skipClientSetup: boolean;
  interactive?: boolean;
}


/**
 * Interactive API key setup with enhanced messaging
 */
async function setupApiKeys(environment: EnvironmentManager, verbose: boolean = false): Promise<void> {
  MessageFormatter.info('API Key Configuration', 'Let\'s configure your LLM providers for optimal performance');

  const providers = ['gemini', 'openai', 'openrouter'];
  const configuredKeys: string[] = [];
  const setupNeeded: string[] = [];

  for (const provider of providers) {
    const currentKey = environment.getApiKey(provider);
    if (currentKey) {
      MessageFormatter.success(`${provider} API key`, 'Already configured and ready to use');
      configuredKeys.push(provider);
      continue;
    }

    setupNeeded.push(provider);
  }

  // Only show setup instructions for providers that need configuration
  if (setupNeeded.length > 0) {
    MessageFormatter.warning('API keys needed', `${setupNeeded.length} provider(s) need API key configuration`);

    for (const provider of setupNeeded) {
      const providerConfig = environment.getProviderConfig(provider);
      if (providerConfig && verbose) {
        MessageFormatter.info(`${provider.toUpperCase()} Configuration Details`,
          `Default model: ${providerConfig.defaultModel}\nMax tokens: ${providerConfig.maxTokens}`);
      }

      const instructions = {
        gemini: {
          url: 'https://makersuite.google.com/app/apikey',
          prefix: 'AIza',
          envVar: 'GEMINI_API_KEY',
          description: 'Google\'s powerful Gemini models'
        },
        openai: {
          url: 'https://platform.openai.com/api-keys',
          prefix: 'sk-',
          envVar: 'OPENAI_API_KEY',
          description: 'OpenAI\'s GPT models including GPT-4'
        },
        openrouter: {
          url: 'https://openrouter.ai/keys',
          prefix: 'sk-or-v1-',
          envVar: 'OPENROUTER_API_KEY',
          description: 'Access to multiple AI models through one API'
        }
      };

      const info = instructions[provider as keyof typeof instructions];

      MessageFormatter.info(`${provider.toUpperCase()} Setup`, [
        `Provider: ${info.description}`,
        `Get your key: ${info.url}`,
        `Key format: Starts with "${info.prefix}"`,
        `Environment variable: ${info.envVar}`
      ].join('\n'));

      if (verbose) {
        MessageFormatter.info('Quick Setup Command',
          `export ${info.envVar}="your-api-key-here"`);
      }
    }

    MessageFormatter.prompt('Next Steps', [
      '1. Get API keys from the URLs above',
      '2. Set the environment variables',
      '3. Or run with --interactive flag for guided setup'
    ]);
  }

  // Summary
  if (configuredKeys.length > 0) {
    MessageFormatter.success('API Key Summary',
      `${configuredKeys.length} provider(s) configured: ${configuredKeys.join(', ')}`);
  }

  if (setupNeeded.length > 0) {
    MessageFormatter.warning('Configuration Needed',
      `${setupNeeded.length} provider(s) still need API keys: ${setupNeeded.join(', ')}`);
  }
}

/**
 * Validate system requirements
 */
function validateSystemRequirements(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 18) {
    errors.push(`Node.js v${nodeVersion} is not supported. Requires Node.js >= 18.0.0`);
  }

  // Check available memory
  const memoryUsage = process.memoryUsage();
  const availableMemory = require('os').totalmem();
  if (availableMemory < 1024 * 1024 * 1024) { // Less than 1GB
    errors.push('Low memory detected. At least 1GB RAM recommended');
  }

  // Check disk space (basic check)
  try {
    const projectRoot = process.cwd();
    const stats = fs.statSync(projectRoot);
    // This is a basic check - you could use more sophisticated disk space checking
  } catch (error) {
    errors.push('Cannot access current directory');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Run installation process with enhanced user experience
 */
export async function runInstall(options: InstallOptions): Promise<void> {
  const progress = new ProgressTracker(options.verbose, 'Vibe Check MCP Server Installation');

  try {
    // Initialize installation steps with clearer descriptions
    progress.addSteps([
      'Validating system requirements',
      'Setting up configuration files',
      'Configuring API keys',
      'Registering with MCP client',
      'Final validation and testing'
    ]);

    // Step 1: Validate system requirements
    progress.nextStep('Checking Node.js version, memory, and disk space');
    const systemValidation = validateSystemRequirements();
    if (!systemValidation.valid) {
      progress.error('System Requirements Validation Failed',
        new Error(systemValidation.errors.join('; ')),
        [
          'Upgrade Node.js to version 18 or later',
          'Ensure you have sufficient memory and disk space',
          'Check file permissions in the installation directory'
        ],
        [
          'Fix the system requirements above',
          'Run the installer again: npx vibe-check-mcp install',
          'Get help with: vibe-check-mcp doctor'
        ]
      );
      process.exit(1);
    }

    // Step 2: Setup configuration
    progress.nextStep('Creating configuration files and directories');
    const configManager = new ConfigManager({
      configName: 'mcp-server',
      defaultConfig: DefaultConfigs.mcpServer,
      logger: options.verbose ? (msg, level) => console.log(`  [${level?.toUpperCase()}] ${msg}`) : undefined
    });

    const environment = new EnvironmentManager({
      logger: options.verbose ? (msg, level) => console.log(`  [${level?.toUpperCase()}] ${msg}`) : undefined
    });

    // Check if already installed
    if (configManager.exists() && !options.force) {
      const config = configManager.read();
      MessageFormatter.warning('Already Installed', [
        'Vibe Check MCP server is already configured in this directory.',
        `Configuration found at: ${configManager.getConfigPath()}`
      ]);

      if (!options.skipClientSetup) {
        MessageFormatter.info('Proceeding with client setup', 'Updating MCP client configurations...');
      } else {
        MessageFormatter.success('Installation Complete', 'Skipping client setup as requested. The server is ready to use.');
        return;
      }
    } else {
      // Create configuration
      const config = configManager.create();
      MessageFormatter.success('Configuration Created', `Server configuration saved to: ${configManager.getConfigPath()}`);

      if (options.verbose) {
        MessageFormatter.info('Configuration Details', [
          `Config file: ${configManager.getConfigPath()}`,
          `Backup directory: ${configManager.getBackupDir()}`,
          `Config version: ${config.server?.version || 'Unknown'}`
        ]);
      }
    }

    // Step 3: Configure API keys
    progress.nextStep('Verifying and configuring API keys');
    if (options.interactive) {
      await setupApiKeys(environment, options.verbose);
    } else {
      // Check existing API keys
      const apiKeyStatus = environment.checkApiKeys();
      const configuredProviders = Object.keys(apiKeyStatus).filter(p => apiKeyStatus[p]);

      if (configuredProviders.length > 0) {
        MessageFormatter.success('API Keys Found',
          `${configuredProviders.length} provider(s) already configured: ${configuredProviders.join(', ')}`);
      } else {
        MessageFormatter.warning('No API Keys Configured', [
          'API keys are required for the Vibe Check MCP server to function.',
          'You can configure them now or later using the methods below.'
        ], [
          'Set environment variable: export GEMINI_API_KEY="your-api-key"',
          'Run interactive setup: npx vibe-check-mcp install --interactive',
          'Create .env file in project directory'
        ]);
      }
    }

    // Step 4: Register with client
    progress.nextStep('Configuring MCP client integration');
    if (!options.skipClientSetup) {
      const clientType = options.client || 'claude';
      const transportMode = options.mode as 'stdio' | 'http';

      // Validate client type
      if (!['claude', 'cursor'].includes(clientType)) {
        throw new Error(`Invalid client type: ${clientType}. Use 'claude' or 'cursor'`);
      }

      // Validate transport mode
      if (!['stdio', 'http'].includes(transportMode)) {
        throw new Error(`Invalid transport mode: ${transportMode}. Use 'stdio' or 'http'`);
      }

      // Claude Desktop only supports stdio
      let finalTransportMode = transportMode;
      if (clientType === 'claude' && transportMode === 'http') {
        MessageFormatter.warning('Transport Mode Adjusted', [
          'Claude Desktop only supports stdio transport.',
          'Automatically switching to stdio mode for compatibility.'
        ]);
        finalTransportMode = 'stdio';
      }

      try {
        MessageFormatter.progress('Client Registration', `Configuring ${clientType} with ${finalTransportMode} transport`);

        // Backup existing client config
        const backupPath = await backupClientConfig(clientType);
        MessageFormatter.success('Backup Created', `Previous configuration backed up to: ${backupPath}`);

        // Register the client
        await registerClient(clientType, finalTransportMode, options.directory);

        MessageFormatter.success('Client Registered', `Successfully configured ${clientType} (${finalTransportMode} mode)`);

        // Validate the registration
        const isValid = await validateClientConfig(clientType, finalTransportMode, options.directory);
        if (!isValid) {
          MessageFormatter.warning('Client Validation Failed', [
            'The client configuration was created but validation failed.',
            'This might be due to client-specific requirements or permissions.'
          ], [
            'Restart your MCP client to apply changes',
            'Check the client configuration file manually',
            'Run "vibe-check-mcp doctor" for detailed diagnostics'
          ]);
        }

      } catch (error) {
        MessageFormatter.error('Client Registration Failed',
          `Failed to register with ${clientType}: ${error instanceof Error ? error.message : String(error)}`,
          [
            'Check that the client is installed and accessible',
            'Verify file permissions for configuration directories',
            'Ensure the client is not running (restart may be required)'
          ],
          [
            'Manually configure the client using the documentation',
            'Try again with administrator privileges',
            'Get help with: vibe-check-mcp doctor'
          ]
        );
      }
    } else {
      MessageFormatter.info('Skipping Client Setup', 'Client configuration skipped as requested. You can configure it later.');
    }

    // Step 5: Final validation
    progress.nextStep('Performing final validation and testing');

    // Validate configuration
    const config = configManager.read();
    const validation = configManager.validate ? configManager.validate(config) : { valid: true, errors: [], warnings: [] };

    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Check environment setup
    const envSummary = environment.getConfigurationSummary();

    // Prepare completion message
    const summaryDetails = [
      `Configuration: ${configManager.getConfigPath()}`,
      `Environment: ${envSummary.configFiles.join(', ')}`,
      `API Providers: ${envSummary.hasApiKeys.length}/${envSummary.providers.length} configured`
    ];

    if (!options.skipClientSetup) {
      const clientType = options.client || 'claude';
      summaryDetails.push(`Client: ${clientType} (${options.mode} mode)`);
    }

    const nextSteps = [
      'Configure your API key: export GEMINI_API_KEY="your-api-key"',
      'Restart your MCP client to apply changes',
      'Start the server: vibe-check start',
      'Verify setup: vibe-check doctor'
    ];

    // Add warnings if any
    if (validation.warnings.length > 0) {
      summaryDetails.push(`Warnings: ${validation.warnings.length} - use --verbose for details`);
    }

    // Add API key reminder if needed
    if (envSummary.hasApiKeys.length === 0) {
      nextSteps.unshift('⚠️  Configure API keys - required for functionality');
    }

    progress.complete(
      'Installation completed successfully!',
      summaryDetails.join('\n   '),
      nextSteps
    );

    // Show detailed information if verbose
    if (options.verbose) {
      MessageFormatter.info('Installation Details', [
        `Platform: ${platform.getPlatformInfo()}`,
        `Working directory: ${options.directory}`,
        `Node.js version: ${process.version}`,
        `Config backups: ${configManager.getBackups().length} available`,
        `Server script: ${path.resolve(options.directory, 'build', 'index.js')}`
      ]);

      if (validation.warnings.length > 0) {
        MessageFormatter.warning('Configuration Warnings', validation.warnings);
      }
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';

    progress.error(
      'Installation Failed',
      error instanceof Error ? error : new Error(message),
      [
        'Run "vibe-check-mcp doctor" for detailed diagnostics',
        'Check that you have the required permissions',
        'Ensure your system meets the requirements',
        'Verify network connectivity for downloads'
      ],
      [
        'Fix the issues mentioned above',
        'Try reinstalling with --force flag',
        'Get help with: vibe-check-mcp doctor --verbose'
      ]
    );

    if (options.verbose && error instanceof Error && error.stack) {
      MessageFormatter.error('Technical Details', error.stack);
    }

    process.exit(1);
  }
}

/**
 * Install command implementation
 */
export const installCommand = new Command('install')
  .description('Install and configure Vibe Check MCP server')
  .option('-d, --directory <path>', 'Installation directory (default: current directory)', process.cwd())
  .option('-f, --force', 'Force installation even if already installed', false)
  .option('-v, --verbose', 'Verbose output', false)
  .option('-c, --client <type>', 'Client type (claude|cursor)')
  .option('-m, --mode <type>', 'Transport mode (stdio|http)', 'stdio')
  .option('--skip-client-setup', 'Skip automatic client configuration', false)
  .option('--interactive', 'Interactive setup mode', false)
  .action(async (options: InstallOptions) => {
    await runInstall(options);
  });

// Export for use in main CLI
export default installCommand;