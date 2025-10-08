import * as fs from 'fs';
import * as path from 'path';
import { platform } from './platform.js';

/**
 * Configuration file interface
 */
export interface ConfigFile {
  version: string;
  created: number;
  updated: number;
  [key: string]: any;
}

/**
 * Configuration backup metadata
 */
export interface ConfigBackup {
  filename: string;
  timestamp: number;
  originalSize: number;
  description?: string;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration file management with backup and rollback
 */
export class ConfigManager<T extends ConfigFile = ConfigFile> {
  private configPath: string;
  private backupDir: string;
  private defaultConfig: T;
  private schema?: any;
  private logger: (message: string, level?: 'info' | 'warn' | 'error') => void;

  constructor(options: {
    appName?: string;
    configName: string;
    defaultConfig: T;
    schema?: any;
    logger?: (message: string, level?: 'info' | 'warn' | 'error') => void;
  }) {
    const { appName = 'vibe-check-mcp', configName, defaultConfig, schema, logger } = options;

    this.configPath = path.join(platform.getUserConfigDir(appName), `${configName}.json`);
    this.backupDir = path.join(platform.getUserConfigDir(appName), 'backups', configName);
    this.defaultConfig = defaultConfig;
    this.schema = schema;
    this.logger = logger || this.defaultLogger;

    // Ensure directories exist
    platform.ensureDir(path.dirname(this.configPath));
    platform.ensureDir(this.backupDir);
  }

  private defaultLogger(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] [ConfigManager] ${message}`);
  }

  /**
   * Read configuration from file with corruption prevention
   */
  read(): T {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.logger(`Configuration file not found at ${this.configPath}, creating default`, 'info');
        return this.create();
      }

      // Check file permissions first
      this.checkFilePermissions(this.configPath);

      const data = fs.readFileSync(this.configPath, 'utf8');

      // Validate JSON syntax before parsing
      if (!this.isValidJSON(data)) {
        throw new Error('Configuration file contains invalid JSON syntax');
      }

      const config = JSON.parse(data) as T;

      // Validate configuration structure and content
      const validation = this.validate(config);
      if (!validation.valid) {
        this.logger(`Configuration validation failed: ${validation.errors.join(', ')}`, 'error');

        // Check if this is corruption vs. invalid config
        if (this.isCorruptionError(new Error('Configuration validation failed'), validation)) {
          return this.handleCorruption(new Error('Configuration validation failed'));
        }

        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        this.logger(`Configuration warnings: ${validation.warnings.join(', ')}`, 'warn');
      }

      this.logger(`Configuration loaded from ${this.configPath}`, 'info');
      return config;

    } catch (error) {
      this.logger(`Failed to read configuration: ${error instanceof Error ? error.message : String(error)}`, 'error');

      // Handle specific error types
      if (this.isCorruptionError(error)) {
        return this.handleCorruption(error);
      }

      // For other errors, try backup restoration
      const restored = this.restoreFromLatestBackup();
      if (restored) {
        this.logger('Configuration restored from backup', 'info');
        return restored;
      }

      // No backup available - throw instead of silent fallback
      throw new Error(`Configuration corruption detected and no backup available. Please manually restore or reinitialize configuration. Original error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Write configuration to file
   */
  write(config: T, createBackup = true): void {
    try {
      // Validate before writing
      const validation = this.validate(config);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Create backup before overwriting
      if (createBackup && fs.existsSync(this.configPath)) {
        this.createBackup('Before configuration update');
      }

      // Update timestamps
      config.updated = Date.now();

      // Write with proper permissions
      const jsonData = JSON.stringify(config, null, 2);
      const mode = platform.getPrivateFileMode();

      if (mode !== undefined) {
        fs.writeFileSync(this.configPath, jsonData, { mode, encoding: 'utf8' });
      } else {
        fs.writeFileSync(this.configPath, jsonData, 'utf8');
      }

      this.logger(`Configuration saved to ${this.configPath}`, 'info');

    } catch (error) {
      this.logger(`Failed to write configuration: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  /**
   * Create initial configuration file
   */
  create(): T {
    const config = { ...this.defaultConfig };
    config.created = Date.now();
    config.updated = Date.now();

    this.write(config, false);
    this.logger(`Created new configuration file at ${this.configPath}`, 'info');

    return config;
  }

  /**
   * Validate configuration against schema
   */
  validate(config: any): ConfigValidationResult {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Basic structure validation
    if (!config || typeof config !== 'object') {
      result.valid = false;
      result.errors.push('Configuration must be an object');
      return result;
    }

    // Required fields
    const requiredFields = ['version', 'created', 'updated'];
    for (const field of requiredFields) {
      if (!(field in config)) {
        result.valid = false;
        result.errors.push(`Missing required field: ${field}`);
      }
    }

    // Version validation
    if (config.version && typeof config.version !== 'string') {
      result.valid = false;
      result.errors.push('Version must be a string');
    }

    // Timestamp validation
    const timestampFields = ['created', 'updated'];
    for (const field of timestampFields) {
      if (config[field] && typeof config[field] !== 'number') {
        result.valid = false;
        result.errors.push(`${field} must be a number`);
      }
    }

    // Schema validation (if provided)
    if (this.schema) {
      try {
        // Basic schema validation (can be enhanced with a schema validator)
        const schemaValidation = this.validateAgainstSchema(config, this.schema);
        if (!schemaValidation.valid) {
          result.valid = false;
          result.errors.push(...schemaValidation.errors);
        }
        result.warnings.push(...schemaValidation.warnings);
      } catch (error) {
        result.warnings.push(`Schema validation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return result;
  }

  private validateAgainstSchema(config: any, schema: any): ConfigValidationResult {
    // This is a basic schema validator - can be replaced with ajv or similar
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in config)) {
          result.valid = false;
          result.errors.push(`Missing required field: ${field}`);
        }
      }
    }

    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in config) {
          const prop = propSchema as any;
          if (prop.type && typeof config[key] !== prop.type) {
            result.valid = false;
            result.errors.push(`Field ${key} must be of type ${prop.type}`);
          }
        }
      }
    }

    return result;
  }

  /**
   * Create a backup of the current configuration
   */
  createBackup(description?: string): ConfigBackup {
    if (!fs.existsSync(this.configPath)) {
      throw new Error('Configuration file does not exist');
    }

    const timestamp = Date.now();
    const backupFilename = `backup-${timestamp}.json`;
    const backupPath = path.join(this.backupDir, backupFilename);

    try {
      // Copy current config to backup location
      const configData = fs.readFileSync(this.configPath);
      fs.writeFileSync(backupPath, configData);

      const backup: ConfigBackup = {
        filename: backupFilename,
        timestamp,
        originalSize: configData.length,
        description
      };

      // Save backup metadata
      this.saveBackupMetadata(backup);

      this.logger(`Configuration backup created: ${backupFilename}`, 'info');
      return backup;

    } catch (error) {
      this.logger(`Failed to create backup: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  /**
   * Get list of available backups
   */
  getBackups(): ConfigBackup[] {
    try {
      const metadataPath = path.join(this.backupDir, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        return [];
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return Array.isArray(metadata) ? metadata : [];
    } catch (error) {
      this.logger(`Failed to read backup metadata: ${error instanceof Error ? error.message : String(error)}`, 'warn');
      return [];
    }
  }

  /**
   * Restore configuration from a backup
   */
  restoreFromBackup(backupFilename: string): T | null {
    const backupPath = path.join(this.backupDir, backupFilename);

    if (!fs.existsSync(backupPath)) {
      this.logger(`Backup file not found: ${backupFilename}`, 'error');
      return null;
    }

    try {
      // Create backup of current config before restoring
      if (fs.existsSync(this.configPath)) {
        this.createBackup('Before restore from backup');
      }

      // Restore from backup
      const backupData = fs.readFileSync(backupPath, 'utf8');
      const config = JSON.parse(backupData) as T;

      // Validate restored config
      const validation = this.validate(config);
      if (!validation.valid) {
        this.logger(`Backup configuration is invalid: ${validation.errors.join(', ')}`, 'error');
        return null;
      }

      // Write restored config
      this.write(config, false);

      this.logger(`Configuration restored from backup: ${backupFilename}`, 'info');
      return config;

    } catch (error) {
      this.logger(`Failed to restore from backup: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return null;
    }
  }

  /**
   * Restore from the latest backup
   */
  restoreFromLatestBackup(): T | null {
    const backups = this.getBackups();
    if (backups.length === 0) {
      return null;
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => b.timestamp - a.timestamp);
    return this.restoreFromBackup(backups[0].filename);
  }

  /**
   * Delete old backups, keeping only the most recent ones
   */
  cleanupBackups(keepCount = 10): void {
    const backups = this.getBackups();

    if (backups.length <= keepCount) {
      return;
    }

    // Sort by timestamp (newest first) and remove old ones
    backups.sort((a, b) => b.timestamp - a.timestamp);
    const toDelete = backups.slice(keepCount);

    for (const backup of toDelete) {
      try {
        const backupPath = path.join(this.backupDir, backup.filename);
        fs.unlinkSync(backupPath);
        this.logger(`Deleted old backup: ${backup.filename}`, 'info');
      } catch (error) {
        this.logger(`Failed to delete backup ${backup.filename}: ${error instanceof Error ? error.message : String(error)}`, 'warn');
      }
    }

    // Update metadata
    const remainingBackups = backups.slice(0, keepCount);
    this.saveBackupMetadataArray(remainingBackups);
  }

  private saveBackupMetadata(backup: ConfigBackup): void {
    const backups = this.getBackups();
    backups.push(backup);
    this.saveBackupMetadataArray(backups);
  }

  private saveBackupMetadataArray(backups: ConfigBackup[]): void {
    const metadataPath = path.join(this.backupDir, 'metadata.json');
    const mode = platform.getPrivateFileMode();

    const data = JSON.stringify(backups, null, 2);

    if (mode !== undefined) {
      fs.writeFileSync(metadataPath, data, { mode, encoding: 'utf8' });
    } else {
      fs.writeFileSync(metadataPath, data, 'utf8');
    }
  }

  /**
   * Check file permissions for read access
   */
  private checkFilePermissions(filePath: string): void {
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new Error(`Permission denied reading configuration file: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Validate JSON syntax before parsing
   */
  private isValidJSON(data: string): boolean {
    try {
      JSON.parse(data);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Determine if an error represents configuration corruption
   */
  private isCorruptionError(error: any, validation?: ConfigValidationResult): boolean {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    // JSON syntax errors
    if (errorMessage.includes('unexpected token') ||
        errorMessage.includes('invalid json') ||
        errorMessage.includes('json parse') ||
        errorMessage.includes('syntaxerror')) {
      return true;
    }

    // File system errors that indicate corruption
    if (error instanceof Error && 'code' in error) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code === 'EBADF' || // Bad file descriptor
          fsError.code === 'EIO' ||   // I/O error
          fsError.code === 'ENOTDIR' || // Not a directory (path corruption)
          fsError.code === 'EISDIR' ||  // Is a directory (path corruption)
          fsError.code === 'EINVAL') {  // Invalid argument
        return true;
      }
    }

    // Validation errors that suggest corruption
    if (validation && !validation.valid) {
      const criticalFields = ['version', 'created', 'updated'];
      const hasCriticalFieldErrors = validation.errors.some(err =>
        criticalFields.some(field => err.toLowerCase().includes(field))
      );

      if (hasCriticalFieldErrors || validation.errors.length > 3) {
        return true;
      }
    }

    // Empty or extremely small files suggest corruption
    if (errorMessage.includes('unexpected end of input') ||
        errorMessage.includes('expecting')) {
      return true;
    }

    return false;
  }

  /**
   * Handle configuration corruption with backup restoration
   */
  private handleCorruption(originalError: any): T {
    this.logger('Configuration corruption detected, attempting recovery', 'error');

    // Create backup of corrupted file before attempting recovery
    if (fs.existsSync(this.configPath)) {
      try {
        const corruptionBackupPath = path.join(this.backupDir, `corrupted-${Date.now()}.json`);
        fs.copyFileSync(this.configPath, corruptionBackupPath);
        this.logger(`Corrupted configuration backed up to: ${corruptionBackupPath}`, 'info');
      } catch (backupError) {
        this.logger(`Failed to backup corrupted file: ${backupError instanceof Error ? backupError.message : String(backupError)}`, 'warn');
      }
    }

    // Try to restore from backup
    const restored = this.restoreFromLatestBackup();
    if (restored) {
      this.logger('Configuration successfully restored from backup after corruption', 'info');
      return restored;
    }

    // No backup available - throw detailed error
    throw new Error(
      `Configuration corruption detected and no backup available.\n` +
      `Corrupted file: ${this.configPath}\n` +
      `Original error: ${originalError instanceof Error ? originalError.message : String(originalError)}\n` +
      `To fix this issue:\n` +
      `1. Check if a backup exists in: ${this.backupDir}\n` +
      `2. Manually restore a valid configuration file\n` +
      `3. Delete the corrupted file and reinitialize configuration`
    );
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Get backup directory path
   */
  getBackupDir(): string {
    return this.backupDir;
  }

  /**
   * Check if configuration file exists
   */
  exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Delete configuration file
   */
  delete(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        // Create backup before deletion
        this.createBackup('Before configuration deletion');
        fs.unlinkSync(this.configPath);
        this.logger(`Configuration file deleted: ${this.configPath}`, 'info');
      }
    } catch (error) {
      this.logger(`Failed to delete configuration: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }
}

/**
 * Default configuration templates
 */
export const DefaultConfigs = {
  /**
   * Default MCP server configuration
   */
  mcpServer: {
    version: '1.0.0',
    created: Date.now(),
    updated: Date.now(),
    server: {
      name: 'vibe-check-mcp',
      version: '2.5.1',
      description: 'Metacognitive AI agent oversight'
    },
    logging: {
      level: 'info',
      file: true,
      console: true
    },
    features: {
      constitution: true,
      learning: true,
      distillation: true
    }
  } as ConfigFile,

  /**
   * Default CLI configuration
   */
  cli: {
    version: '1.0.0',
    created: Date.now(),
    updated: Date.now(),
    ui: {
      interactive: true,
      colors: true,
      compact: false
    },
    defaults: {
      provider: 'gemini',
      model: 'gemini-pro',
      timeout: 30000
    },
    logging: {
      level: 'info',
      file: true,
      maxFileSize: '10MB',
      maxFiles: 5
    }
  } as ConfigFile
};