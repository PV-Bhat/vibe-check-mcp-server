#!/usr/bin/env node
import { readFileSync, promises as fsPromises } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Command, Option } from 'commander';
import { execa } from 'execa';
import { checkNodeVersion, detectEnvFiles, portStatus, readEnvFile } from './doctor.js';
import { ensureEnv, resolveEnvSources } from './env.js';
import { formatUnifiedDiff } from './diff.js';
import claudeAdapter from './clients/claude.js';
import claudeCodeAdapter from './clients/claude-code.js';
import cursorAdapter from './clients/cursor.js';
import windsurfAdapter from './clients/windsurf.js';
import vscodeAdapter from './clients/vscode.js';
import {
  ClientAdapter,
  ClientDescription,
  JsonRecord,
  MergeOpts,
  TransportKind,
  isRecord,
} from './clients/shared.js';

type PackageJson = {
  version?: string;
  engines?: {
    node?: string;
  };
};

type Transport = TransportKind;

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
  http?: boolean;
  stdio?: boolean;
  port?: number;
  devWatch?: boolean;
  devDebug?: string;
};

const cliDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(cliDir, '..', '..');
const entrypoint = resolve(projectRoot, 'build', 'index.js');
const packageJsonPath = resolve(projectRoot, 'package.json');

const MANAGED_ID = 'vibe-check-mcp';
const SENTINEL = 'vibe-check-mcp-cli';

const CLIENT_ADAPTERS: Record<string, ClientAdapter> = {
  claude: claudeAdapter,
  'claude-code': claudeCodeAdapter,
  cursor: cursorAdapter,
  windsurf: windsurfAdapter,
  vscode: vscodeAdapter,
};

type RegisteredClient = {
  key: string;
  adapter: ClientAdapter;
  description: ClientDescription;
};

function collectRegisteredClients(): RegisteredClient[] {
  return Object.entries(CLIENT_ADAPTERS)
    .map(([key, adapter]) => ({ key, adapter, description: adapter.describe() }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function formatTransportSummary(description: ClientDescription): string {
  const transports = description.transports && description.transports.length > 0 ? description.transports : ['stdio'];
  const defaultTransport = description.defaultTransport ?? transports[0];
  return transports
    .map((transport) => (transport === defaultTransport ? `${transport} (default)` : transport))
    .join(', ');
}

function formatInstallHint(key: string, description: ClientDescription): string {
  const transports = description.transports && description.transports.length > 0 ? description.transports : ['stdio'];
  const defaultTransport = description.defaultTransport ?? transports[0];
  const base = `npx @pv-bhat/vibe-check-mcp install --client ${key}`;

  if (!defaultTransport) {
    return base;
  }

  const extras = transports.filter((value) => value !== defaultTransport);
  const hint = `${base} --${defaultTransport}`;

  if (extras.length === 0) {
    return hint;
  }

  const extraFlags = extras.map((value) => `--${value}`).join(', ');
  return `${hint} (alternatives: ${extraFlags})`;
}

export function showAvailableClients(): void {
  const clients = collectRegisteredClients();
  console.log('Available MCP clients:\n');

  for (const { key, description } of clients) {
    console.log(`- ${key} (${description.name})`);
    if (description.summary) {
      console.log(`  Summary: ${description.summary}`);
    }
    console.log(`  Config: ${description.pathHint}`);
    if (description.requiredEnvKeys?.length) {
      console.log(`  API keys: ${description.requiredEnvKeys.join(', ')}`);
    }
    console.log(`  Transports: ${formatTransportSummary(description)}`);
    console.log(`  Install: ${formatInstallHint(key, description)}`);
    if (description.notes) {
      console.log(`  Notes: ${description.notes}`);
    }
    if (description.docsUrl) {
      console.log(`  Docs: ${description.docsUrl}`);
    }
    console.log('');
  }

  console.log('Template: npx @pv-bhat/vibe-check-mcp install --client <client> [--stdio|--http] [options]');
  console.log('Hosted: smithery add @PV-Bhat/vibe-check-mcp-server');
  console.log("Run 'npx @pv-bhat/vibe-check-mcp --help' for detailed usage.");
}

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

  if (transport === 'stdio') {
    // For stdio, we must run the server in the same process as the CLI
    // to allow the client to communicate with it directly.
    Object.assign(process.env, spawnEnv);
    const { main } = await import('../index.js');
    await main();
  } else {
    // For HTTP, spawning a child process is acceptable.
    await execa(process.execPath, [entrypoint], {
      stdio: 'inherit',
      env: spawnEnv,
    });
  }
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

async function runInstallCommand(options: InstallOptions): Promise<void> {
  const clientKey = options.client?.toLowerCase();
  const adapter = clientKey ? CLIENT_ADAPTERS[clientKey] : undefined;
  if (!adapter) {
    throw new Error(`Unsupported client: ${options.client}`);
  }

  const interactive = !options.nonInteractive;
  const description = adapter.describe();
  const envResult = await ensureEnv({
    interactive,
    local: Boolean(options.local),
    requiredKeys: description.requiredEnvKeys,
  });

  if (envResult.missing?.length) {
    return;
  }

  if (envResult.wrote && envResult.path) {
    console.log(`Secrets written to ${envResult.path}`);
  }

  const transport = resolveTransport({ http: options.http, stdio: options.stdio }, process.env.MCP_TRANSPORT);

  let httpPort: number | undefined;
  let httpUrl: string | undefined;

  if (transport === 'http') {
    httpPort = resolveHttpPort(options.port, process.env.MCP_HTTP_PORT);
    httpUrl = `http://127.0.0.1:${httpPort}`;
  } else if (options.port != null) {
    throw new Error('The --port option is only available when using --http.');
  }

  const entry = createInstallEntry(transport, httpPort);

  const mergeOptions: MergeOpts = {
    id: MANAGED_ID,
    sentinel: SENTINEL,
    transport,
    httpUrl,
  };

  if (options.devWatch || options.devDebug) {
    mergeOptions.dev = {};
    if (options.devWatch) {
      mergeOptions.dev.watch = true;
    }
    if (options.devDebug) {
      mergeOptions.dev.debug = options.devDebug;
    }
  }

  const configPath = await adapter.locate(options.config);

  if (!configPath) {
    emitManualInstallMessage({
      adapter,
      clientKey,
      description,
      entry,
      mergeOptions,
      transport,
      httpUrl,
    });
    return;
  }

  const configExists = await fileExists(configPath);
  let existingRaw = '';
  let currentConfig: JsonRecord = {};

  if (configExists) {
    existingRaw = await fsPromises.readFile(configPath, 'utf8');
    currentConfig = await adapter.read(configPath, existingRaw);
  }

  const { next, changed, reason } = adapter.merge(currentConfig, entry, mergeOptions);

  if (!changed) {
    if (reason) {
      console.warn(reason);
    } else {
      console.log(`${description.name} already has a managed entry for ${MANAGED_ID}.`);
    }
    return;
  }

  const nextRaw = `${JSON.stringify(next, null, 2)}\n`;

  if (options.dryRun) {
    const diff = formatUnifiedDiff(existingRaw, nextRaw, configPath);
    console.log(diff.trim() ? diff : 'No changes.');
    return;
  }

  if (existingRaw) {
    const backupPath = await createBackup(configPath, existingRaw);
    console.log(`Backup created at ${backupPath}`);
  }

  await adapter.writeAtomic(configPath, next);

  const summaryEntry = extractManagedEntry(next, MANAGED_ID);
  console.log(`${description.name} config updated (${transport}): ${configPath}`);
  if (summaryEntry) {
    console.log(JSON.stringify(summaryEntry, null, 2));
  }
  console.log('Restart the client to pick up the new MCP server.');
  if (transport === 'http' && httpPort) {
    const startCommand = formatStartCommand(entry);
    console.log(`Start the server separately with: ${startCommand}`);
    console.log(`HTTP endpoint: ${httpUrl}`);
  }
}

function createInstallEntry(transport: Transport, port?: number): JsonRecord {
  const args: string[] = ['-y', '@pv-bhat/vibe-check-mcp', 'start'];

  if (transport === 'http') {
    args.push('--http');
    const resolvedPort = port ?? 2091;
    args.push('--port', String(resolvedPort));
  } else {
    args.push('--stdio');
  }

  return {
    command: 'npx',
    args,
    env: {},
  } satisfies JsonRecord;
}

function formatStartCommand(entry: JsonRecord): string {
  const command = typeof entry.command === 'string' ? entry.command : 'npx';
  const args = Array.isArray(entry.args) ? entry.args.map((value) => String(value)) : [];
  return [command, ...args].join(' ');
}

function extractManagedEntry(config: JsonRecord, id: string): JsonRecord | null {
  const mapCandidates: Array<JsonRecord | undefined> = [];

  if (isRecord(config.mcpServers)) {
    mapCandidates.push(config.mcpServers as JsonRecord);
  }

  if (isRecord(config.servers)) {
    mapCandidates.push(config.servers as JsonRecord);
  }

  for (const map of mapCandidates) {
    if (!map) {
      continue;
    }
    const entry = map[id];
    if (isRecord(entry)) {
      return entry as JsonRecord;
    }
  }

  return null;
}

type ManualInstallArgs = {
  adapter: ClientAdapter;
  clientKey: string;
  description: ReturnType<ClientAdapter['describe']>;
  entry: JsonRecord;
  mergeOptions: MergeOpts;
  transport: Transport;
  httpUrl?: string;
};

function emitManualInstallMessage(args: ManualInstallArgs): void {
  const { adapter, clientKey, description, entry, mergeOptions, transport, httpUrl } = args;

  console.log(`${description.name} configuration not found at ${description.pathHint}.`);
  if (description.notes) {
    console.log(description.notes);
  }

  const preview = adapter.merge({}, entry, mergeOptions);
  const managedEntry = extractManagedEntry(preview.next, MANAGED_ID) ?? preview.next;

  console.log('Add this MCP server configuration manually:');
  console.log(JSON.stringify(managedEntry, null, 2));

  if (clientKey === 'vscode') {
    const installUrl = createVsCodeInstallUrl(entry, mergeOptions);
    console.log('VS Code quick install link:');
    console.log(installUrl);
    console.log('Command Palette → "MCP: Add Server" will open the profile file.');
  } else if (clientKey === 'cursor') {
    console.log('Cursor → Settings → MCP Servers lets you paste this JSON.');
  } else if (clientKey === 'windsurf') {
    console.log('Create the file if it does not exist, then restart Windsurf.');
  }

  if (transport === 'http' && httpUrl) {
    const startCommand = formatStartCommand(entry);
    console.log(`Expose the HTTP server separately with: ${startCommand}`);
    console.log(`HTTP endpoint: ${httpUrl}`);
  }
}

function createVsCodeInstallUrl(entry: JsonRecord, options: MergeOpts): string {
  const url = new URL('vscode:mcp/install');
  url.searchParams.set('name', 'Vibe Check MCP');

  const command = typeof entry.command === 'string' ? entry.command : 'npx';
  url.searchParams.set('command', command);

  const args = Array.isArray(entry.args) ? entry.args.map((value) => String(value)) : [];
  if (args.length > 0) {
    url.searchParams.set('args', JSON.stringify(args));
  }

  if (options.transport === 'http' && options.httpUrl) {
    url.searchParams.set('url', options.httpUrl);
  } else {
    url.searchParams.set('transport', options.transport);
  }

  return url.toString();
}

export function createCliProgram(): Command {
  const pkg = readPackageJson();
  const program = new Command();

  program
    .name('vibe-check-mcp')
    .description('CLI utilities for the Vibe Check MCP server')
    .version(pkg.version ?? '0.0.0');

  program
    .option('--list-clients', 'List supported MCP client integrations')
    .addHelpText('afterAll', () => {
      const clients = collectRegisteredClients();
      if (clients.length === 0) {
        return '';
      }

      const longestKey = Math.max(...clients.map((client) => client.key.length));
      const lines = clients
        .map((client) => `  ${client.key.padEnd(longestKey)}  ${client.description.name}`)
        .join('\n');

      return `\nSupported clients:\n${lines}\n\nRun 'npx @pv-bhat/vibe-check-mcp --list-clients' for details.\n`;
    });

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
    .requiredOption('--client <name>', 'Client to configure')
    .option('--config <path>', 'Path to the client configuration file')
    .option('--dry-run', 'Show the merged configuration without writing')
    .option('--non-interactive', 'Do not prompt for missing environment values')
    .option('--local', 'Write secrets to the project .env instead of ~/.vibe-check/.env')
    .addOption(new Option('--stdio', 'Configure STDIO transport').conflicts('http'))
    .addOption(new Option('--http', 'Configure HTTP transport').conflicts('stdio'))
    .option('--port <number>', 'HTTP port (default: 2091)', parsePort)
    .option('--dev-watch', 'Add dev.watch=true (VS Code only)')
    .option('--dev-debug <value>', 'Set dev.debug (VS Code only)')
    .action(async (options: InstallOptions) => {
      try {
        await runInstallCommand(options);
      } catch (error) {
        console.error((error as Error).message);
        process.exitCode = 1;
      }
    });

  program.action(() => {
    const options = program.opts<{ listClients?: boolean }>();

    if (options.listClients) {
      showAvailableClients();
      return;
    }

    program.help();
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

async function fileExists(path: string): Promise<boolean> {
  try {
    await fsPromises.access(path);
    return true;
  } catch {
    return false;
  }
}

function formatTimestamp(date: Date): string {
  const iso = date.toISOString();
  return iso.replace(/[:.]/g, '-');
}

async function createBackup(path: string, contents: string): Promise<string> {
  const backupPath = `${path}.${formatTimestamp(new Date())}.bak`;
  await fsPromises.writeFile(backupPath, contents, { mode: 0o600 });
  return backupPath;
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
