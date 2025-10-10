#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { execa, type ExecaError } from 'execa';
import { loadEnvFromSources, resolveEnvSources } from './env.js';
import { checkNodeVersion, detectEnvFiles, portStatus } from './doctor.js';

type PackageJson = {
  version?: string;
  engines?: {
    node?: string;
  };
};

const cliDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(cliDir, '..', '..');
const entryPoint = resolve(cliDir, '..', 'index.js');

function readPackageJson(): PackageJson {
  const packageJsonPath = resolve(projectRoot, 'package.json');
  const raw = readFileSync(packageJsonPath, 'utf8');
  return JSON.parse(raw) as PackageJson;
}

function buildEnvironment(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const sources = resolveEnvSources();
  const loaded = loadEnvFromSources(sources);
  return { ...sources.processEnv, ...loaded, ...overrides };
}

function parsePort(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }

  return parsed;
}

function printDryRun(entry: string, overrides: Record<string, string>): void {
  console.log(`Entry point: ${entry}`);
  if (Object.keys(overrides).length === 0) {
    console.log('No environment overrides');
    return;
  }

  console.log('Environment overrides:');
  for (const [key, value] of Object.entries(overrides)) {
    console.log(`${key}=${value}`);
  }
}

async function run() {
  const pkg = readPackageJson();
  const program = new Command();

  program
    .name('vibe-check-mcp')
    .description('Start and diagnose the Vibe Check MCP server')
    .version(pkg.version ?? '0.0.0');

  program
    .command('start')
    .description('Run the MCP server with the desired transport')
    .option('--stdio', 'Use stdio transport (default)')
    .option('--http', 'Use HTTP transport')
    .option('--port <number>', 'HTTP port to bind', parsePort)
    .option('--dry-run', 'Print resolved configuration without launching')
    .action(async (options: { stdio?: boolean; http?: boolean; port?: number; dryRun?: boolean }) => {
      if (options.stdio && options.http) {
        console.error('Specify either --stdio or --http, not both.');
        process.exitCode = 1;
        return;
      }

      if (!options.http && options.port !== undefined) {
        console.error('--port can only be used with --http.');
        process.exitCode = 1;
        return;
      }

      const transport = options.http ? 'http' : 'stdio';
      const overrides: Record<string, string> = {
        MCP_TRANSPORT: transport,
      };

      if (transport === 'http') {
        const port = options.port ?? 2091;
        overrides.MCP_HTTP_PORT = String(port);
      }

      if (options.dryRun) {
        printDryRun(entryPoint, overrides);
        return;
      }

      const env = buildEnvironment(overrides);

      try {
        const subprocess = await execa(process.execPath, [entryPoint], {
          stdio: 'inherit',
          env,
        });

        process.exitCode = subprocess.exitCode ?? 0;
      } catch (error) {
        const err = error as ExecaError;
        if (typeof err.exitCode === 'number') {
          process.exit(err.exitCode);
          return;
        }

        console.error('Failed to start Vibe Check MCP server.');
        if (err.shortMessage) {
          console.error(err.shortMessage);
        } else {
          console.error(err);
        }
        process.exit(1);
      }
    });

  program
    .command('doctor')
    .description('Run diagnostics for the local environment')
    .option('--http', 'Check HTTP transport readiness regardless of current env')
    .option('--port <number>', 'HTTP port to verify', parsePort)
    .action(async (options: { http?: boolean; port?: number }) => {
      const nodeRange = pkg.engines?.node ?? '>=20.0.0';
      const versionResult = checkNodeVersion(nodeRange);

      console.log(`Node.js version: ${versionResult.current}`);
      console.log(`Required range: ${nodeRange}`);
      if (versionResult.ok) {
        console.log('✔ Node version satisfies requirement.');
      } else {
        console.warn('✖ Node version is below the required range.');
      }

      const envFiles = detectEnvFiles();
      console.log(`Project .env: ${envFiles.cwdEnv ?? 'not found'}`);
      console.log(`Home .env: ${envFiles.homeEnv ?? 'not found'}`);

      const envSources = resolveEnvSources();
      const resolvedEnv = {
        ...envSources.processEnv,
        ...loadEnvFromSources(envSources),
      } as Record<string, string | undefined>;

      const transportSetting = resolvedEnv.MCP_TRANSPORT?.toLowerCase();
      const shouldCheckHttp = options.http || transportSetting === 'http';

      if (shouldCheckHttp) {
        let port = options.port;

        if (port === undefined) {
          const rawPort = resolvedEnv.MCP_HTTP_PORT;
          if (rawPort) {
            try {
              port = parsePort(rawPort);
            } catch {
              console.warn(`HTTP port value "${rawPort}" is invalid; defaulting to 2091`);
            }
          }
        }

        const resolvedPort = port ?? 2091;
        const status = await portStatus(resolvedPort);
        if (status === 'free') {
          console.log(`HTTP port ${resolvedPort}: available`);
        } else if (status === 'in-use') {
          console.warn(`HTTP port ${resolvedPort}: already in use`);
        } else {
          console.warn(`HTTP port ${resolvedPort}: status unknown`);
        }
      }

      if (!versionResult.ok) {
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

