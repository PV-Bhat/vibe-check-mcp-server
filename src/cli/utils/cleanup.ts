/**
 * Cleanup utilities for handling interrupted installations and maintaining system hygiene
 */

import * as fs from 'fs';
import * as path from 'path';
import { platform } from './platform.js';
import { MessageFormatter } from './messaging.js';

/**
 * Cleanup operation types
 */
export enum CleanupType {
  INSTALLATION = 'installation',
  TEMPORARY = 'temporary',
  CACHE = 'cache',
  LOGS = 'logs',
  BACKUPS = 'backups',
  ALL = 'all'
}

/**
 * Cleanup operation result
 */
export interface CleanupResult {
  type: CleanupType;
  success: boolean;
  itemsRemoved: string[];
  errors: string[];
  spaceFreed?: number; // in bytes
}

/**
 * Cleanup manager for handling various cleanup scenarios
 */
export class CleanupManager {
  private projectRoot: string;
  private verbose: boolean;

  constructor(options: {
    projectRoot?: string;
    verbose?: boolean;
  } = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.verbose = options.verbose || false;
  }

  /**
   * Detect and clean up interrupted installations
   */
  async cleanupInterruptedInstallation(): Promise<CleanupResult> {
    MessageFormatter.progress('Installation Cleanup', 'Detecting and cleaning up interrupted installations...');

    const result: CleanupResult = {
      type: CleanupType.INSTALLATION,
      success: true,
      itemsRemoved: [],
      errors: []
    };

    try {
      // Check for common interruption markers
      const interruptionMarkers = [
        '.install-in-progress',
        '.install-lock',
        '.npm-installing',
        'install.tmp',
        '.build-in-progress'
      ];

      for (const marker of interruptionMarkers) {
        const markerPath = path.join(this.projectRoot, marker);
        if (fs.existsSync(markerPath)) {
          try {
            if (fs.statSync(markerPath).isDirectory()) {
              fs.rmSync(markerPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(markerPath);
            }
            result.itemsRemoved.push(markerPath);

            if (this.verbose) {
              MessageFormatter.info('Removed Interruption Marker', `Cleaned up: ${markerPath}`);
            }
          } catch (error) {
            const errorMsg = `Failed to remove ${markerPath}: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMsg);
            result.success = false;
          }
        }
      }

      // Check for partial build directories
      const partialBuildPath = path.join(this.projectRoot, 'build');
      if (fs.existsSync(partialBuildPath)) {
        try {
          const indexPath = path.join(partialBuildPath, 'index.js');
          if (!fs.existsSync(indexPath)) {
            // Incomplete build
            fs.rmSync(partialBuildPath, { recursive: true, force: true });
            result.itemsRemoved.push(partialBuildPath);

            if (this.verbose) {
              MessageFormatter.info('Removed Partial Build', 'Incomplete build directory cleaned up');
            }
          }
        } catch (error) {
          const errorMsg = `Failed to clean partial build: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
        }
      }

      // Check for temporary installation files
      const tempDirs = [
        path.join(this.projectRoot, 'tmp'),
        path.join(this.projectRoot, '.tmp'),
        path.join(platform.getTempDir(), 'vibe-check-install-*')
      ];

      for (const tempDir of tempDirs) {
        if (tempDir.includes('*')) {
          // Handle glob patterns for temp directories
          try {
            const parentDir = path.dirname(tempDir);
            const pattern = path.basename(tempDir);

            if (fs.existsSync(parentDir)) {
              const items = fs.readdirSync(parentDir);
              for (const item of items) {
                if (item.startsWith(pattern.replace('*', ''))) {
                  const itemPath = path.join(parentDir, item);
                  try {
                    const stats = fs.statSync(itemPath);
                    if (stats.isDirectory()) {
                      fs.rmSync(itemPath, { recursive: true, force: true });
                    } else {
                      fs.unlinkSync(itemPath);
                    }
                    result.itemsRemoved.push(itemPath);
                  } catch (error) {
                    const errorMsg = `Failed to remove temp item ${itemPath}: ${error instanceof Error ? error.message : String(error)}`;
                    result.errors.push(errorMsg);
                  }
                }
              }
            }
          } catch (error) {
            // Continue if temp directory doesn't exist
          }
        } else if (fs.existsSync(tempDir)) {
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
            result.itemsRemoved.push(tempDir);

            if (this.verbose) {
              MessageFormatter.info('Removed Temporary Directory', `Cleaned up: ${tempDir}`);
            }
          } catch (error) {
            const errorMsg = `Failed to remove temp directory ${tempDir}: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMsg);
            result.success = false;
          }
        }
      }

      if (result.itemsRemoved.length > 0) {
        MessageFormatter.success('Installation Cleanup Complete',
          `Removed ${result.itemsRemoved.length} interruption markers and temporary files`);
      } else {
        MessageFormatter.info('Installation Cleanup', 'No interruption markers found');
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      MessageFormatter.error('Installation Cleanup Failed', result.errors.join('; '));
    }

    return result;
  }

  /**
   * Clean up cache files
   */
  async cleanupCache(): Promise<CleanupResult> {
    MessageFormatter.progress('Cache Cleanup', 'Cleaning up cache files...');

    const result: CleanupResult = {
      type: CleanupType.CACHE,
      success: true,
      itemsRemoved: [],
      errors: []
    };

    try {
      const cacheDirs = [
        platform.getUserCacheDir(),
        path.join(this.projectRoot, '.cache'),
        path.join(this.projectRoot, 'node_modules', '.cache')
      ];

      let totalSpaceFreed = 0;

      for (const cacheDir of cacheDirs) {
        if (fs.existsSync(cacheDir)) {
          try {
            const spaceBefore = this.getDirectorySize(cacheDir);

            // Remove old cache files (older than 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            this.removeOldFiles(cacheDir, sevenDaysAgo, result);

            const spaceAfter = this.getDirectorySize(cacheDir);
            const spaceFreed = spaceBefore - spaceAfter;
            totalSpaceFreed += spaceFreed;

            if (this.verbose && spaceFreed > 0) {
              MessageFormatter.info('Cache Cleaned',
                `Freed ${(spaceFreed / 1024 / 1024).toFixed(2)} MB from ${cacheDir}`);
            }
          } catch (error) {
            const errorMsg = `Failed to clean cache ${cacheDir}: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMsg);
          }
        }
      }

      result.spaceFreed = totalSpaceFreed;

      if (totalSpaceFreed > 0) {
        MessageFormatter.success('Cache Cleanup Complete',
          `Freed ${(totalSpaceFreed / 1024 / 1024).toFixed(2)} MB of cache space`);
      } else {
        MessageFormatter.info('Cache Cleanup', 'No old cache files to remove');
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Cache cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      MessageFormatter.error('Cache Cleanup Failed', result.errors.join('; '));
    }

    return result;
  }

  /**
   * Clean up old log files
   */
  async cleanupLogs(): Promise<CleanupResult> {
    MessageFormatter.progress('Log Cleanup', 'Cleaning up old log files...');

    const result: CleanupResult = {
      type: CleanupType.LOGS,
      success: true,
      itemsRemoved: [],
      errors: []
    };

    try {
      const logDirs = [
        path.join(this.projectRoot, 'logs'),
        path.join(platform.getUserDataDir(), 'logs'),
        platform.getLogDir()
      ];

      let totalSpaceFreed = 0;

      for (const logDir of logDirs) {
        if (fs.existsSync(logDir)) {
          try {
            const spaceBefore = this.getDirectorySize(logDir);

            // Remove log files older than 30 days
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            this.removeOldFiles(logDir, thirtyDaysAgo, result);

            const spaceAfter = this.getDirectorySize(logDir);
            const spaceFreed = spaceBefore - spaceAfter;
            totalSpaceFreed += spaceFreed;

            if (this.verbose && spaceFreed > 0) {
              MessageFormatter.info('Logs Cleaned',
                `Freed ${(spaceFreed / 1024 / 1024).toFixed(2)} MB from ${logDir}`);
            }
          } catch (error) {
            const errorMsg = `Failed to clean logs ${logDir}: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMsg);
          }
        }
      }

      result.spaceFreed = totalSpaceFreed;

      if (totalSpaceFreed > 0) {
        MessageFormatter.success('Log Cleanup Complete',
          `Freed ${(totalSpaceFreed / 1024 / 1024).toFixed(2)} MB of log space`);
      } else {
        MessageFormatter.info('Log Cleanup', 'No old log files to remove');
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Log cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      MessageFormatter.error('Log Cleanup Failed', result.errors.join('; '));
    }

    return result;
  }

  /**
   * Clean up old backup files
   */
  async cleanupBackups(maxBackups: number = 5): Promise<CleanupResult> {
    MessageFormatter.progress('Backup Cleanup', `Cleaning up old backups (keeping latest ${maxBackups})...`);

    const result: CleanupResult = {
      type: CleanupType.BACKUPS,
      success: true,
      itemsRemoved: [],
      errors: []
    };

    try {
      const configDir = platform.getUserConfigDir();
      if (fs.existsSync(configDir)) {
        const items = fs.readdirSync(configDir);
        const backupFiles = items
          .filter(item => item.includes('.bak.') || item.includes('.backup.'))
          .map(item => ({
            name: item,
            path: path.join(configDir, item),
            time: fs.statSync(path.join(configDir, item)).mtime.getTime()
          }))
          .sort((a, b) => b.time - a.time); // Sort by time, newest first

        if (backupFiles.length > maxBackups) {
          const filesToRemove = backupFiles.slice(maxBackups);

          for (const file of filesToRemove) {
            try {
              fs.unlinkSync(file.path);
              result.itemsRemoved.push(file.path);

              if (this.verbose) {
                MessageFormatter.info('Removed Old Backup', `Deleted: ${file.name}`);
              }
            } catch (error) {
              const errorMsg = `Failed to remove backup ${file.path}: ${error instanceof Error ? error.message : String(error)}`;
              result.errors.push(errorMsg);
            }
          }
        }

        if (result.itemsRemoved.length > 0) {
          MessageFormatter.success('Backup Cleanup Complete',
            `Removed ${result.itemsRemoved.length} old backup files`);
        } else {
          MessageFormatter.info('Backup Cleanup', 'No old backups to remove');
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Backup cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      MessageFormatter.error('Backup Cleanup Failed', result.errors.join('; '));
    }

    return result;
  }

  /**
   * Perform comprehensive cleanup
   */
  async cleanupAll(): Promise<CleanupResult[]> {
    MessageFormatter.info('Comprehensive Cleanup', 'Starting comprehensive system cleanup...');

    const results: CleanupResult[] = [];

    try {
      // Clean up interrupted installations first
      results.push(await this.cleanupInterruptedInstallation());

      // Clean up temporary files
      results.push(await this.cleanupTemporary());

      // Clean up cache
      results.push(await this.cleanupCache());

      // Clean up logs
      results.push(await this.cleanupLogs());

      // Clean up old backups
      results.push(await this.cleanupBackups());

      const totalItemsRemoved = results.reduce((sum, result) => sum + result.itemsRemoved.length, 0);
      const totalSpaceFreed = results.reduce((sum, result) => sum + (result.spaceFreed || 0), 0);
      const totalErrors = results.reduce((sum, result) => sum + result.errors.length, 0);

      if (totalErrors === 0) {
        MessageFormatter.success('Comprehensive Cleanup Complete', [
          `Removed ${totalItemsRemoved} files and directories`,
          `Freed ${(totalSpaceFreed / 1024 / 1024).toFixed(2)} MB of disk space`
        ]);
      } else {
        MessageFormatter.warning('Cleanup Completed with Errors', [
          `Removed ${totalItemsRemoved} files and directories`,
          `Freed ${(totalSpaceFreed / 1024 / 1024).toFixed(2)} MB of disk space`,
          `${totalErrors} errors encountered - see details above`
        ]);
      }

    } catch (error) {
      MessageFormatter.error('Comprehensive Cleanup Failed',
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return results;
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTemporary(): Promise<CleanupResult> {
    MessageFormatter.progress('Temporary Files Cleanup', 'Cleaning up temporary files...');

    const result: CleanupResult = {
      type: CleanupType.TEMPORARY,
      success: true,
      itemsRemoved: [],
      errors: []
    };

    try {
      const tempDirs = [
        path.join(this.projectRoot, 'tmp'),
        path.join(this.projectRoot, '.tmp'),
        path.join(platform.getTempDir(), 'vibe-check-*'),
        path.join(this.projectRoot, '.temp')
      ];

      for (const tempDir of tempDirs) {
        if (tempDir.includes('*')) {
          // Handle glob patterns
          try {
            const parentDir = path.dirname(tempDir);
            const pattern = path.basename(tempDir);

            if (fs.existsSync(parentDir)) {
              const items = fs.readdirSync(parentDir);
              for (const item of items) {
                if (item.startsWith(pattern.replace('*', ''))) {
                  const itemPath = path.join(parentDir, item);
                  try {
                    const stats = fs.statSync(itemPath);
                    const isOld = Date.now() - stats.mtime.getTime() > 24 * 60 * 60 * 1000; // 24 hours

                    if (isOld) {
                      if (stats.isDirectory()) {
                        fs.rmSync(itemPath, { recursive: true, force: true });
                      } else {
                        fs.unlinkSync(itemPath);
                      }
                      result.itemsRemoved.push(itemPath);
                    }
                  } catch (error) {
                    const errorMsg = `Failed to remove temp item ${itemPath}: ${error instanceof Error ? error.message : String(error)}`;
                    result.errors.push(errorMsg);
                  }
                }
              }
            }
          } catch (error) {
            // Continue if temp directory doesn't exist
          }
        } else if (fs.existsSync(tempDir)) {
          try {
            const stats = fs.statSync(tempDir);
            const isOld = Date.now() - stats.mtime.getTime() > 24 * 60 * 60 * 1000; // 24 hours

            if (isOld) {
              fs.rmSync(tempDir, { recursive: true, force: true });
              result.itemsRemoved.push(tempDir);
            }
          } catch (error) {
            const errorMsg = `Failed to remove temp directory ${tempDir}: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMsg);
            result.success = false;
          }
        }
      }

      if (result.itemsRemoved.length > 0) {
        MessageFormatter.success('Temporary Files Cleanup Complete',
          `Removed ${result.itemsRemoved.length} temporary files/directories`);
      } else {
        MessageFormatter.info('Temporary Files Cleanup', 'No old temporary files to remove');
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Temporary files cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      MessageFormatter.error('Temporary Files Cleanup Failed', result.errors.join('; '));
    }

    return result;
  }

  /**
   * Remove files older than specified time
   */
  private removeOldFiles(dir: string, cutoffTime: number, result: CleanupResult): void {
    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);

        try {
          const stats = fs.statSync(itemPath);

          if (stats.mtime.getTime() < cutoffTime) {
            if (stats.isDirectory()) {
              fs.rmSync(itemPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(itemPath);
            }
            result.itemsRemoved.push(itemPath);
          }
        } catch (error) {
          const errorMsg = `Failed to remove old file ${itemPath}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to process directory ${dir}: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
    }
  }

  /**
   * Get directory size in bytes
   */
  private getDirectorySize(dirPath: string): number {
    let totalSize = 0;

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);

        try {
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            totalSize += this.getDirectorySize(itemPath);
          } else {
            totalSize += stats.size;
          }
        } catch (error) {
          // Skip files that can't be accessed
        }
      }
    } catch (error) {
      // Return 0 if directory can't be accessed
    }

    return totalSize;
  }
}

// Export singleton instance for easy usage
export const cleanupManager = new CleanupManager();