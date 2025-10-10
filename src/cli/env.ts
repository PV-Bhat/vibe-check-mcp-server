import { existsSync, readFileSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import os from 'node:os';
import { parse as parseEnv } from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export function homeConfigDir(): string {
  return join(os.homedir(), '.vibe-check');
}

export const REQUIRED_ENV_KEYS = ['VIBE_CHECK_API_KEY'] as const;

export function resolveEnvSources(): {
  cwdEnv: string | null;
  homeEnv: string | null;
  processEnv: NodeJS.ProcessEnv;
} {
  const cwdEnvPath = resolve(process.cwd(), '.env');
  const homeEnvPath = resolve(homeConfigDir(), '.env');

  return {
    cwdEnv: existsSync(cwdEnvPath) ? cwdEnvPath : null,
    homeEnv: existsSync(homeEnvPath) ? homeEnvPath : null,
    processEnv: process.env,
  };
}

type EnsureEnvOptions = {
  interactive: boolean;
  local: boolean;
};

type EnsureEnvResult = {
  wrote: boolean;
  path?: string;
  missingKeys?: string[];
};

function readEnvMap(path: string | null): Record<string, string> {
  if (!path || !existsSync(path)) {
    return {};
  }

  try {
    const raw = readFileSync(path, 'utf8');
    return parseEnv(raw);
  } catch (error) {
    console.warn(`Failed to read env file at ${path}: ${(error as Error).message}`);
    return {};
  }
}

function serializeEnv(env: Record<string, string>): string {
  const keys = Object.keys(env).sort();
  return keys
    .map((key) => `${key}=${env[key]}`)
    .join('\n')
    .concat(keys.length ? '\n' : '');
}

async function atomicWriteEnv(path: string, content: string): Promise<void> {
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(tempPath, content, { mode: 0o600 });
  try {
    await fs.rename(tempPath, path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      await fs.rm(path, { force: true });
      await fs.rename(tempPath, path);
    } else {
      await fs.rm(tempPath, { force: true });
      throw error;
    }
  }
}

export async function ensureEnv(options: EnsureEnvOptions): Promise<EnsureEnvResult> {
  const { interactive, local } = options;
  const sources = resolveEnvSources();
  const cwdMap = readEnvMap(sources.cwdEnv);
  const homeMap = readEnvMap(sources.homeEnv);

  const missing: string[] = [];

  for (const key of REQUIRED_ENV_KEYS) {
    const resolved =
      process.env[key] ?? (local ? cwdMap[key] : undefined) ?? cwdMap[key] ?? homeMap[key];
    if (resolved) {
      process.env[key] = resolved;
    } else {
      missing.push(key);
    }
  }

  if (missing.length === 0) {
    return { wrote: false };
  }

  if (!interactive) {
    console.warn(`Missing required environment variables: ${missing.join(', ')}`);
    return { wrote: false, missingKeys: missing };
  }

  const targetDir = local ? process.cwd() : homeConfigDir();
  const targetPath = resolve(targetDir, '.env');
  const targetMap = local ? { ...cwdMap } : { ...homeMap };

  const rl = createInterface({ input, output });
  try {
    for (const key of missing) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const answer = (await rl.question(`${key}: `)).trim();
        if (answer) {
          targetMap[key] = answer;
          process.env[key] = answer;
          break;
        }
      }
    }

    const targetExists = existsSync(targetPath);
    if (targetExists) {
      const confirmation = (await rl.question(`Update ${targetPath}? (y/N) `)).trim().toLowerCase();
      if (confirmation !== 'y' && confirmation !== 'yes') {
        console.warn('Aborted writing environment file.');
        return { wrote: false, path: targetPath, missingKeys: missing };
      }
    }
  } finally {
    rl.close();
  }

  const content = serializeEnv(targetMap);
  await atomicWriteEnv(targetPath, content);
  return { wrote: true, path: targetPath };
}
