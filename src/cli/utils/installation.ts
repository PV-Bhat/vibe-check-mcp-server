/**
 * Installation state detection utility for production readiness.
 *
 * This module provides utilities to detect the installation state of the Vibe Check MCP server,
 * including detection of incomplete installations, corrupted files, and proper setup validation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { platform } from './platform.js';
import { ConfigManager } from './config.js';

/**
 * Installation state enumeration
 */
export enum InstallationState {
  NOT_INSTALLED = 'NOT_INSTALLED',
  INSTALLED = 'INSTALLED',
  CORRUPTED = 'CORRUPTED',
  PARTIAL = 'PARTIAL',
  UPGRADE_NEEDED = 'UPGRADE_NEEDED'
}

/**
 * Installation state details
 */
export interface InstallationStateInfo {
  state: InstallationState;
  details: {
    version?: string;
    configExists: boolean;
    configValid: boolean;
    binariesExist: boolean;
    dependenciesMet: boolean;
    permissionsOk: boolean;
    pathsValid: boolean;
  };
  issues: string[];
  recommendations: string[];
  recoveryActions: string[];
}

/**
 * Installation component check result
 */
interface ComponentCheck {
  name: string;
  exists: boolean;
  valid: boolean;
  issues: string[];
  path?: string;
}

/**
 * Installation state detection utility
 */
export class InstallationDetector {
  private projectRoot: string;
  private logger: (message: string, level?: 'info' | 'warn' | 'error') => void;

  constructor(options: {
    projectRoot?: string;
    logger?: (message: string, level?: 'info' | 'warn' | 'error') => void;
  } = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.logger = options.logger || this.defaultLogger;
  }

  private defaultLogger(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] [InstallationDetector] ${message}`);
  }

  /**
   * Detect the current installation state
   */
  async detectInstallationState(): Promise<InstallationStateInfo> {
    this.logger('Starting installation state detection...', 'info');

    const components = await this.checkComponents();
    const issues: string[] = [];
    const recommendations: string[] = [];
    const recoveryActions: string[] = [];

    // Analyze component states
    const configManager = new ConfigManager({
      configName: 'mcp-server',
      defaultConfig: {} as any,
      logger: this.logger
    });

    const configExists = components.config.exists;
    const configValid = components.config.valid;
    const binariesExist = components.binaries.exists;
    const dependenciesMet = components.dependencies.valid;
    const permissionsOk = components.permissions.valid;
    const pathsValid = components.paths.valid;

    // Collect issues from component checks
    Object.values(components).forEach(component => {
      issues.push(...component.issues);
    });

    // Determine installation state
    let state: InstallationState;

    if (!configExists && !binariesExist) {
      state = InstallationState.NOT_INSTALLED;
      recommendations.push('Run "vibe-check-mcp install" to perform initial installation');
      recoveryActions.push('Complete full installation process');
    } else if (configExists && binariesExist && configValid && dependenciesMet && permissionsOk && pathsValid) {
      state = InstallationState.INSTALLED;
      recommendations.push('Installation is complete and functional');
    } else if (configExists && !configValid) {
      state = InstallationState.CORRUPTED;
      recommendations.push('Configuration is corrupted or invalid');
      recoveryActions.push('Restore configuration from backup or reinitialize');
      recoveryActions.push('Run "vibe-check-mcp install --force" to reinstall');
    } else if (configExists && binariesExist && (!dependenciesMet || !permissionsOk || !pathsValid)) {
      state = InstallationState.PARTIAL;
      recommendations.push('Installation is incomplete - some components are missing or misconfigured');

      if (!dependenciesMet) {
        recoveryActions.push('Install missing dependencies');
      }
      if (!permissionsOk) {
        recoveryActions.push('Fix file and directory permissions');
      }
      if (!pathsValid) {
        recoveryActions.push('Check and fix path configurations');
      }
    } else {
      state = InstallationState.CORRUPTED;
      recommendations.push('Installation state is inconsistent or corrupted');
      recoveryActions.push('Run "vibe-check-mcp install --force" to perform clean reinstallation');
    }

    // Check for version compatibility
    const version = await this.detectVersion();
    if (version && state === InstallationState.INSTALLED) {
      const upgradeNeeded = await this.checkUpgradeNeeded(version);
      if (upgradeNeeded) {
        state = InstallationState.UPGRADE_NEEDED;
        recommendations.push(`Current version ${version} needs upgrade`);
        recoveryActions.push('Run "vibe-check-mcp install" to upgrade');
      }
    }

    const result: InstallationStateInfo = {
      state,
      details: {
        version,
        configExists,
        configValid,
        binariesExist,
        dependenciesMet,
        permissionsOk,
        pathsValid
      },
      issues,
      recommendations,
      recoveryActions
    };

    this.logger(`Installation state detected: ${state}`, 'info');
    return result;
  }

  /**
   * Check all installation components
   */
  private async checkComponents(): Promise<Record<string, ComponentCheck>> {
    const components: Record<string, ComponentCheck> = {};

    // Check configuration
    components.config = await this.checkConfiguration();

    // Check binaries
    components.binaries = await this.checkBinaries();

    // Check dependencies
    components.dependencies = await this.checkDependencies();

    // Check permissions
    components.permissions = await this.checkPermissions();

    // Check paths
    components.paths = await this.checkPaths();

    return components;
  }

  /**
   * Check configuration component
   */
  private async checkConfiguration(): Promise<ComponentCheck> {
    const issues: string[] = [];
    let exists = false;
    let valid = false;

    try {
      const configManager = new ConfigManager({
        configName: 'mcp-server',
        defaultConfig: {} as any,
        logger: this.logger
      });

      exists = configManager.exists();

      if (exists) {
        try {
          const config = configManager.read();
          valid = config && typeof config === 'object' && config.version;
          if (!valid) {
            issues.push('Configuration file exists but appears to be corrupted or invalid');
          }
        } catch (error) {
          issues.push(`Failed to read configuration: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        issues.push('Configuration file does not exist');
      }
    } catch (error) {
      issues.push(`Configuration check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      name: 'Configuration',
      exists,
      valid,
      issues,
      path: platform.getUserConfigDir()
    };
  }

  /**
   * Check binary files component
   */
  private async checkBinaries(): Promise<ComponentCheck> {
    const issues: string[] = [];
    let exists = false;
    let valid = false;

    try {
      const buildPath = path.join(this.projectRoot, 'build');
      const indexPath = path.join(buildPath, 'index.js');

      exists = fs.existsSync(buildPath) && fs.existsSync(indexPath);

      if (exists) {
        try {
          // Try to require the index file to check if it's valid
          const stats = fs.statSync(indexPath);
          valid = stats.isFile() && stats.size > 0;

          if (!valid) {
            issues.push('Build files exist but appear to be corrupted or empty');
          }
        } catch (error) {
          issues.push(`Failed to validate build files: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        issues.push('Build files do not exist - project needs to be built');
      }
    } catch (error) {
      issues.push(`Binary check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      name: 'Binaries',
      exists,
      valid,
      issues,
      path: path.join(this.projectRoot, 'build')
    };
  }

  /**
   * Check dependencies component
   */
  private async checkDependencies(): Promise<ComponentCheck> {
    const issues: string[] = [];
    let exists = true;
    let valid = true;

    try {
      // Check package.json exists
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        issues.push('package.json not found');
        return { name: 'Dependencies', exists: false, valid: false, issues };
      }

      // Check node_modules exists
      const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        issues.push('node_modules directory not found - run npm install');
        valid = false;
      }

      // Check key dependencies
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const keyDeps = ['commander', '@modelcontextprotocol/sdk'];

      for (const dep of keyDeps) {
        const depPath = path.join(nodeModulesPath, dep);
        if (!fs.existsSync(depPath)) {
          issues.push(`Missing dependency: ${dep}`);
          valid = false;
        }
      }
    } catch (error) {
      issues.push(`Dependency check failed: ${error instanceof Error ? error.message : String(error)}`);
      valid = false;
    }

    return {
      name: 'Dependencies',
      exists,
      valid,
      issues,
      path: path.join(this.projectRoot, 'node_modules')
    };
  }

  /**
   * Check permissions component
   */
  private async checkPermissions(): Promise<ComponentCheck> {
    const issues: string[] = [];
    let exists = true;
    let valid = true;

    try {
      // Check if we can write to config directory
      const configDir = platform.getUserConfigDir();
      try {
        platform.ensureDir(configDir);
      } catch (error) {
        issues.push(`Cannot create config directory: ${error instanceof Error ? error.message : String(error)}`);
        valid = false;
      }

      // Check if we can write to data directory
      const dataDir = platform.getUserDataDir();
      try {
        platform.ensureDir(dataDir);
      } catch (error) {
        issues.push(`Cannot create data directory: ${error instanceof Error ? error.message : String(error)}`);
        valid = false;
      }

      // Check project directory permissions
      try {
        fs.accessSync(this.projectRoot, fs.constants.R_OK | fs.constants.W_OK);
      } catch (error) {
        issues.push(`Cannot read/write to project directory: ${this.projectRoot}`);
        valid = false;
      }

      // Windows-specific permission checks
      if (platform.isWindows) {
        if (platform.isWindowsWithRestrictedPermissions()) {
          issues.push('Running with restricted permissions on Windows');
          valid = false;
        }
      }
    } catch (error) {
      issues.push(`Permission check failed: ${error instanceof Error ? error.message : String(error)}`);
      valid = false;
    }

    return {
      name: 'Permissions',
      exists,
      valid,
      issues
    };
  }

  /**
   * Check paths component
   */
  private async checkPaths(): Promise<ComponentCheck> {
    const issues: string[] = [];
    let exists = true;
    let valid = true;

    try {
      // Check all critical paths for Windows compatibility
      const criticalPaths = [
        platform.getUserConfigDir(),
        platform.getUserDataDir(),
        platform.getUserCacheDir(),
        this.projectRoot
      ];

      for (const criticalPath of criticalPaths) {
        if (platform.isWindows) {
          const validation = platform.validateWindowsPath(criticalPath);
          if (!validation.valid) {
            issues.push(`Invalid Windows path: ${criticalPath} - ${validation.issues.join(', ')}`);
            valid = false;
          }
        }

        // Check if path is accessible
        try {
          fs.accessSync(criticalPath, fs.constants.R_OK);
        } catch (error) {
          issues.push(`Path not accessible: ${criticalPath}`);
          valid = false;
        }
      }
    } catch (error) {
      issues.push(`Path check failed: ${error instanceof Error ? error.message : String(error)}`);
      valid = false;
    }

    return {
      name: 'Paths',
      exists,
      valid,
      issues
    };
  }

  /**
   * Detect current version
   */
  private async detectVersion(): Promise<string | undefined> {
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        return packageJson.version;
      }
    } catch (error) {
      this.logger(`Failed to detect version: ${error instanceof Error ? error.message : String(error)}`, 'warn');
    }
    return undefined;
  }

  /**
   * Check if upgrade is needed
   */
  private async checkUpgradeNeeded(currentVersion: string): Promise<boolean> {
    try {
      const configManager = new ConfigManager({
        configName: 'mcp-server',
        defaultConfig: {} as any,
        logger: this.logger
      });

      if (configManager.exists()) {
        try {
          const config = configManager.read();
          if (config.version && config.version !== currentVersion) {
            return true;
          }
        } catch (error) {
          // Config might be corrupted, assume upgrade needed
          return true;
        }
      }
    } catch (error) {
      this.logger(`Failed to check upgrade needed: ${error instanceof Error ? error.message : String(error)}`, 'warn');
    }
    return false;
  }

  /**
   * Get human-readable state description
   */
  static getStateDescription(state: InstallationState): string {
    switch (state) {
      case InstallationState.NOT_INSTALLED:
        return 'The application is not installed';
      case InstallationState.INSTALLED:
        return 'The application is properly installed and ready to use';
      case InstallationState.CORRUPTED:
        return 'The installation is corrupted and needs repair';
      case InstallationState.PARTIAL:
        return 'The installation is incomplete';
      case InstallationState.UPGRADE_NEEDED:
        return 'The application needs to be upgraded';
      default:
        return 'Unknown installation state';
    }
  }

  /**
   * Get recommended action for state
   */
  static getRecommendedAction(state: InstallationState): string {
    switch (state) {
      case InstallationState.NOT_INSTALLED:
        return 'Run "vibe-check-mcp install" to install';
      case InstallationState.INSTALLED:
        return 'Ready to use - run "vibe-check-mcp start" to begin';
      case InstallationState.CORRUPTED:
        return 'Run "vibe-check-mcp install --force" to reinstall';
      case InstallationState.PARTIAL:
        return 'Run "vibe-check-mcp install" to complete installation';
      case InstallationState.UPGRADE_NEEDED:
        return 'Run "vibe-check-mcp install" to upgrade';
      default:
        return 'Run "vibe-check-mcp doctor" for diagnosis';
    }
  }
}

// Export singleton instance for easy usage
export const installationDetector = new InstallationDetector();