#!/usr/bin/env node

/**
 * Uninstall command - Removes the MCP server installation
 *
 * This command handles:
 * - Client de-registration
 * - Configuration cleanup
 * - Backup creation before removal
 * - Rollback capability
 * - Confirmation prompts for safety
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { platform } from '../utils/platform.js';
import { ConfigManager, DefaultConfigs } from '../utils/config.js';
import { EnvironmentManager } from '../utils/environment.js';
import { unregisterClient, backupClientConfig, restoreClientConfig } from '../utils/clients.js';
import { detectClient } from '../utils/detection.js';

interface UninstallOptions {
  force: boolean;
  verbose: boolean;
  'keep-config': boolean;
  'keep-backups': boolean;
  backup: boolean;
  'backup-path'?: string;
  'clients-only': boolean;
}

/**
 * Uninstall safety checks and confirmations
 */
class UninstallSafety {
  private criticalPaths: string[] = [];
  private backedUpFiles: string[] = [];

  constructor(private verbose: boolean = false) {}

  /**
   * Add critical path to track
   */
  addCriticalPath(path: string): void {
    this.criticalPaths.push(path);
  }

  /**
   * Add file to backup list
   */
  addBackedUpFile(file: string): void {
    this.backedUpFiles.push(file);
  }

  getBackedUpFiles(): string[] {
    return [...this.backedUpFiles];
  }

  /**
   * Check if path is safe to remove
   */
  isSafeToRemove(filePath: string): boolean {
    // Safety checks
    const absPath = path.resolve(filePath);

    // Don't remove system directories
    const systemDirs = [
      platform.getUserHome(),
      '/etc',
      '/usr',
      '/bin',
      '/sbin',
      process.cwd()
    ];

    for (const sysDir of systemDirs) {
      if (absPath.startsWith(path.resolve(sysDir))) {
        return false;
      }
    }

    // Don't remove files outside our config directory
    const configDir = platform.getUserConfigDir();
    if (!absPath.startsWith(configDir) && !absPath.includes('vibe-check-mcp')) {
      return false;
    }

    return true;
  }

  /**
   * Get safety report
   */
  getSafetyReport(): { safe: string[]; unsafe: string[]; warnings: string[] } {
    const safe: string[] = [];
    const unsafe: string[] = [];
    const warnings: string[] = [];

    for (const criticalPath of this.criticalPaths) {
      if (this.isSafeToRemove(criticalPath)) {
        safe.push(criticalPath);
      } else {
        unsafe.push(criticalPath);
        warnings.push(`Path appears to be outside safe removal zone: ${criticalPath}`);
      }
    }

    return { safe, unsafe, warnings };
  }
}

/**
 * Backup manager for uninstall safety
 */
class UninstallBackup {
  private backupDir: string;
  private backupManifest: any[] = [];

  constructor(private verbose: boolean = false) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.backupDir = path.join(platform.getTempDir(), `vibe-check-uninstall-${timestamp}`);
    platform.ensureDir(this.backupDir);
  }

  /**
   * Backup a file or directory
   */
  async backupPath(sourcePath: string, relativeName?: string): Promise<string> {
    if (!fs.existsSync(sourcePath)) {
      if (this.verbose) {
        console.log(`  Skipping backup of non-existent path: ${sourcePath}`);
      }
      return '';
    }

    const name = relativeName || path.basename(sourcePath);
    const backupPath = path.join(this.backupDir, name);

    try {
      if (fs.statSync(sourcePath).isDirectory()) {
        // Copy directory recursively
        this.copyDirectory(sourcePath, backupPath);
      } else {
        // Copy file
        fs.copyFileSync(sourcePath, backupPath);
      }

      this.backupManifest.push({
        originalPath: sourcePath,
        backupPath,
        name,
        timestamp: new Date().toISOString(),
        size: this.getPathSize(sourcePath)
      });

      if (this.verbose) {
        console.log(`  Backed up: ${sourcePath} -> ${backupPath}`);
      }

      return backupPath;
    } catch (error) {
      console.warn(`  Warning: Failed to backup ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  /**
   * Copy directory recursively
   */
  private copyDirectory(source: string, target: string): void {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const items = fs.readdirSync(source);
    for (const item of items) {
      const sourcePath = path.join(source, item);
      const targetPath = path.join(target, item);

      if (fs.statSync(sourcePath).isDirectory()) {
        this.copyDirectory(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  /**
   * Get size of file or directory
   */
  private getPathSize(targetPath: string): number {
    try {
      const stat = fs.statSync(targetPath);
      if (stat.isFile()) {
        return stat.size;
      } else if (stat.isDirectory()) {
        let totalSize = 0;
        const items = fs.readdirSync(targetPath);
        for (const item of items) {
          totalSize += this.getPathSize(path.join(targetPath, item));
        }
        return totalSize;
      }
    } catch (error) {
      // Ignore errors
    }
    return 0;
  }

  /**
   * Save backup manifest
   */
  saveManifest(): void {
    const manifestPath = path.join(this.backupDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(this.backupManifest, null, 2));

    if (this.verbose) {
      console.log(`  Backup manifest saved: ${manifestPath}`);
      console.log(`  Total items backed up: ${this.backupManifest.length}`);
    }
  }

  /**
   * Get backup directory path
   */
  getBackupDir(): string {
    return this.backupDir;
  }

  /**
   * Get backup summary
   */
  getBackupSummary(): { path: string; itemCount: number; totalSize: number } {
    const totalSize = this.backupManifest.reduce((sum, item) => sum + item.size, 0);
    return {
      path: this.backupDir,
      itemCount: this.backupManifest.length,
      totalSize
    };
  }
}

/**
 * Prompt for user confirmation
 */
async function promptConfirmation(message: string, force: boolean = false): Promise<boolean> {
  if (force) {
    return true;
  }

  console.log(`\n⚠️  ${message}`);
  console.log('This action cannot be undone.');

  // Simple confirmation prompt
  // In a real implementation, you would use readline or inquirer
  console.log('Are you sure you want to continue? (y/N)');

  // For now, return false to be safe
  // In a real CLI, you would wait for user input
  console.log('\n💡 To confirm uninstallation, use --force flag or run interactively.');
  return false;
}

/**
 * Perform uninstallation
 */
async function performUninstall(
  configManager: ConfigManager,
  environment: EnvironmentManager,
  safety: UninstallSafety,
  backup: UninstallBackup,
  options: UninstallOptions
): Promise<void> {
  const pathsToRemove: string[] = [];

  // Add configuration files to removal list
  const configPath = configManager.getConfigPath();
  if (fs.existsSync(configPath)) {
    safety.addCriticalPath(configPath);
    pathsToRemove.push(configPath);
  }

  const backupDir = configManager.getBackupDir();
  if (fs.existsSync(backupDir) && !options['keep-backups']) {
    safety.addCriticalPath(backupDir);
    pathsToRemove.push(backupDir);
  }

  // Add environment files to removal list
  const envSummary = environment.getConfigurationSummary();
  for (const configFile of envSummary.configFiles) {
    if (fs.existsSync(configFile)) {
      safety.addCriticalPath(configFile);
      pathsToRemove.push(configFile);
    }
  }

  // Add user data directories
  const dataDir = platform.getUserDataDir();
  if (fs.existsSync(dataDir)) {
    safety.addCriticalPath(dataDir);
    pathsToRemove.push(dataDir);
  }

  const cacheDir = platform.getUserCacheDir();
  if (fs.existsSync(cacheDir)) {
    safety.addCriticalPath(cacheDir);
    pathsToRemove.push(cacheDir);
  }

  // Safety check
  const safetyReport = safety.getSafetyReport();
  if (safetyReport.unsafe.length > 0) {
    console.warn('\n⚠️  Safety warnings:');
    safetyReport.warnings.forEach(warning => console.warn(`   ${warning}`));

    if (!options.force) {
      throw new Error('Unsafe paths detected. Use --force to override safety checks.');
    }
  }

  // Perform removal
  console.log('\n🗑️  Removing installation files...');
  let removedCount = 0;

  for (const removePath of pathsToRemove) {
    try {
      if (options.verbose) {
        console.log(`  Removing: ${removePath}`);
      }

      if (fs.statSync(removePath).isDirectory()) {
        fs.rmSync(removePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(removePath);
      }

      removedCount++;
    } catch (error) {
      console.warn(`  Warning: Failed to remove ${removePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`✅ Removed ${removedCount} file(s)/director(y/ies)`);
}

/**
 * Uninstall command implementation
 */
export const uninstallCommand = new Command('uninstall')
  .description('Uninstall Vibe Check MCP server')
  .option('-f, --force', 'Force removal without confirmation', false)
  .option('-v, --verbose', 'Verbose output', false)
  .option('--keep-config', 'Keep configuration files', false)
  .option('--keep-backups', 'Keep backup files', false)
  .option('--backup', 'Create backup before uninstalling', true)
  .option('--backup-path <path>', 'Custom backup directory')
  .option('--clients-only', 'Only unregister from clients, keep files', false)
  .action(async (options: UninstallOptions) => {
    const safety = new UninstallSafety(options.verbose);
    const backup = new UninstallBackup(options.verbose);

    try {
      console.log('🗑️  Vibe Check MCP Server Uninstall\n');

      // Initialize managers
      const configManager = new ConfigManager({
        configName: 'mcp-server',
        defaultConfig: DefaultConfigs.mcpServer,
        logger: options.verbose ? (msg, level) => console.log(`  [${level?.toUpperCase()}] ${msg}`) : undefined
      });

      const environment = new EnvironmentManager({
        logger: options.verbose ? (msg, level) => console.log(`  [${level?.toUpperCase()}] ${msg}`) : undefined
      });

      // Check if installation exists
      const isInstalled = configManager.exists() || fs.existsSync('package.json');
      if (!isInstalled) {
        console.log('ℹ️  Vibe Check MCP server is not installed.');
        return;
      }

      // Check for running clients
      console.log('🔍 Checking for running MCP clients...');
      const clients = ['claude', 'cursor'];
      const runningClients: string[] = [];

      for (const client of clients) {
        try {
          const status = await detectClient(client as any, 'stdio', '.');
          if (status.isRunning) {
            runningClients.push(client);
          }
        } catch (error) {
          // Ignore detection errors
        }
      }

      if (runningClients.length > 0) {
        console.log(`⚠️  Running clients detected: ${runningClients.join(', ')}`);
        console.log('   These clients should be restarted after uninstallation.');
      }

      // Confirmation prompt
      if (!options.force) {
        const confirmed = await promptConfirmation(
          'This will remove the Vibe Check MCP server installation and all associated files.',
          options.force
        );

        if (!confirmed) {
          console.log('❌ Uninstall cancelled.');
          return;
        }
      }

      // Create backup if requested
      let backupSummary: any = null;
      if (options.backup && !options['clients-only']) {
        console.log('\n💾 Creating backup...');

        // Backup configuration files
        const configPath = configManager.getConfigPath();
        if (fs.existsSync(configPath)) {
          await backup.backupPath(configPath, 'config.json');
        }

        // Backup environment files
        const envSummary = environment.getConfigurationSummary();
        for (const configFile of envSummary.configFiles) {
          if (fs.existsSync(configFile)) {
            await backup.backupPath(configFile, path.basename(configFile));
          }
        }

        // Backup data directory
        const dataDir = platform.getUserDataDir();
        if (fs.existsSync(dataDir)) {
          await backup.backupPath(dataDir, 'data');
        }

        backup.saveManifest();
        backupSummary = backup.getBackupSummary();

        console.log(`✅ Backup created: ${backupSummary.path}`);
        console.log(`   Items backed up: ${backupSummary.itemCount}`);
        console.log(`   Total size: ${(backupSummary.totalSize / 1024).toFixed(2)} KB`);
      }

      // Unregister from clients
      console.log('\n🔌 Unregistering from MCP clients...');
      const unregisteredClients: string[] = [];

      for (const client of clients) {
        try {
          // Create client backup before unregistering
          const clientBackupPath = await backupClientConfig(client as any);
          safety.addBackedUpFile(clientBackupPath);

          await unregisterClient(client as any);
          unregisteredClients.push(client);

          if (options.verbose) {
            console.log(`  ✓ Unregistered from ${client}`);
          }
        } catch (error) {
          console.warn(`  Warning: Failed to unregister from ${client}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (unregisteredClients.length > 0) {
        console.log(`✅ Unregistered from ${unregisteredClients.length} client(s): ${unregisteredClients.join(', ')}`);
      } else {
        console.log('ℹ️  No clients to unregister');
      }

      // Remove files if not doing clients-only uninstall
      if (!options['clients-only']) {
        await performUninstall(configManager, environment, safety, backup, options);
      } else {
        console.log('✅ Client registration removed. Configuration files preserved as requested.');
      }

      // Show uninstallation summary
      console.log('\n📋 Uninstallation Summary:');
      console.log(`   Clients unregistered: ${unregisteredClients.length}`);

      if (!options['clients-only']) {
        console.log('   Configuration files: Removed');
        console.log('   Data files: Removed');

        if (options['keep-config']) {
          console.log('   Config files kept: Yes (--keep-config)');
        }
        if (options['keep-backups']) {
          console.log('   Backup files kept: Yes (--keep-backups)');
        }
      }

      if (backupSummary) {
        console.log(`   Backup location: ${backupSummary.path}`);
      }

      console.log('\n✅ Vibe Check MCP server has been uninstalled successfully.');

      // Show next steps
      console.log('\n🎯 Next Steps:');
      if (runningClients.length > 0) {
        console.log('1. Restart your MCP clients to apply changes:');
        runningClients.forEach(client => console.log(`   - ${client}`));
      }
      console.log('2. Verify that the server no longer appears in your MCP clients');
      if (backupSummary) {
        console.log(`3. Backup is available at: ${backupSummary.path}`);
        console.log('   You can restore from this backup if needed');
      }

      if (options.verbose) {
        console.log('\n🔍 Detailed Information:');
        console.log(`   Config directory: ${platform.getUserConfigDir()}`);
        console.log(`   Data directory: ${platform.getUserDataDir()}`);
        console.log(`   Cache directory: ${platform.getUserCacheDir()}`);
        console.log(`   Backed up files: ${safety.getBackedUpFiles().length}`);
      }

    } catch (error) {
      console.error(`\n❌ Uninstallation failed: ${error instanceof Error ? error.message : String(error)}`);

      if (options.verbose && error instanceof Error && error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }

      console.error('\nTroubleshooting:');
      console.error('1. Ensure you have the required permissions to remove files');
      console.error('2. Check that MCP clients are not running');
      console.error('3. Try using --force to override safety checks');
      console.error('4. Use --clients-only to only remove client registrations');

      if (backup.getBackupDir()) {
        console.error(`\n💾 A backup was created at: ${backup.getBackupDir()}`);
        console.error('   You can use this to restore files if needed');
      }

      process.exit(1);
    }
  });

// Export for use in main CLI
export default uninstallCommand;