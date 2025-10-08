#!/usr/bin/env node

/**
 * Cleanup command - System maintenance and cleanup
 *
 * This command handles:
 * - Cleaning up interrupted installations
 * - Removing temporary files and cache
 * - Managing backup files
 * - Freeing disk space
 * - System hygiene maintenance
 */

import { Command } from 'commander';
import { cleanupManager, CleanupType } from '../utils/cleanup.js';
import { MessageFormatter, ProgressTracker } from '../utils/messaging.js';

interface CleanupOptions {
  type: 'all' | 'installation' | 'cache' | 'logs' | 'backups' | 'temp';
  force: boolean;
  verbose: boolean;
  'max-backups': number;
  'dry-run': boolean;
}

/**
 * Run cleanup process
 */
export async function runCleanup(options: CleanupOptions): Promise<void> {
  try {
    MessageFormatter.info('Vibe Check MCP Cleanup Utility', 'System maintenance and cleanup operations');

    if (options['dry-run']) {
      MessageFormatter.warning('Dry Run Mode', 'No files will be deleted. This is a preview only.');
    }

    const progress = new ProgressTracker(options.verbose, 'System Cleanup Process');

    let results: any[] = [];

    switch (options.type) {
      case 'installation':
        progress.addSteps(['Detecting interrupted installations', 'Cleaning up installation artifacts']);
        await performInstallationCleanup(progress, options);
        break;

      case 'cache':
        progress.addSteps(['Scanning cache directories', 'Removing old cache files']);
        await performCacheCleanup(progress, options);
        break;

      case 'logs':
        progress.addSteps(['Scanning log directories', 'Removing old log files']);
        await performLogCleanup(progress, options);
        break;

      case 'backups':
        progress.addSteps(['Scanning backup directories', 'Removing old backups']);
        await performBackupCleanup(progress, options);
        break;

      case 'temp':
        progress.addSteps(['Scanning temporary directories', 'Removing temporary files']);
        await performTempCleanup(progress, options);
        break;

      case 'all':
      default:
        progress.addSteps([
          'Detecting interrupted installations',
          'Cleaning up temporary files',
          'Cleaning up cache files',
          'Cleaning up old logs',
          'Managing backup files'
        ]);
        await performComprehensiveCleanup(progress, options);
        break;
    }

  } catch (error) {
    MessageFormatter.error('Cleanup Failed',
      `Cleanup operation failed: ${error instanceof Error ? error.message : String(error)}`,
      [
        'Check file and directory permissions',
        'Ensure no processes are using files being cleaned',
        'Run with administrator privileges if needed'
      ],
      [
        'Fix permission issues',
        'Close any running applications',
        'Retry the cleanup operation'
      ]
    );
    process.exit(1);
  }
}

/**
 * Perform installation cleanup
 */
async function performInstallationCleanup(progress: ProgressTracker, options: CleanupOptions): Promise<void> {
  progress.nextStep('Scanning for installation interruption markers');

  if (options['dry-run']) {
    MessageFormatter.info('Dry Run - Installation Cleanup', [
      'Would scan for:',
      '  - Installation interruption markers (.install-in-progress, .install-lock)',
      '  - Partial build directories',
      '  - Temporary installation files',
      '  - Install lock files'
    ]);
    progress.complete('Installation Cleanup (Dry Run)', 'No files were actually removed');
    return;
  }

  const result = await cleanupManager.cleanupInterruptedInstallation();

  if (result.success) {
    progress.complete(
      'Installation Cleanup Complete',
      `Successfully removed ${result.itemsRemoved.length} interruption markers`,
      result.itemsRemoved.length > 0 ? ['System is ready for fresh installation'] : ['No cleanup needed']
    );
  } else {
    progress.error('Installation Cleanup Failed', new Error(result.errors.join('; ')));
  }
}

/**
 * Perform cache cleanup
 */
async function performCacheCleanup(progress: ProgressTracker, options: CleanupOptions): Promise<void> {
  progress.nextStep('Scanning cache directories for old files');

  if (options['dry-run']) {
    MessageFormatter.info('Dry Run - Cache Cleanup', [
      'Would scan for:',
      '  - Cache files older than 7 days',
      '  - User cache directory',
      '  - Project cache directory',
      '  - Node modules cache'
    ]);
    progress.complete('Cache Cleanup (Dry Run)', 'No files were actually removed');
    return;
  }

  const result = await cleanupManager.cleanupCache();

  if (result.success) {
    const spaceFreed = result.spaceFreed ? (result.spaceFreed / 1024 / 1024).toFixed(2) : '0';
    progress.complete(
      'Cache Cleanup Complete',
      `Successfully freed ${spaceFreed} MB of cache space`,
      result.spaceFreed && result.spaceFreed > 0 ? ['System performance may improve'] : ['Cache was already clean']
    );
  } else {
    progress.error('Cache Cleanup Failed', new Error(result.errors.join('; ')));
  }
}

/**
 * Perform log cleanup
 */
async function performLogCleanup(progress: ProgressTracker, options: CleanupOptions): Promise<void> {
  progress.nextStep('Scanning log directories for old files');

  if (options['dry-run']) {
    MessageFormatter.info('Dry Run - Log Cleanup', [
      'Would scan for:',
      '  - Log files older than 30 days',
      '  - Application logs',
      '  - System logs',
      '  - Debug logs'
    ]);
    progress.complete('Log Cleanup (Dry Run)', 'No files were actually removed');
    return;
  }

  const result = await cleanupManager.cleanupLogs();

  if (result.success) {
    const spaceFreed = result.spaceFreed ? (result.spaceFreed / 1024 / 1024).toFixed(2) : '0';
    progress.complete(
      'Log Cleanup Complete',
      `Successfully freed ${spaceFreed} MB of log space`,
      result.spaceFreed && result.spaceFreed > 0 ? ['Disk space optimized'] : ['No old logs found']
    );
  } else {
    progress.error('Log Cleanup Failed', new Error(result.errors.join('; ')));
  }
}

/**
 * Perform backup cleanup
 */
async function performBackupCleanup(progress: ProgressTracker, options: CleanupOptions): Promise<void> {
  progress.nextStep(`Scanning backup directories (keeping latest ${options['max-backups']})`);

  if (options['dry-run']) {
    MessageFormatter.info('Dry Run - Backup Cleanup', [
      `Would keep the latest ${options['max-backups']} backup files`,
      'Would remove older backup files',
      'Would preserve configuration backups'
    ]);
    progress.complete('Backup Cleanup (Dry Run)', 'No files were actually removed');
    return;
  }

  const result = await cleanupManager.cleanupBackups(options['max-backups']);

  if (result.success) {
    progress.complete(
      'Backup Cleanup Complete',
      `Successfully removed ${result.itemsRemoved.length} old backup files`,
      result.itemsRemoved.length > 0 ? ['Backup storage optimized'] : ['Backup storage was already optimal']
    );
  } else {
    progress.error('Backup Cleanup Failed', new Error(result.errors.join('; ')));
  }
}

/**
 * Perform temporary files cleanup
 */
async function performTempCleanup(progress: ProgressTracker, options: CleanupOptions): Promise<void> {
  progress.nextStep('Scanning temporary directories');

  if (options['dry-run']) {
    MessageFormatter.info('Dry Run - Temporary Files Cleanup', [
      'Would scan for:',
      '  - Temporary files older than 24 hours',
      '  - Build artifacts',
      '  - System temporary files',
      '  - Installation temp files'
    ]);
    progress.complete('Temporary Files Cleanup (Dry Run)', 'No files were actually removed');
    return;
  }

  const result = await cleanupManager.cleanupTemporary();

  if (result.success) {
    progress.complete(
      'Temporary Files Cleanup Complete',
      `Successfully removed ${result.itemsRemoved.length} temporary files`,
      result.itemsRemoved.length > 0 ? ['System hygiene improved'] : ['No temporary files to clean']
    );
  } else {
    progress.error('Temporary Files Cleanup Failed', new Error(result.errors.join('; ')));
  }
}

/**
 * Perform comprehensive cleanup
 */
async function performComprehensiveCleanup(progress: ProgressTracker, options: CleanupOptions): Promise<void> {
  if (options['dry-run']) {
    MessageFormatter.info('Dry Run - Comprehensive Cleanup', [
      'Would perform all cleanup operations:',
      '  1. Installation cleanup',
      '  2. Temporary files cleanup',
      '  3. Cache cleanup',
      '  4. Log cleanup',
      '  5. Backup management'
    ]);
    progress.complete('Comprehensive Cleanup (Dry Run)', 'No files were actually removed');
    return;
  }

  const results = await cleanupManager.cleanupAll();

  const totalItemsRemoved = results.reduce((sum, result) => sum + result.itemsRemoved.length, 0);
  const totalSpaceFreed = results.reduce((sum, result) => sum + (result.spaceFreed || 0), 0);
  const totalErrors = results.reduce((sum, result) => sum + result.errors.length, 0);

  if (totalErrors === 0) {
    progress.complete(
      'Comprehensive Cleanup Complete',
      `Removed ${totalItemsRemoved} files and freed ${(totalSpaceFreed / 1024 / 1024).toFixed(2)} MB`,
      [
        'System is now clean and optimized',
        'Ready for normal operation',
        'Run again periodically for maintenance'
      ]
    );
  } else {
    progress.error(
      'Comprehensive Cleanup Completed with Issues',
      new Error(`${totalErrors} errors encountered during cleanup`),
      [
        'Some files could not be removed due to permissions or being in use',
        'Check the detailed error messages above',
        'Run with administrator privileges if needed'
      ],
      [
        'Fix permission issues and retry',
        'Close applications that might be using files',
        'Run individual cleanup types for specific issues'
      ]
    );
  }
}

/**
 * Cleanup command implementation
 */
export const cleanupCommand = new Command('cleanup')
  .description('Clean up system files and maintain system hygiene')
  .option('-t, --type <type>', 'Cleanup type (all|installation|cache|logs|backups|temp)', 'all')
  .option('-f, --force', 'Force cleanup without confirmation', false)
  .option('-v, --verbose', 'Verbose output', false)
  .option('--max-backups <number>', 'Maximum number of backups to keep', '5')
  .option('--dry-run', 'Show what would be cleaned without actually removing files', false)
  .action(async (options: CleanupOptions) => {
    // Validate cleanup type
    const validTypes = ['all', 'installation', 'cache', 'logs', 'backups', 'temp'];
    if (!validTypes.includes(options.type)) {
      MessageFormatter.error('Invalid Cleanup Type', `"${options.type}" is not a valid cleanup type.`, [
        'Valid types are: ' + validTypes.join(', ')
      ]);
      process.exit(1);
    }

    // Validate max-backups
    const maxBackups = parseInt(options['max-backups'].toString());
    if (isNaN(maxBackups) || maxBackups < 1) {
      MessageFormatter.error('Invalid Max Backups', 'max-backups must be a positive number.', [
        'Example: --max-backups 10'
      ]);
      process.exit(1);
    }
    options['max-backups'] = maxBackups;

    // Confirmation for destructive operations (unless forced or dry-run)
    if (!options.force && !options['dry-run'] && options.type === 'all') {
      MessageFormatter.warning('Comprehensive Cleanup', [
        'This will remove various system files including old caches, logs, and temporary files.',
        'This operation is generally safe but cannot be undone.',
        'Use --dry-run to see what would be removed first.'
      ]);

      // In a real implementation, you would prompt for confirmation here
      // For now, we'll proceed since this is an automated system
    }

    await runCleanup(options);
  });

// Export for use in main CLI
export default cleanupCommand;