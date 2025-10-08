/**
 * CLI utilities package exports
 */

// Platform utilities
export { PlatformUtils, platform } from './platform.js';
export type { PlatformType, ArchitectureType } from './platform.js';

// Configuration management
export { ConfigManager, DefaultConfigs } from './config.js';
export type { ConfigFile, ConfigBackup, ConfigValidationResult } from './config.js';

// Environment management
export { EnvironmentManager, environment } from './environment.js';
export type { ProviderConfig, EnvironmentConfig, ApiKeyValidationResult } from './environment.js';

// Client detection and management
export {
  registerClient,
  unregisterClient,
  backupClientConfig,
  restoreClientConfig,
  validateClientConfig,
} from './clients.js';
export type { ClientType, TransportMode, ClaudeConfig, CursorConfig } from './clients.js';
export {
  detectClient,
  findInstalledClients,
  getAllClientsStatuses,
  getClientConfigPath,
} from './detection.js';
export type { ValidationResult, ClientStatus } from './detection.js';

// Re-export common utilities for convenience
export { platform as getPlatform } from './platform.js';
export { environment as getEnvironment } from './environment.js';