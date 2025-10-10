import { existsSync, promises as fsPromises } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import os from 'node:os';
import { parse as parseEnv } from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const { mkdir, readFile, rename, writeFile } = fsPromises;

const REQUIRED_ENV_KEYS = ['VIBE_CHECK_API_KEY'];

type EnsureEnvOptions = {
  interactive: boolean;
  local?: boolean;
  prompt?: (key: string) => Promise<string>;
};

type EnsureEnvResult = {
  wrote: boolean;
  path?: string;
  missing?: string[];
};

export function homeConfigDir(): string {
  return join(os.homedir(), '.vibe-check');
}

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

async function readEnvFile(path: string | null): Promise<Record<string, string>> {
  if (!path) {
    return {};
  }

  try {
    const raw = await readFile(path, 'utf8');
    return parseEnv(raw);
  } catch {
    return {};
  }
}

function formatEnvValue(value: string): string {
  if (/^[A-Za-z0-9_@./-]+$/.test(value)) {
    return value;
  }

  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

async function writeEnvFileAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, content, { mode: 0o600 });
  await rename(tempPath, path);
}

export async function ensureEnv(options: EnsureEnvOptions): Promise<EnsureEnvResult> {
  const sources = resolveEnvSources();
  const cwdValues = await readEnvFile(sources.cwdEnv);
  const homeValues = await readEnvFile(sources.homeEnv);
  const missing: string[] = [];

  for (const key of REQUIRED_ENV_KEYS) {
    if (process.env[key]) {
      continue;
    }

    if (key in cwdValues) {
      process.env[key] = cwdValues[key];
      continue;
    }

    if (key in homeValues) {
      process.env[key] = homeValues[key];
      continue;
    }

    missing.push(key);
  }

  if (missing.length === 0) {
    return { wrote: false };
  }

  if (!options.interactive) {
    console.log(`Missing required environment variables: ${missing.join(', ')}`);
    console.log('Provide them via your shell or .env file, then re-run with --non-interactive.');
    return { wrote: false, missing };
  }

  const targetPath = options.local ? resolve(process.cwd(), '.env') : resolve(homeConfigDir(), '.env');
  const targetValues = options.local ? cwdValues : homeValues;
  const prompter = options.prompt;

  let rl: ReturnType<typeof createInterface> | null = null;
  const ask = async (key: string): Promise<string> => {
    if (prompter) {
      return prompter(key);
    }

    if (!rl) {
      rl = createInterface({ input, output });
    }

    const answer = await rl.question(`Enter value for ${key}: `);
    return answer;
  };

  const newEntries: Record<string, string> = {};

  try {
    for (const key of missing) {
      let value = '';
      do {
        value = (await ask(key)).trim();
      } while (!value);

      process.env[key] = value;
      targetValues[key] = value;
      newEntries[key] = value;
    }
  } finally {
    if (rl) {
      rl.close();
    }
  }

  const existingContent = existsSync(targetPath) ? await readFile(targetPath, 'utf8') : '';
  const segments: string[] = [];
  if (existingContent) {
    segments.push(existingContent.trimEnd());
  }
  for (const [key, value] of Object.entries(newEntries)) {
    segments.push(`${key}=${formatEnvValue(value)}`);
  }

  const nextContent = segments.join('\n') + '\n';
  await writeEnvFileAtomic(targetPath, nextContent);

  return { wrote: true, path: targetPath };
}
