/**
 * Centralized messaging utilities for consistent user experience
 */

/**
 * Message types with their associated icons and colors
 */
export enum MessageType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  PROGRESS = 'progress',
  PROMPT = 'prompt',
  WAITING = 'waiting'
}

/**
 * Message configuration
 */
export interface MessageConfig {
  type: MessageType;
  title?: string;
  message: string;
  details?: string;
  suggestions?: string[];
  nextSteps?: string[];
  duration?: number;
}

/**
 * Centralized messaging system for consistent CLI user experience
 */
export class MessageFormatter {
  private static icons = {
    [MessageType.SUCCESS]: '✅',
    [MessageType.ERROR]: '❌',
    [MessageType.WARNING]: '⚠️',
    [MessageType.INFO]: 'ℹ️',
    [MessageType.PROGRESS]: '🔄',
    [MessageType.PROMPT]: '❓',
    [MessageType.WAITING]: '⏳'
  };

  private static colors = {
    [MessageType.SUCCESS]: '\x1b[32m', // Green
    [MessageType.ERROR]: '\x1b[31m',   // Red
    [MessageType.WARNING]: '\x1b[33m', // Yellow
    [MessageType.INFO]: '\x1b[36m',    // Cyan
    [MessageType.PROGRESS]: '\x1b[34m', // Blue
    [MessageType.PROMPT]: '\x1b[35m',  // Magenta
    [MessageType.WAITING]: '\x1b[90m'   // Gray
  };

  private static reset = '\x1b[0m';

  /**
   * Format and output a message
   */
  static format(config: MessageConfig): string {
    const icon = this.icons[config.type];
    const color = this.colors[config.type];
    const reset = this.reset;

    let output = [];

    // Title (if provided)
    if (config.title) {
      output.push(`${color}${icon} ${config.title}${reset}`);
    }

    // Main message
    if (config.title) {
      output.push(`   ${config.message}`);
    } else {
      output.push(`${color}${icon} ${config.message}${reset}`);
    }

    // Details (if provided)
    if (config.details) {
      output.push(`   ${config.details}`);
    }

    // Suggestions (if provided)
    if (config.suggestions && config.suggestions.length > 0) {
      output.push(`\n💡 Suggestions:`);
      config.suggestions.forEach((suggestion, index) => {
        output.push(`   ${index + 1}. ${suggestion}`);
      });
    }

    // Next steps (if provided)
    if (config.nextSteps && config.nextSteps.length > 0) {
      output.push(`\n🎯 Next Steps:`);
      config.nextSteps.forEach((step, index) => {
        output.push(`   ${index + 1}. ${step}`);
      });
    }

    return output.join('\n');
  }

  /**
   * Log a message to console
   */
  static log(config: MessageConfig): void {
    console.log(this.format(config));
  }

  /**
   * Success message
   */
  static success(message: string, details?: string, suggestions?: string[]): void {
    this.log({
      type: MessageType.SUCCESS,
      message,
      details,
      suggestions
    });
  }

  /**
   * Error message with actionable advice
   */
  static error(message: string, details?: string, suggestions?: string[], nextSteps?: string[]): void {
    this.log({
      type: MessageType.ERROR,
      message,
      details,
      suggestions,
      nextSteps
    });
  }

  /**
   * Warning message
   */
  static warning(message: string, details?: string, suggestions?: string[]): void {
    this.log({
      type: MessageType.WARNING,
      message,
      details,
      suggestions
    });
  }

  /**
   * Info message
   */
  static info(message: string, details?: string): void {
    this.log({
      type: MessageType.INFO,
      message,
      details
    });
  }

  /**
   * Progress message
   */
  static progress(message: string, details?: string): void {
    this.log({
      type: MessageType.PROGRESS,
      message,
      details
    });
  }

  /**
   * Prompt message for user interaction
   */
  static prompt(message: string, details?: string): void {
    this.log({
      type: MessageType.PROMPT,
      message,
      details
    });
  }

  /**
   * Waiting message for long operations
   */
  static waiting(message: string, details?: string): void {
    this.log({
      type: MessageType.WAITING,
      message,
      details
    });
  }
}

/**
 * Progress indicator for multi-step operations
 */
export class ProgressTracker {
  private steps: string[] = [];
  private currentStep = 0;
  private startTime = Date.now();
  private verbose: boolean;

  constructor(verbose: boolean = false, title: string = 'Installation Progress') {
    this.verbose = verbose;
    console.log(`\n🚀 ${title}`);
    console.log('='.repeat(title.length + 4));
  }

  /**
   * Add steps to the progress tracker
   */
  addSteps(steps: string[]): void {
    this.steps = steps;
  }

  /**
   * Move to the next step
   */
  nextStep(details?: string): void {
    if (this.currentStep < this.steps.length) {
      const step = this.steps[this.currentStep];
      const stepNumber = this.currentStep + 1;
      const totalSteps = this.steps.length;
      const progress = Math.round((stepNumber / totalSteps) * 100);

      console.log(`\n[${stepNumber}/${totalSteps}] ${step}`);
      console.log(`   Progress: ${progress}%`);

      if (details && this.verbose) {
        console.log(`   Details: ${details}`);
      }

      this.currentStep++;
    }
  }

  /**
   * Complete the progress with a summary
   */
  complete(title: string, details?: string, nextSteps?: string[]): void {
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    console.log(`\n✅ ${title}`);
    console.log(`   Completed in ${duration}s`);

    if (details) {
      console.log(`   ${details}`);
    }

    if (nextSteps && nextSteps.length > 0) {
      console.log('\n🎯 Next Steps:');
      nextSteps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step}`);
      });
    }
  }

  /**
   * Handle errors during progress
   */
  error(title: string, error: Error | string, suggestions?: string[], nextSteps?: string[]): void {
    const message = error instanceof Error ? error.message : error;
    const duration = Math.round((Date.now() - this.startTime) / 1000);

    console.log(`\n❌ ${title}`);
    console.log(`   Failed after ${duration}s`);
    console.log(`   Error: ${message}`);

    if (suggestions && suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      suggestions.forEach((suggestion, index) => {
        console.log(`   ${index + 1}. ${suggestion}`);
      });
    }

    if (nextSteps && nextSteps.length > 0) {
      console.log('\n🎯 Next Steps:');
      nextSteps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step}`);
      });
    }
  }
}

/**
 * Common error messages with actionable advice
 */
export class ErrorMessages {
  static configurationNotFound(suggestions?: string[]): MessageConfig {
    return {
      type: MessageType.ERROR,
      message: 'Configuration not found',
      details: 'The Vibe Check MCP server has not been installed or configured.',
      suggestions: suggestions || [
        'Run "npx vibe-check-mcp install" to install the server',
        'Make sure you are in the correct directory',
        'Check that the installation was not interrupted'
      ],
      nextSteps: [
        'Run the installer: npx vibe-check-mcp install',
        'Configure your API keys after installation',
        'Restart your MCP client'
      ]
    };
  }

  static apiKeyMissing(provider?: string): MessageConfig {
    const providerText = provider ? ` for ${provider}` : '';
    return {
      type: MessageType.ERROR,
      message: `API key not configured${providerText}`,
      details: 'API keys are required for the Vibe Check MCP server to function properly.',
      suggestions: [
        `Set the ${provider ? provider.toUpperCase() + '_API_KEY' : 'appropriate'} environment variable`,
        'Run "npx vibe-check-mcp install --interactive" for guided setup',
        'Check your .env file in the project directory'
      ],
      nextSteps: [
        'Configure your API key',
        'Restart the server to apply changes',
        'Verify the connection with "vibe-check-mcp doctor"'
      ]
    };
  }

  static permissionDenied(path?: string): MessageConfig {
    return {
      type: MessageType.ERROR,
      message: 'Permission denied',
      details: path ? `Cannot write to directory: ${path}` : 'Insufficient permissions to perform this operation.',
      suggestions: [
        'Run the command with appropriate permissions',
        'Check directory ownership and permissions',
        'Try running from a different directory'
      ],
      nextSteps: [
        'Fix the permission issue',
        'Retry the operation',
        'Contact your system administrator if needed'
      ]
    };
  }

  static networkError(operation: string): MessageConfig {
    return {
      type: MessageType.ERROR,
      message: 'Network connection failed',
      details: `Unable to ${operation}. Please check your internet connection.`,
      suggestions: [
        'Check your internet connection',
        'Verify firewall and proxy settings',
        'Try the operation again in a few moments'
      ],
      nextSteps: [
        'Restore network connectivity',
        'Retry the operation',
        'Use offline mode if available'
      ]
    };
  }

  static portInUse(port: number): MessageConfig {
    return {
      type: MessageType.ERROR,
      message: `Port ${port} is already in use`,
      details: 'Another application is using this port, preventing the server from starting.',
      suggestions: [
        `Use a different port with --port <number>`,
        'Stop the application using this port',
        'Restart the application with a different configuration'
      ],
      nextSteps: [
        'Choose a different port: --port 3001',
        'Stop the conflicting application',
        'Retry starting the server'
      ]
    };
  }
}

/**
 * Common success messages
 */
export class SuccessMessages {
  static installationComplete(configPath?: string): MessageConfig {
    return {
      type: MessageType.SUCCESS,
      message: 'Installation completed successfully!',
      details: configPath ? `Configuration saved to: ${configPath}` : undefined,
      suggestions: [
        'Configure your API keys if not already done',
        'Restart your MCP client to apply changes'
      ],
      nextSteps: [
        'Set your API key: export GEMINI_API_KEY="your-key"',
        'Start the server: vibe-check start',
        'Test the connection: vibe-check doctor'
      ]
    };
  }

  static serverStarted(mode: string, details?: string): MessageConfig {
    return {
      type: MessageType.SUCCESS,
      message: `Server started successfully in ${mode} mode`,
      details,
      suggestions: [
        'The server is ready to accept MCP requests',
        'Use Ctrl+C to stop the server'
      ]
    };
  }
}