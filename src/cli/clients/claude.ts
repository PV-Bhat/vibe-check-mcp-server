import { promises as fsPromises, constants as fsConstants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import os from 'node:os';
import { isDeepStrictEqual } from 'node:util';

const { access, mkdir, readFile, rename, writeFile } = fsPromises;

type JsonRecord = Record<string, unknown>;

type MergeOptions = {
  id: string;
  sentinel: string;
};

type MergeResult = {
  next: JsonRecord;
  changed: boolean;
  reason?: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function expandHomePath(path: string): string {
  if (!path.startsWith('~')) {
    return resolve(path);
  }

  const home = os.homedir();
  if (path === '~') {
    return home;
  }

  const withoutTilde = path.slice(1);
  return resolve(join(home, withoutTilde));
}

export async function locateClaudeConfig(customPath?: string): Promise<string | null> {
  if (customPath) {
    return expandHomePath(customPath);
  }

  const home = os.homedir();
  const candidates: string[] = [];

  if (process.platform === 'darwin') {
    candidates.push(join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'));
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) {
      candidates.push(join(appData, 'Claude', 'claude_desktop_config.json'));
    }
  } else {
    const xdgConfig = process.env.XDG_CONFIG_HOME;
    if (xdgConfig) {
      candidates.push(join(xdgConfig, 'Claude', 'claude_desktop_config.json'));
    }
    candidates.push(join(home, '.config', 'Claude', 'claude_desktop_config.json'));
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function readClaudeConfig(path: string, rawData?: string): Promise<JsonRecord> {
  const raw = rawData ?? (await readFile(path, 'utf8'));
  const parsed = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error('Claude config must be a JSON object.');
  }

  return parsed;
}

export async function writeClaudeConfigAtomic(path: string, data: JsonRecord): Promise<void> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });

  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;

  await writeFile(tempPath, payload, { mode: 0o600 });
  await rename(tempPath, path);
}

export function mergeMcpEntry(config: JsonRecord, entry: JsonRecord, options: MergeOptions): MergeResult {
  const { id, sentinel } = options;
  const baseConfig = isRecord(config) ? config : {};

  const existingServers = isRecord(baseConfig.mcpServers) ? (baseConfig.mcpServers as JsonRecord) : {};
  const currentEntry = isRecord(existingServers[id]) ? (existingServers[id] as JsonRecord) : null;

  if (currentEntry && currentEntry.managedBy !== sentinel) {
    return {
      next: baseConfig,
      changed: false,
      reason: `Existing entry "${id}" is not managed by ${sentinel}.`,
    };
  }

  const nextEntry = { ...entry, managedBy: sentinel };
  const nextServers = { ...existingServers, [id]: nextEntry };
  const nextConfig: JsonRecord = { ...baseConfig, mcpServers: nextServers };

  if (currentEntry && isDeepStrictEqual({ ...currentEntry, managedBy: sentinel }, nextEntry)) {
    return { next: baseConfig, changed: false };
  }

  return { next: nextConfig, changed: true };
}
