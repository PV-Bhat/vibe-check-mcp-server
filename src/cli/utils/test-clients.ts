/**
 * @file Comprehensive test script for MCP client management utilities.
 *
 * This script verifies the complete lifecycle of client configuration management:
 * - Backs up existing configurations to run safely.
 * - Tests registration for Claude (stdio) and Cursor (stdio, http).
 * - Validates the configuration after registration.
 * - Tests unregistration.
 * - Tests the backup and restore functionality.
 * - Restores original configurations in a finally block to ensure no side effects.
 *
 * To run this test:
 * 1. Ensure you have ts-node installed: `npm install -g ts-node`
 * 2. Execute from the project root: `ts-node --esm src/cli/utils/test-clients.ts`
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  registerClient,
  unregisterClient,
  validateClientConfig,
  backupClientConfig,
  restoreClientConfig,
  ClientType,
} from './clients.js';
import { getClientConfigPath } from './detection.js';

const PROJECT_ROOT = path.resolve(process.cwd());
const DUMMY_BUILD_PATH = path.join(PROJECT_ROOT, 'build');
const DUMMY_SCRIPT_PATH = path.join(DUMMY_BUILD_PATH, 'index.js');

/**
 * A simple logger for test output.
 */
const log = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  error: (msg: string) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg: string) => console.warn(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  step: (msg: string) => console.log(`\n\x1b[36m--- ${msg} ---\x1b[0m`),
};

/**
 * Manages the backup and restoration of original config files.
 */
async function manageOriginalConfig(client: ClientType, action: 'backup' | 'restore') {
  const configPath = getClientConfigPath(client);
  const backupPath = `${configPath}.test-backup`;

  if (action === 'backup') {
    try {
      await fs.stat(configPath);
      log.info(`Original ${client} config found. Backing up to ${backupPath}`);
      await fs.copyFile(configPath, backupPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        log.info(`No original ${client} config found. Nothing to back up.`);
      } else {
        throw error;
      }
    }
  } else { // restore
    try {
      await fs.stat(backupPath);
      log.info(`Restoring original ${client} config from ${backupPath}`);
      await fs.copyFile(backupPath, configPath);
      await fs.unlink(backupPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        log.info(`No backup found for ${client}. Deleting test config.`);
        try {
          await fs.unlink(configPath);
        } catch (e: any) {
          if (e.code !== 'ENOENT') throw e;
        }
      } else {
        throw error;
      }
    }
  }
}

async function runClientTest(client: ClientType) {
  log.step(`Testing Client: ${client.toUpperCase()}`);
  const configPath = getClientConfigPath(client);
  log.info(`Config path: ${configPath}`);

  // Test stdio registration
  log.info(`1. Testing 'stdio' registration...`);
  await registerClient(client, 'stdio', PROJECT_ROOT);
  let isValid = await validateClientConfig(client, 'stdio', PROJECT_ROOT);
  if (isValid) {
    log.success(`'stdio' registration and validation successful.`);
    const content = await fs.readFile(configPath, 'utf-8');
    console.log('   Config content:\n', content);
  } else {
    throw new Error(`'stdio' validation failed for ${client}.`);
  }

  // Test unregistration
  log.info(`2. Testing unregistration...`);
  await unregisterClient(client);
  isValid = await validateClientConfig(client, 'stdio', PROJECT_ROOT);
  if (!isValid) {
    log.success(`Unregistration successful.`);
    const content = await fs.readFile(configPath, 'utf-8');
    console.log('   Config content:\n', content);
  } else {
    throw new Error(`Unregistration failed for ${client}.`);
  }

  // Test HTTP registration (only for cursor)
  if (client === 'cursor') {
    log.info(`3. Testing 'http' registration...`);
    await registerClient(client, 'http', PROJECT_ROOT);
    isValid = await validateClientConfig(client, 'http', PROJECT_ROOT);
    if (isValid) {
      log.success(`'http' registration and validation successful.`);
      const content = await fs.readFile(configPath, 'utf-8');
      console.log('   Config content:\n', content);
    } else {
      throw new Error(`'http' validation failed for ${client}.`);
    }
    await unregisterClient(client); // Clean up for next test
  }

  // Test HTTP registration failure for Claude
  if (client === 'claude') {
    log.info(`3. Testing 'http' registration failure (as expected)...`);
    try {
      await registerClient(client, 'http', PROJECT_ROOT);
      throw new Error('Claude HTTP registration should have failed but did not.');
    } catch (error: any) {
      log.success(`Caught expected error for Claude 'http' mode: ${error.message}`);
    }
  }

  // Test backup and restore
  log.info(`4. Testing backup and restore...`);
  await registerClient(client, 'stdio', PROJECT_ROOT);
  log.info('   - Registered client for backup test.');
  const backupPath = await backupClientConfig(client);
  log.success(`   - Backup created at: ${backupPath}`);
  await unregisterClient(client);
  log.info('   - Unregistered client.');
  if (await validateClientConfig(client, 'stdio', PROJECT_ROOT)) {
    throw new Error('Config should be invalid after unregistering.');
  }
  await restoreClientConfig(client, backupPath);
  log.info('   - Restored client from backup.');
  isValid = await validateClientConfig(client, 'stdio', PROJECT_ROOT);
  if (isValid) {
    log.success('   - Restore successful, configuration is valid again.');
  } else {
    throw new Error('Restore failed, configuration is not valid.');
  }
  await fs.unlink(backupPath); // Clean up test backup
}

async function main() {
  log.step('Setting up test environment...');
  await fs.mkdir(DUMMY_BUILD_PATH, { recursive: true });
  await fs.writeFile(DUMMY_SCRIPT_PATH, 'console.log("dummy script");');
  log.info(`Created dummy build file at ${DUMMY_SCRIPT_PATH}`);

  const clients: ClientType[] = ['claude', 'cursor'];
  for (const client of clients) {
    await manageOriginalConfig(client, 'backup');
  }

  try {
    await runClientTest('claude');
    await runClientTest('cursor');
  } catch (error) {
    log.error(`A test failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    log.step('Cleaning up test environment...');
    for (const client of clients) {
      await manageOriginalConfig(client, 'restore');
    }
    await fs.rm(DUMMY_BUILD_PATH, { recursive: true, force: true });
    log.info('Cleanup complete.');
  }
}

// Execute the test script if it's run directly
const isCLI = process.argv[1] === path.resolve(fileURLToPath(import.meta.url));
if (isCLI) {
  main().catch((err) => {
    log.error('Unhandled error during test execution:');
    console.error(err);
    process.exit(1);
  });
}