/**
 * @file Manages MCP client configurations for Claude Desktop and Cursor IDE.
 *
 * This module provides utilities to programmatically register, unregister,
 * validate, and manage backups for MCP server configurations in supported
 * client applications. It handles OS-specific file paths and ensures
 * atomic file operations to prevent data corruption.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getClientConfigPath, detectClient } from './detection.js';

// --- Type Definitions ---

export type ClientType = 'claude' | 'cursor';
export type TransportMode = 'stdio' | 'http';

export const VIBE_CHECK_SERVER_NAME = 'vibe-check';

export interface ClaudeServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface ClaudeConfig {
  [key: string]: ClaudeServerConfig;
}

export interface CursorServerConfig {
  name: string;
  type: 'command' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface CursorConfig {
  'mcp.servers'?: CursorServerConfig[];
  [key: string]: any;
}

// --- Core File Operations ---

/**
 * Reads, modifies, and atomically writes a JSON file. Creates a backup beforehand.
 * @param filePath - The path to the JSON file.
 * @param modification - A function that receives the parsed JSON data and returns the modified data.
 * @throws {Error} If the file is not valid JSON or if file operations fail.
 */
async function modifyJsonFile(filePath: string, modification: (data: any) => any): Promise<void> {
  let originalContent = '{}';
  let fileExists = true;
  try {
    originalContent = await fs.readFile(filePath, 'utf-8');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      fileExists = false;
      // Ensure directory exists before writing
      await fs.mkdir(path.dirname(filePath), { recursive: true });
    } else {
      throw new Error(`Failed to read config file at ${filePath}: ${error.message}`);
    }
  }

  // Create a backup only if the file originally existed
  if (fileExists) {
    const backupPath = `${filePath}.bak.${Date.now()}`;
    await fs.writeFile(backupPath, originalContent);
    console.log(`Backup created at: ${backupPath}`);
  }

  let data: any;
  try {
    data = JSON.parse(originalContent);
  } catch (e) {
    throw new Error(`Invalid JSON in ${filePath}. Cannot apply modifications.`);
  }

  const modifiedData = modification(data);

  const tempPath = `${filePath}.tmp`;
  try {
    await fs.writeFile(tempPath, JSON.stringify(modifiedData, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  } catch (error: any) {
    // Attempt to clean up temp file on failure
    try {
      await fs.unlink(tempPath);
    } catch (cleanupError) {
      // Ignore cleanup error
    }
    throw new Error(`Failed to write updated config to ${filePath}: ${error.message}`);
  }
}

// --- Public API ---

/**
 * Registers the Vibe Check MCP server with a client application.
 * @param client - The client to register with ('claude' or 'cursor').
 * @param mode - The transport mode ('stdio' or 'http').
 * @param projectRoot - The absolute path to the vibe-check-mcp-server project root.
 */
export async function registerClient(client: ClientType, mode: TransportMode, projectRoot: string): Promise<void> {
  const status = await detectClient(client, mode, projectRoot);
  if (status.isRunning) {
    console.warn(`[!] ${client} appears to be running. A restart will be required for configuration changes to take effect.`);
  }

  const configPath = getClientConfigPath(client);
  const serverScriptPath = path.resolve(projectRoot, 'build', 'index.js');

  dotenv.config({ path: path.join(projectRoot, '.env') });
  const apiKey = process.env.GEMINI_API_KEY;
  const env = apiKey ? { GEMINI_API_KEY: apiKey } : undefined;

  await modifyJsonFile(configPath, (config: ClaudeConfig | CursorConfig) => {
    console.log(`Registering Vibe Check for ${client} in ${mode} mode...`);

    if (client === 'claude') {
      if (mode === 'http') {
        throw new Error('Claude Desktop client only supports "stdio" transport mode.');
      }
      (config as ClaudeConfig)[VIBE_CHECK_SERVER_NAME] = {
        command: 'node',
        args: [serverScriptPath],
        env,
      };
    } else { // cursor
      const cursorConfig = config as CursorConfig;
      const servers = cursorConfig['mcp.servers']?.filter(s => s.name !== VIBE_CHECK_SERVER_NAME) || [];

      let newServerEntry: CursorServerConfig;
      if (mode === 'stdio') {
        newServerEntry = {
          name: VIBE_CHECK_SERVER_NAME,
          type: 'command',
          command: `node "${serverScriptPath}"`,
          env,
        };
      } else { // http
        const port = process.env.MCP_HTTP_PORT || process.env.PORT || 3000;
        newServerEntry = {
          name: VIBE_CHECK_SERVER_NAME,
          type: 'http',
          url: `http://localhost:${port}/mcp`,
        };
      }
      servers.push(newServerEntry);
      cursorConfig['mcp.servers'] = servers;
    }
    return config;
  });
  console.log(`Successfully registered Vibe Check with ${client}.`);
}

/**
 * Unregisters the Vibe Check MCP server from a client application.
 * @param client - The client to unregister from ('claude' or 'cursor').
 */
export async function unregisterClient(client: ClientType): Promise<void> {
  // We pass 'stdio' and a dummy projectRoot because mode/root don't affect the isRunning check.
  const status = await detectClient(client, 'stdio', '.');
  if (status.isRunning) {
    console.warn(`[!] ${client} appears to be running. A restart will be required for configuration changes to take effect.`);
  }

  const configPath = getClientConfigPath(client);

  await modifyJsonFile(configPath, (config: ClaudeConfig | CursorConfig) => {
    console.log(`Unregistering Vibe Check from ${client}...`);
    if (client === 'claude') {
      delete (config as ClaudeConfig)[VIBE_CHECK_SERVER_NAME];
    } else { // cursor
      const cursorConfig = config as CursorConfig;
      if (cursorConfig['mcp.servers']) {
        cursorConfig['mcp.servers'] = cursorConfig['mcp.servers'].filter(
          s => s.name !== VIBE_CHECK_SERVER_NAME
        );
      }
    }
    return config;
  });
  console.log(`Successfully unregistered Vibe Check from ${client}.`);
}

/**
 * Creates a backup of the client's configuration file.
 * @param client - The client whose configuration should be backed up.
 * @returns The path to the created backup file.
 */
export async function backupClientConfig(client: ClientType): Promise<string> {
  const configPath = getClientConfigPath(client);
  const backupPath = `${configPath}.bak.${Date.now()}`;

  try {
    await fs.copyFile(configPath, backupPath);
    console.log(`Backup for ${client} created at: ${backupPath}`);
    return backupPath;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Configuration file for ${client} not found at ${configPath}. Cannot create backup.`);
    }
    throw error;
  }
}

/**
 * Restores the most recent backup of a client's configuration file.
 * @param client - The client whose configuration should be restored.
 * @param backupPath - The specific backup file path to restore from.
 */
export async function restoreClientConfig(client: ClientType, backupPath: string): Promise<void> {
  const configPath = getClientConfigPath(client);

  try {
    await fs.copyFile(backupPath, configPath);
    console.log(`Restored ${client} configuration from: ${backupPath}`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Backup file not found at ${backupPath}. Cannot restore.`);
    }
    throw error;
  }
}

/**
 * Validates that the Vibe Check MCP server is correctly configured for a client.
 * @param client - The client to validate.
 * @param mode - The transport mode to validate against.
 * @param projectRoot - The project root to resolve server path for validation.
 * @returns True if the configuration is valid, false otherwise.
 */
export async function validateClientConfig(client: ClientType, mode: TransportMode, projectRoot: string): Promise<boolean> {
  try {
    const result = await detectClient(client, mode, projectRoot);
    return result.validation.isValid;
  } catch (error) {
    console.error(`Validation failed for ${client}:`, error);
    return false;
  }
}