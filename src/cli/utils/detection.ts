/**
 * @file Handles detection and validation of client applications like Claude Desktop and Cursor.
 *
 * This module provides utilities to discover client installations, check if they
 * are running, and validate their configuration files for compatibility with the
 * Vibe Check MCP server.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import psList from 'ps-list';
import { platform } from './platform.js';
import type { ClientType, TransportMode, ClaudeServerConfig, CursorServerConfig } from './clients.js';
import { VIBE_CHECK_SERVER_NAME } from './clients.js';

// --- Types and Constants ---

const CLIENT_PROCESS_NAMES: Record<ClientType, Partial<Record<NodeJS.Platform, string[]>>> = {
  claude: {
    darwin: ['Claude'],
    win32: ['Claude.exe'],
    linux: ['claude', 'claude-desktop'],
  },
  cursor: {
    darwin: ['Cursor'],
    win32: ['Cursor.exe'],
    linux: ['cursor', 'Cursor'], // AppImages can have different names
  },
};

export interface ValidationResult {
  isRegistered: boolean;
  isValid: boolean;
  details: string;
}

export interface ClientStatus {
  client: ClientType;
  isInstalled: boolean;
  isRunning: boolean;
  configPath: string;
  config?: Record<string, any>;
  validation: ValidationResult;
}

// --- Path Resolution ---

/**
 * Gets the absolute path to the configuration file for a given client with Windows compatibility.
 * @param client - The client type ('claude' or 'cursor').
 * @returns The absolute path to the configuration file.
 * @throws {Error} If the platform is unsupported.
 */
export function getClientConfigPath(client: ClientType): string {
  const homeDir = os.homedir();
  let configPath: string;

  switch (process.platform) {
    case 'darwin': // macOS
      if (client === 'claude') {
        configPath = path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      } else {
        configPath = path.join(homeDir, '.cursor', 'settings.json');
      }
      break;

    case 'win32': // Windows
      if (client === 'claude') {
        const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
        configPath = path.join(appData, 'Claude', 'claude_desktop_config.json');
      } else {
        configPath = path.join(homeDir, '.cursor', 'settings.json');
      }
      break;

    case 'linux':
      if (client === 'claude') {
        configPath = path.join(homeDir, '.config', 'claude', 'claude_desktop_config.json');
      } else {
        configPath = path.join(homeDir, '.cursor', 'settings.json');
      }
      break;

    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }

  // Validate and fix Windows path compatibility
  if (platform.isWindows) {
    const pathValidation = platform.validateWindowsPath(configPath);
    if (!pathValidation.valid) {
      throw new Error(`Invalid configuration path for Windows: ${pathValidation.issues.join(', ')}`);
    }
    configPath = platform.fixWindowsPath(configPath);
  }

  return configPath;
}

// --- Core Detection Logic ---

/**
 * Checks if a client's process is currently running.
 * @param client - The client to check.
 * @returns True if the process is running, false otherwise.
 */
async function isClientRunning(client: ClientType): Promise<boolean> {
  const platform = process.platform;
  const processNames = CLIENT_PROCESS_NAMES[client]?.[platform];

  if (!processNames || processNames.length === 0) {
    return false; // Platform not configured for process detection for this client.
  }

  const runningProcesses = await psList();
  return runningProcesses.some(p => processNames.includes(p.name));
}

/**
 * Reads and validates a client's configuration file content.
 * @param client - The client type.
 * @param configContent - The raw string content of the config file.
 * @param mode - The transport mode to validate against.
 * @param projectRoot - The project root for resolving server path.
 * @returns A validation result object.
 */
function validateConfigContent(
  client: ClientType,
  configContent: string,
  mode: TransportMode,
  projectRoot: string
): ValidationResult {
  const serverScriptPath = path.resolve(projectRoot, 'build', 'index.js');
  let config: any;

  try {
    config = JSON.parse(configContent);
  } catch (e) {
    return { isRegistered: false, isValid: false, details: 'Config file is not valid JSON.' };
  }

  if (client === 'claude') {
    const serverConfig: ClaudeServerConfig = config[VIBE_CHECK_SERVER_NAME];
    if (!serverConfig) {
      return { isRegistered: false, isValid: false, details: 'Vibe Check server not registered.' };
    }
    if (mode !== 'stdio') {
      return { isRegistered: true, isValid: false, details: `Invalid mode: Claude only supports 'stdio'.` };
    }
    const isValid = serverConfig.command === 'node' &&
                   Array.isArray(serverConfig.args) &&
                   serverConfig.args[0] === serverScriptPath;
    return {
      isRegistered: true,
      isValid,
      details: isValid ? 'Configuration is valid.' : 'Configuration is incorrect for stdio mode.',
    };
  } else { // cursor
    const servers: CursorServerConfig[] = config['mcp.servers'] || [];
    const serverConfig = servers.find(s => s.name === VIBE_CHECK_SERVER_NAME);
    if (!serverConfig) {
      return { isRegistered: false, isValid: false, details: 'Vibe Check server not registered.' };
    }

    let isValid = false;
    let details = '';
    if (mode === 'stdio') {
      isValid = serverConfig.type === 'command' && serverConfig.command === `node "${serverScriptPath}"`;
      details = isValid ? 'Configuration is valid.' : 'Configuration is incorrect for stdio mode.';
    } else { // http
      const port = process.env.MCP_HTTP_PORT || process.env.PORT || 3000;
      const expectedUrl = `http://localhost:${port}/mcp`;
      isValid = serverConfig.type === 'http' && serverConfig.url === expectedUrl;
      details = isValid ? 'Configuration is valid.' : `Configuration is incorrect for http mode. Expected URL: ${expectedUrl}`;
    }
    return { isRegistered: true, isValid, details };
  }
}

// --- Public API ---

/**
 * Detects the status of a specific client application.
 * @param client - The client to detect ('claude' or 'cursor').
 * @param mode - The transport mode to validate against.
 * @param projectRoot - The project root to resolve server path for validation.
 * @returns A promise that resolves to the client's status.
 */
export async function detectClient(
  client: ClientType,
  mode: TransportMode,
  projectRoot: string
): Promise<ClientStatus> {
  const configPath = getClientConfigPath(client);
  const isRunning = await isClientRunning(client);
  let configContent: string | null = null;
  let config: Record<string, any> | undefined;
  let isInstalled = false;

  try {
    configContent = await fs.readFile(configPath, 'utf-8');
    isInstalled = true;
    try {
      config = JSON.parse(configContent);
    } catch {
      // Invalid JSON, validation will handle it.
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      // Rethrow unexpected errors
      throw new Error(`Failed to read config for ${client} at ${configPath}: ${error.message}`);
    }
    // ENOENT means not installed, which is a normal state.
  }

  if (!isInstalled || configContent === null) {
    return {
      client,
      isInstalled: false,
      isRunning,
      configPath,
      validation: { isRegistered: false, isValid: false, details: 'Config file not found.' },
    };
  }

  const validation = validateConfigContent(client, configContent, mode, projectRoot);

  return {
    client,
    isInstalled,
    isRunning,
    configPath,
    config,
    validation,
  };
}

/**
 * Finds all installed clients by checking for the existence of their config files.
 * @returns A list of installed clients and their config paths.
 */
export async function findInstalledClients(): Promise<{ client: ClientType, configPath: string }[]> {
  const clients: ClientType[] = ['claude', 'cursor'];
  const results = await Promise.all(
    clients.map(async (client) => {
      const configPath = getClientConfigPath(client);
      try {
        await fs.access(configPath);
        return { client, configPath };
      } catch {
        return null;
      }
    })
  );
  return results.filter((r): r is { client: ClientType, configPath: string } => r !== null);
}

/**
 * Gets the status for all supported clients.
 * @param mode - The transport mode to validate against.
 * @param projectRoot - The project root to resolve server path for validation.
 * @returns A record mapping each client type to its status.
 */
export async function getAllClientsStatuses(mode: TransportMode, projectRoot: string): Promise<Record<ClientType, ClientStatus>> {
  const [claude, cursor] = await Promise.all([
    detectClient('claude', mode, projectRoot),
    detectClient('cursor', mode, projectRoot),
  ]);
  return { claude, cursor };
}