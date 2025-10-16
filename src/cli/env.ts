import { existsSync, promises as fsPromises } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import os from 'node:os';
import { parse as parseEnv } from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const { mkdir, readFile, rename, writeFile } = fsPromises;

export const PROVIDER_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'OPENROUTER_API_KEY',
] as const;

type EnsureEnvOptions = {
  interactive: boolean;
  local?: boolean;
  prompt?: (key: string) => Promise<string>;
  requiredKeys?: readonly string[];
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
  const requiredKeys = options.requiredKeys?.length ? [...options.requiredKeys] : null;
  const targetKeys = requiredKeys ?? [...PROVIDER_ENV_KEYS];
  const resolved = new Set<string>();

  const hydrateFrom = (key: string, source: Record<string, string>): boolean => {
    if (key in source) {
      process.env[key] = source[key];
      resolved.add(key);
      return true;
    }
    return false;
  };

  for (const key of targetKeys) {
    if (process.env[key]) {
      resolved.add(key);
      continue;
    }

    if (hydrateFrom(key, cwdValues)) {
      continue;
    }

    hydrateFrom(key, homeValues);
  }

  if (!requiredKeys && resolved.size > 0) {
    return { wrote: false };
  }

  const missing = targetKeys.filter((key) => !resolved.has(key));

  if (missing.length === 0) {
    return { wrote: false };
  }

  if (!options.interactive) {
    if (requiredKeys) {
      console.log(`Missing required API keys: ${requiredKeys.join(', ')}`);
      return { wrote: false, missing: [...missing] };
    }

    console.log(`No provider API keys detected. Set one of: ${targetKeys.join(', ')}`);
    console.log('Provide it via your shell or .env file, then re-run with --non-interactive.');
    return { wrote: false, missing: [...targetKeys] };
  }

  const targetPath = options.local ? resolve(process.cwd(), '.env') : resolve(homeConfigDir(), '.env');
  const targetValues = options.local ? cwdValues : homeValues;
  const prompter = options.prompt;

  let rl: any = null;
  const ask = async (key: string): Promise<string> => {
    if (prompter) {
      return prompter(key);
    }

    if (!rl) {
      rl = createInterface({ input, output });
    }

    const answer = await rl.question(`Enter value for ${key} (leave blank to skip): `);
    return answer;
  };

  const newEntries: Record<string, string> = {};
  const promptedKeys = requiredKeys ?? missing;
  let providedAny = false;

  try {
    for (const key of promptedKeys) {
      const value = (await ask(key)).trim();
      if (!value) {
        if (requiredKeys) {
          continue;
        }
        continue;
      }

      process.env[key] = value;
      targetValues[key] = value;
      newEntries[key] = value;
      resolved.add(key);
      providedAny = true;

      if (!requiredKeys) {
        break;
      }
    }
  } finally {
    if (rl) {
      rl.close();
    }
  }

  if (requiredKeys) {
    const missingRequired = requiredKeys.filter((key) => !resolved.has(key));
    if (missingRequired.length > 0) {
      console.log(`Missing required API keys: ${missingRequired.join(', ')}`);
      return { wrote: false, missing: missingRequired };
    }
  } else if (!providedAny) {
    console.log(`No provider API key entered. Set one of: ${targetKeys.join(', ')} and re-run.`);
    return { wrote: false, missing: [...targetKeys] };
  }

  if (Object.keys(newEntries).length === 0) {
    return { wrote: false };
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
