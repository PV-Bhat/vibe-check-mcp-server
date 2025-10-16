import { promises as fsPromises, constants as fsConstants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import os from 'node:os';
import { isDeepStrictEqual } from 'node:util';

const { access, mkdir, readFile, rename, writeFile } = fsPromises;

export type JsonRecord = Record<string, unknown>;

export type TransportKind = 'stdio' | 'http';

export type MergeOpts = {
  id: string;
  sentinel: string;
  transport: TransportKind;
  httpUrl?: string;
  dev?: {
    watch?: boolean;
    debug?: string;
  };
};

export type MergeResult = {
  next: JsonRecord;
  changed: boolean;
  reason?: string;
};

export type ClientDescription = {
  name: string;
  pathHint: string;
  summary?: string;
  transports?: TransportKind[];
  defaultTransport?: TransportKind;
  requiredEnvKeys?: readonly string[];
  notes?: string;
  docsUrl?: string;
};

export interface ClientAdapter {
  locate(custom?: string): Promise<string | null>;
  read(path: string, raw?: string): Promise<JsonRecord>;
  merge(config: JsonRecord, entry: JsonRecord, options: MergeOpts): MergeResult;
  writeAtomic(path: string, data: JsonRecord): Promise<void>;
  describe(): ClientDescription;
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function expandHomePath(path: string): string {
  if (!path.startsWith('~')) {
    return resolve(path);
  }

  const home = os.homedir();
  if (path === '~') {
    return home;
  }

  const remainder = path.slice(1);
  if (remainder.startsWith('/') || remainder.startsWith('\\')) {
    return resolve(join(home, remainder.slice(1)));
  }

  return resolve(join(home, remainder));
}

export async function readJsonFile(path: string, raw?: string, context = 'Client configuration'): Promise<JsonRecord> {
  const payload = raw ?? (await readFile(path, 'utf8'));
  const parsed = JSON.parse(payload);
  if (!isRecord(parsed)) {
    throw new Error(`${context} must be a JSON object.`);
  }

  return parsed;
}

export async function writeJsonFileAtomic(path: string, data: JsonRecord): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(tempPath, payload, { mode: 0o600 });
  await rename(tempPath, path);
}

export function mergeIntoMap(
  config: JsonRecord,
  entry: JsonRecord,
  options: MergeOpts,
  mapKey: string,
): MergeResult {
  const baseConfig = isRecord(config) ? config : {};
  const existingMap = isRecord(baseConfig[mapKey]) ? { ...(baseConfig[mapKey] as JsonRecord) } : {};
  const currentEntry = isRecord(existingMap[options.id])
    ? ({ ...(existingMap[options.id] as JsonRecord) } as JsonRecord)
    : null;

  if (currentEntry && currentEntry.managedBy !== options.sentinel) {
    return {
      next: baseConfig,
      changed: false,
      reason: `Existing entry "${options.id}" is not managed by ${options.sentinel}.`,
    };
  }

  const sanitizedEntry = { ...entry } as JsonRecord;
  delete sanitizedEntry.managedBy;

  const nextEntry: JsonRecord = { ...sanitizedEntry, managedBy: options.sentinel };
  const nextMap = { ...existingMap, [options.id]: nextEntry };
  const nextConfig: JsonRecord = { ...baseConfig, [mapKey]: nextMap };

  if (currentEntry && isDeepStrictEqual(currentEntry, nextEntry)) {
    return { next: baseConfig, changed: false };
  }

  return { next: nextConfig, changed: true };
}
