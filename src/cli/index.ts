#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Command, Option } from 'commander';
import { execa } from 'execa';
import { checkNodeVersion, detectEnvFiles, portStatus, readEnvFile } from './doctor.js';
import { resolveEnvSources } from './env.js';

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

const cliDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(cliDir, '..', '..');
const entrypoint = resolve(projectRoot, 'build', 'index.js');
const packageJsonPath = resolve(projectRoot, 'package.json');

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
