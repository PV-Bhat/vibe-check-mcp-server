import * as fs from 'fs';
import * as path from 'path';
import { platform } from './platform.js';

/**
 * Provider configuration interface
 */
export interface ProviderConfig {
  name: string;
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  defaultModel?: string;
  maxTokens?: number;
  timeout?: number;
  retryAttempts?: number;
  customHeaders?: Record<string, string>;
  [key: string]: any;
}

/**
 * Environment configuration interface
 */
export interface EnvironmentConfig {
  providers: Record<string, ProviderConfig>;
  global: {
    timeout?: number;
    retryAttempts?: number;
    logLevel?: string;
    debug?: boolean;
  };
  security: {
    validateApiKeys: boolean;
    encryptStoredKeys: boolean;
    keyRotationDays?: number;
  };
}

/**
 * API key validation result
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  provider: string;
  error?: string;
  suggestions?: string[];
}

/**
 * Environment variable and API key management
 */
export class EnvironmentManager {
  private envPath: string;
  private configPath: string;
  private logger: (message: string, level?: 'info' | 'warn' | 'error') => void;
  private currentConfig: EnvironmentConfig;

  constructor(options: {
    appName?: string;
    logger?: (message: string, level?: 'info' | 'warn' | 'error') => void;
  } = {}) {
    const { appName = 'vibe-check-mcp', logger } = options;

    this.envPath = path.join(platform.getUserConfigDir(appName), '.env');
    this.configPath = path.join(platform.getUserConfigDir(appName), 'environment.json');
    this.logger = logger || this.defaultLogger;

    // Initialize default configuration
    this.currentConfig = this.getDefaultConfig();

    // Ensure directories exist
    platform.ensureDir(path.dirname(this.envPath));
    platform.ensureDir(path.dirname(this.configPath));

    // Load existing configuration
    this.loadConfiguration();
  }

  private defaultLogger(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] [EnvironmentManager] ${message}`);
  }

  private getDefaultConfig(): EnvironmentConfig {
    return {
      providers: {
        gemini: {
          name: 'Google Gemini',
          baseUrl: 'https://generativelanguage.googleapis.com',
          models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
          defaultModel: 'gemini-2.0-flash-exp',
          maxTokens: 8192,
          timeout: 30000,
          retryAttempts: 3
        },
        openai: {
          name: 'OpenAI',
          baseUrl: 'https://api.openai.com',
          models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
          defaultModel: 'gpt-4o',
          maxTokens: 4096,
          timeout: 30000,
          retryAttempts: 3
        },
        openrouter: {
          name: 'OpenRouter',
          baseUrl: 'https://openrouter.ai/api',
          models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro'],
          defaultModel: 'anthropic/claude-3.5-sonnet',
          maxTokens: 4096,
          timeout: 30000,
          retryAttempts: 3
        }
      },
      global: {
        timeout: 30000,
        retryAttempts: 3,
        logLevel: 'info',
        debug: false
      },
      security: {
        validateApiKeys: true,
        encryptStoredKeys: false,
        keyRotationDays: 90
      }
    };
  }

  /**
   * Load configuration from files and environment variables
   */
  private loadConfiguration(): void {
    try {
      // Load from .env file
      if (fs.existsSync(this.envPath)) {
        this.loadEnvFile();
        this.logger(`Loaded environment variables from ${this.envPath}`, 'info');
      }

      // Load from JSON configuration
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(configData) as EnvironmentConfig;
        this.currentConfig = this.mergeConfig(this.currentConfig, config);
        this.logger(`Loaded environment configuration from ${this.configPath}`, 'info');
      }

      // Override with system environment variables
      this.loadSystemEnvironment();

    } catch (error) {
      this.logger(`Failed to load environment configuration: ${error instanceof Error ? error.message : String(error)}`, 'warn');
    }
  }

  /**
   * Load .env file and set process.env variables
   */
  private loadEnvFile(): void {
    const envContent = fs.readFileSync(this.envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const [, key, value] = match;
          // Remove quotes if present
          const cleanValue = value.replace(/^["']|["']$/g, '');
          process.env[key] = cleanValue;
        }
      }
    }
  }

  /**
   * Load system environment variables
   */
  private loadSystemEnvironment(): void {
    // Global settings
    if (process.env.VIBE_CHECK_LOG_LEVEL) {
      this.currentConfig.global.logLevel = process.env.VIBE_CHECK_LOG_LEVEL;
    }
    if (process.env.VIBE_CHECK_DEBUG) {
      this.currentConfig.global.debug = process.env.VIBE_CHECK_DEBUG === 'true';
    }

    // Provider API keys
    const providerKeys = {
      gemini: 'GEMINI_API_KEY',
      openai: 'OPENAI_API_KEY',
      openrouter: 'OPENROUTER_API_KEY'
    };

    for (const [provider, envKey] of Object.entries(providerKeys)) {
      if (process.env[envKey]) {
        this.currentConfig.providers[provider].apiKey = process.env[envKey];
      }
    }
  }

  /**
   * Merge configuration objects
   */
  private mergeConfig(base: EnvironmentConfig, override: EnvironmentConfig): EnvironmentConfig {
    return {
      providers: { ...base.providers, ...override.providers },
      global: { ...base.global, ...override.global },
      security: { ...base.security, ...override.security }
    };
  }

  /**
   * Get API key for a provider
   */
  getApiKey(provider: string): string | undefined {
    const config = this.currentConfig.providers[provider];
    return config?.apiKey;
  }

  /**
   * Set API key for a provider
   */
  setApiKey(provider: string, apiKey: string): void {
    if (!this.currentConfig.providers[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    this.currentConfig.providers[provider].apiKey = apiKey;
    this.saveConfiguration();

    // Also set in process.env for immediate use
    const envKey = this.getProviderEnvKey(provider);
    if (envKey) {
      process.env[envKey] = apiKey;
    }

    this.logger(`API key set for provider: ${provider}`, 'info');
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(provider: string): ProviderConfig | undefined {
    return this.currentConfig.providers[provider];
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(provider: string, config: Partial<ProviderConfig>): void {
    if (!this.currentConfig.providers[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    this.currentConfig.providers[provider] = {
      ...this.currentConfig.providers[provider],
      ...config
    };

    this.saveConfiguration();
    this.logger(`Configuration updated for provider: ${provider}`, 'info');
  }

  /**
   * Get all provider configurations
   */
  getAllProviders(): Record<string, ProviderConfig> {
    return { ...this.currentConfig.providers };
  }

  /**
   * Get global configuration
   */
  getGlobalConfig(): EnvironmentConfig['global'] {
    return { ...this.currentConfig.global };
  }

  /**
   * Update global configuration
   */
  updateGlobalConfig(config: Partial<EnvironmentConfig['global']>): void {
    this.currentConfig.global = {
      ...this.currentConfig.global,
      ...config
    };

    this.saveConfiguration();
    this.logger('Global configuration updated', 'info');
  }

  /**
   * Validate API key format and availability
   */
  async validateApiKey(provider: string, apiKey?: string): Promise<ApiKeyValidationResult> {
    const keyToValidate = apiKey || this.getApiKey(provider);
    const providerConfig = this.currentConfig.providers[provider];

    if (!providerConfig) {
      return {
        valid: false,
        provider,
        error: `Unknown provider: ${provider}`,
        suggestions: ['Available providers: ' + Object.keys(this.currentConfig.providers).join(', ')]
      };
    }

    if (!keyToValidate) {
      return {
        valid: false,
        provider,
        error: 'No API key provided',
        suggestions: [
          `Set ${this.getProviderEnvKey(provider)} environment variable`,
          `Use setApiKey('${provider}', 'your-api-key') method`
        ]
      };
    }

    // Basic format validation
    const formatValidation = this.validateApiKeyFormat(provider, keyToValidate);
    if (!formatValidation.valid) {
      return formatValidation;
    }

    // If validation is disabled, return success
    if (!this.currentConfig.security.validateApiKeys) {
      return {
        valid: true,
        provider
      };
    }

    // Perform actual API validation (would require network access)
    try {
      const isValid = await this.testApiKeyWithProvider(provider, keyToValidate);
      return {
        valid: isValid,
        provider,
        error: isValid ? undefined : 'API key validation failed'
      };
    } catch (error) {
      return {
        valid: false,
        provider,
        error: `API key validation failed: ${error instanceof Error ? error.message : String(error)}`,
        suggestions: ['Check your internet connection', 'Verify the API key is correct and active']
      };
    }
  }

  /**
   * Validate API key format without network requests
   */
  private validateApiKeyFormat(provider: string, apiKey: string): ApiKeyValidationResult {
    const result: ApiKeyValidationResult = {
      valid: true,
      provider
    };

    switch (provider) {
      case 'gemini':
        if (!apiKey.startsWith('AIza') || apiKey.length < 35) {
          result.valid = false;
          result.error = 'Invalid Gemini API key format';
          result.suggestions = [
            'Gemini API keys start with "AIza"',
            'Keys should be at least 35 characters long',
            'Get your key from: https://makersuite.google.com/app/apikey'
          ];
        }
        break;

      case 'openai':
        if (!apiKey.startsWith('sk-') || apiKey.length < 40) {
          result.valid = false;
          result.error = 'Invalid OpenAI API key format';
          result.suggestions = [
            'OpenAI API keys start with "sk-"',
            'Keys should be at least 40 characters long',
            'Get your key from: https://platform.openai.com/api-keys'
          ];
        }
        break;

      case 'openrouter':
        if (!apiKey.startsWith('sk-or-v1-') || apiKey.length < 40) {
          result.valid = false;
          result.error = 'Invalid OpenRouter API key format';
          result.suggestions = [
            'OpenRouter API keys start with "sk-or-v1-"',
            'Keys should be at least 40 characters long',
            'Get your key from: https://openrouter.ai/keys'
          ];
        }
        break;

      default:
        // Generic validation for unknown providers
        if (apiKey.length < 20) {
          result.valid = false;
          result.error = 'API key appears to be too short';
          result.suggestions = ['API keys are typically at least 20 characters long'];
        }
        break;
    }

    return result;
  }

  /**
   * Test API key with actual provider API
   */
  private async testApiKeyWithProvider(provider: string, apiKey: string): Promise<boolean> {
    // This is a placeholder - in a real implementation, you would
    // make actual API calls to test the key
    // For now, we'll just do basic format validation

    const formatValidation = this.validateApiKeyFormat(provider, apiKey);
    return formatValidation.valid;
  }

  /**
   * Get environment variable key for a provider
   */
  private getProviderEnvKey(provider: string): string | null {
    const envKeys: Record<string, string> = {
      gemini: 'GEMINI_API_KEY',
      openai: 'OPENAI_API_KEY',
      openrouter: 'OPENROUTER_API_KEY'
    };

    return envKeys[provider] || null;
  }

  /**
   * Save configuration to file
   */
  private saveConfiguration(): void {
    try {
      // Save JSON configuration (without API keys for security)
      const configToSave = {
        ...this.currentConfig,
        providers: Object.fromEntries(
          Object.entries(this.currentConfig.providers).map(([key, config]) => [
            key,
            { ...config, apiKey: undefined } // Remove API key from saved config
          ])
        )
      };

      const data = JSON.stringify(configToSave, null, 2);
      const mode = platform.getPrivateFileMode();

      if (mode !== undefined) {
        fs.writeFileSync(this.configPath, data, { mode, encoding: 'utf8' });
      } else {
        fs.writeFileSync(this.configPath, data, 'utf8');
      }

      // Save API keys to .env file
      this.saveEnvFile();

    } catch (error) {
      this.logger(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  /**
   * Save API keys to .env file
   */
  private saveEnvFile(): void {
    const envLines: string[] = [];

    // Add header
    envLines.push('# Vibe Check MCP Environment Variables');
    envLines.push('# Generated on ' + new Date().toISOString());
    envLines.push('');

    // Add API keys
    for (const [provider, config] of Object.entries(this.currentConfig.providers)) {
      if (config.apiKey) {
        const envKey = this.getProviderEnvKey(provider);
        if (envKey) {
          envLines.push(`${envKey}=${config.apiKey}`);
        }
      }
    }

    // Add global settings
    if (this.currentConfig.global.logLevel && this.currentConfig.global.logLevel !== 'info') {
      envLines.push(`VIBE_CHECK_LOG_LEVEL=${this.currentConfig.global.logLevel}`);
    }

    if (this.currentConfig.global.debug) {
      envLines.push('VIBE_CHECK_DEBUG=true');
    }

    const envContent = envLines.join('\n');
    const mode = platform.getPrivateFileMode();

    if (mode !== undefined) {
      fs.writeFileSync(this.envPath, envContent, { mode, encoding: 'utf8' });
    } else {
      fs.writeFileSync(this.envPath, envContent, 'utf8');
    }
  }

  /**
   * Interactive setup for environment configuration
   */
  async interactiveSetup(): Promise<void> {
    this.logger('Starting interactive environment setup...', 'info');

    // This would typically use a library like inquirer or readline
    // For now, we'll provide a basic structure
    const setupInstructions = [
      'Interactive Environment Setup',
      '============================',
      '',
      'This setup will help you configure your API providers.',
      'You can also set these environment variables manually:',
      '',
      'Environment Variables:',
      '  GEMINI_API_KEY - Your Google Gemini API key',
      '  OPENAI_API_KEY - Your OpenAI API key',
      '  OPENROUTER_API_KEY - Your OpenRouter API key',
      '  VIBE_CHECK_LOG_LEVEL - Logging level (debug, info, warn, error)',
      '  VIBE_CHECK_DEBUG - Enable debug mode (true/false)',
      '',
      'API Key Sources:',
      '  Gemini: https://makersuite.google.com/app/apikey',
      '  OpenAI: https://platform.openai.com/api-keys',
      '  OpenRouter: https://openrouter.ai/keys',
      '',
      'Configuration files will be stored in:',
      `  ${this.envPath}`,
      `  ${this.configPath}`,
      ''
    ];

    this.logger(setupInstructions.join('\n'), 'info');

    // In a real implementation, you would prompt for input here
    this.logger('Interactive setup completed. Please set your API keys manually.', 'info');
  }

  /**
   * Check if API keys are configured
   */
  checkApiKeys(): Record<string, boolean> {
    const result: Record<string, boolean> = {};

    for (const provider of Object.keys(this.currentConfig.providers)) {
      result[provider] = !!this.getApiKey(provider);
    }

    return result;
  }

  /**
   * Get configuration summary
   */
  getConfigurationSummary(): {
    providers: string[];
    hasApiKeys: string[];
    global: EnvironmentConfig['global'];
    configFiles: string[];
  } {
    const providers = Object.keys(this.currentConfig.providers);
    const hasApiKeys = providers.filter(p => !!this.getApiKey(p));

    return {
      providers,
      hasApiKeys,
      global: this.currentConfig.global,
      configFiles: [this.envPath, this.configPath]
    };
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.currentConfig = this.getDefaultConfig();
    this.saveConfiguration();
    this.logger('Configuration reset to defaults', 'info');
  }

  /**
   * Get current configuration
   */
  getCurrentConfig(): EnvironmentConfig {
    return { ...this.currentConfig };
  }
}

// Export singleton instance for easy usage
export const environment = new EnvironmentManager();