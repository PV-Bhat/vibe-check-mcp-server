#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Command, Option } from 'commander';
import { execa } from 'execa';
import { checkNodeVersion, detectEnvFiles, portStatus, readEnvFile } from './doctor.js';
import { claudeConfigCandidates, locateClaudeConfig, mergeMcpEntry, readClaudeConfig, writeClaudeConfigAtomic } from './clients/claude.js';
import { ensureEnv, REQUIRED_ENV_KEYS, resolveEnvSources } from './env.js';
import { renderUnifiedDiff } from './utils/diff.js';

type PackageJson = {
  version?: string;
  engines?: {
    node?: string;
  };
};

type Transport = 'http' | 'stdio';

type StartOptions = {
  stdio?: boolean;
  http?: boolean;
  port?: number;
  dryRun?: boolean;
};

type DoctorOptions = {
  http?: boolean;
  port?: number;
};

type InstallOptions = {
  client: string;
  dryRun?: boolean;
  nonInteractive?: boolean;
  local?: boolean;
  config?: string;
};

const cliDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(cliDir, '..', '..');
const entrypoint = resolve(projectRoot, 'build', 'index.js');
const packageJsonPath = resolve(projectRoot, 'package.json');
const projectEntrypoint = resolve(projectRoot, 'build', 'index.js');

function readPackageJson(): PackageJson {
  const raw = readFileSync(packageJsonPath, 'utf8');
  return JSON.parse(raw) as PackageJson;
}

function parsePort(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid port: ${value}`);
  }

  return parsed;
}

function mergeEnvFromFile(env: NodeJS.ProcessEnv, path: string | null): void {
  if (!path) {
    return;
  }

  try {
    const parsed = readEnvFile(path);
    for (const [key, value] of Object.entries(parsed)) {
      if (!(key in env)) {
        env[key] = value;
      }
    }
  } catch (error) {
    console.warn(`Failed to read env file at ${path}: ${(error as Error).message}`);
  }
}

async function runStartCommand(options: StartOptions): Promise<void> {
  const envSources = resolveEnvSources();
  const spawnEnv: NodeJS.ProcessEnv = { ...envSources.processEnv };

  mergeEnvFromFile(spawnEnv, envSources.homeEnv);
  mergeEnvFromFile(spawnEnv, envSources.cwdEnv);

  if (options.http && options.stdio) {
    throw new Error('Select either --stdio or --http, not both.');
  }

  const transport = resolveTransport({ http: options.http, stdio: options.stdio }, spawnEnv.MCP_TRANSPORT);
  spawnEnv.MCP_TRANSPORT = transport;

  if (transport === 'http') {
    const httpPort = resolveHttpPort(options.port, spawnEnv.MCP_HTTP_PORT);
    spawnEnv.MCP_HTTP_PORT = String(httpPort);
  } else {
    if (options.port != null) {
      throw new Error('The --port option is only available when using --http.');
    }
  }

  if (options.dryRun) {
    console.log('vibe-check-mcp start (dry run)');
    console.log(`Entrypoint: ${process.execPath} ${entrypoint}`);
    console.log('Environment overrides:');
    console.log(`  MCP_TRANSPORT=${spawnEnv.MCP_TRANSPORT}`);
    if (transport === 'http' && spawnEnv.MCP_HTTP_PORT) {
      console.log(`  MCP_HTTP_PORT=${spawnEnv.MCP_HTTP_PORT}`);
    }
    return;
  }

  await execa(process.execPath, [entrypoint], {
    stdio: 'inherit',
    env: spawnEnv,
  });
}

async function runDoctorCommand(options: DoctorOptions): Promise<void> {
  const pkg = readPackageJson();
  const requiredNodeRange = pkg.engines?.node ?? '>=20.0.0';
  const nodeCheck = checkNodeVersion(requiredNodeRange);
  if (nodeCheck.ok) {
    console.log(`Node.js version: ${nodeCheck.current} (meets ${requiredNodeRange})`);
  } else {
    console.warn(`Node.js version: ${nodeCheck.current} (requires ${requiredNodeRange})`);
    process.exitCode = 1;
  }

  const envFiles = detectEnvFiles();
  console.log(`Project .env: ${envFiles.cwdEnv ?? 'not found'}`);
  console.log(`Home .env: ${envFiles.homeEnv ?? 'not found'}`);

  const transport = resolveTransport({ http: options.http }, process.env.MCP_TRANSPORT);

  if (transport !== 'http') {
    console.log('Using stdio transport; port checks skipped.');
    return;
  }

  const port = resolveHttpPort(options.port, process.env.MCP_HTTP_PORT);
  const status = await portStatus(port);
  console.log(`HTTP port ${port}: ${status}`);
}

function requiredEnvMissing(): string[] {
  return REQUIRED_ENV_KEYS.filter((key) => !process.env[key]);
}

function detectClaudeCommand(): { command: string; args: string[]; env: Record<string, string> } {
  const pathEntries = (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':');
  const executables = process.platform === 'win32' ? ['npx.cmd', 'npx.exe', 'npx'] : ['npx'];

  for (const entry of pathEntries) {
    if (!entry) continue;
    for (const executable of executables) {
      const candidate = join(entry, executable);
      if (existsSync(candidate)) {
        return { command: 'npx', args: ['@pv-bhat/vibe-check-mcp', 'start', '--stdio'], env: {} };
      }
    }
  }

  return { command: process.execPath, args: [projectEntrypoint], env: { MCP_TRANSPORT: 'stdio' } };
}

async function runInstallCommand(options: InstallOptions): Promise<void> {
  if (options.client !== 'claude') {
    throw new Error(`Unsupported client: ${options.client}`);
  }

  const interactive = !options.nonInteractive;
  await ensureEnv({ interactive, local: Boolean(options.local) });
  const missing = requiredEnvMissing();
  if (missing.length > 0) {
    console.warn(`Missing required environment variables: ${missing.join(', ')}`);
    if (interactive) {
      console.warn('Re-run the command to capture the values.');
    } else {
      console.warn('Provide the variables via environment or .env files and re-run with --non-interactive.');
    }
    return;
  }

  const configPath = options.config ? resolve(options.config) : await locateClaudeConfig();
  if (!configPath) {
    console.log('Claude Desktop configuration not found.');
    console.log('Checked paths:');
    for (const candidate of claudeConfigCandidates()) {
      console.log(`  - ${candidate}`);
    }
    console.log('Launch Claude Desktop once or specify --config <path> to continue.');
    return;
  }

  let currentConfig: any = {};
  try {
    currentConfig = await readClaudeConfig(configPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      currentConfig = {};
    } else {
      throw error;
    }
  }

  const entry = detectClaudeCommand();
  const mergeResult = mergeMcpEntry(currentConfig, entry, {
    id: 'vibe-check-mcp',
    sentinel: 'vibe-check-mcp-cli',
  });

  if (!mergeResult.changed) {
    if (mergeResult.reason) {
      console.warn(`Existing mcpServers.vibe-check-mcp entry is unmanaged (${mergeResult.reason}). Skipping.`);
    } else {
      console.log('Claude Desktop configuration already up to date.');
    }
    return;
  }

  const nextSerialized = `${JSON.stringify(mergeResult.next, null, 2)}\n`;
  const currentSerialized = `${JSON.stringify(currentConfig, null, 2)}\n`;

  if (options.dryRun) {
    console.log(`Dry run: no changes written to ${configPath}`);
    console.log(renderUnifiedDiff('current', configPath, currentSerialized, nextSerialized));
    return;
  }

  await writeClaudeConfigAtomic(configPath, mergeResult.next);
  console.log(`Updated Claude Desktop configuration at ${configPath}`);
  const summary = mergeResult.next.mcpServers?.['vibe-check-mcp'];
  if (summary) {
    console.log('Registered entry:');
    console.log(JSON.stringify(summary, null, 2));
  }
}

export function createCliProgram(): Command {
  const pkg = readPackageJson();
  const program = new Command();

  program
    .name('vibe-check-mcp')
    .description('CLI utilities for the Vibe Check MCP server')
    .version(pkg.version ?? '0.0.0');

  program
    .command('start')
    .description('Start the Vibe Check MCP server')
    .addOption(new Option('--stdio', 'Use STDIO transport').conflicts('http'))
    .addOption(new Option('--http', 'Use HTTP transport').conflicts('stdio'))
    .option('--port <number>', 'HTTP port (default: 2091)', parsePort)
    .option('--dry-run', 'Print the resolved command without executing')
    .action(async (options: StartOptions) => {
      try {
        await runStartCommand(options);
      } catch (error) {
        console.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('doctor')
    .description('Diagnose environment issues')
    .option('--http', 'Check HTTP transport readiness')
    .option('--port <number>', 'HTTP port to inspect', parsePort)
    .action(async (options: DoctorOptions) => {
      try {
        await runDoctorCommand(options);
      } catch (error) {
        console.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('install')
    .description('Install client integrations')
    .requiredOption('--client <client>', 'Client to configure (only "claude" supported)')
    .option('--dry-run', 'Preview changes without writing')
    .option('--non-interactive', 'Fail instead of prompting for missing secrets')
    .option('--local', 'Write secrets to the project .env instead of the home directory')
    .option('--config <path>', 'Path to Claude Desktop configuration JSON')
    .action(async (options: InstallOptions) => {
      try {
        await runInstallCommand(options);
      } catch (error) {
        console.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  return program;
}

function normalizeTransport(value: string | undefined): Transport | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'http' || normalized === 'stdio') {
    return normalized;
  }

  return undefined;
}

function resolveTransport(
  options: { http?: boolean; stdio?: boolean },
  envTransport: string | undefined,
): Transport {
  const flagTransport = options.http ? 'http' : options.stdio ? 'stdio' : undefined;
  const resolvedEnv = normalizeTransport(envTransport);

  return flagTransport ?? resolvedEnv ?? 'stdio';
}

function resolveHttpPort(optionPort: number | undefined, envPort: string | undefined): number {
  if (optionPort != null) {
    return optionPort;
  }

  if (envPort) {
    const parsed = Number.parseInt(envPort, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 2091;
}

const executedFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (executedFile === import.meta.url) {
  createCliProgram()
    .parseAsync(process.argv)
    .catch((error: unknown) => {
      console.error((error as Error).message);
      process.exitCode = 1;
    });
}
