import { existsSync, promises as fsPromises } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import os from 'node:os';
import { parse as parseEnv } from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const { mkdir, readFile, rename, writeFile } = fsPromises;

const PROVIDER_VALIDATIONS: Record<string, { regex: RegExp; message: string }> = {
  ANTHROPIC_API_KEY: {
    regex: /^sk-ant-/,
    message: 'must start with "sk-ant-".',
  },
  OPENAI_API_KEY: {
    regex: /^sk-/,
    message: 'must start with "sk-".',
  },
  GEMINI_API_KEY: {
    regex: /^AI/,
    message: 'must start with "AI".',
  },
  OPENROUTER_API_KEY: {
    regex: /^sk-or-/,
    message: 'must start with "sk-or-".',
  },
};

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
  const invalidReasons = new Map<string, string>();
  const projectEnvLabel = 'project .env';
  const homeEnvLabel = '~/.vibe-check/.env';

  const validateProviderKey = (key: string, value: string): string | null => {
    const rule = PROVIDER_VALIDATIONS[key];
    if (!rule) {
      return null;
    }
    if (rule.regex.test(value)) {
      return null;
    }
    return `Invalid ${key}: ${rule.message}`;
  };

  const registerValue = (key: string, value: string, sourceLabel: string | null): boolean => {
    const normalized = value.trim();
    const error = validateProviderKey(key, normalized);
    if (error) {
      const context = sourceLabel ? `${error} (from ${sourceLabel})` : error;
      invalidReasons.set(key, context);
      return false;
    }

    invalidReasons.delete(key);
    process.env[key] = normalized;
    resolved.add(key);
    return true;
  };

  const hydrateFrom = (
    key: string,
    source: Record<string, string>,
    label: string | null,
  ): boolean => {
    if (key in source) {
      return registerValue(key, source[key], label);
    }
    return false;
  };

  for (const key of targetKeys) {
    if (process.env[key]) {
      if (registerValue(key, process.env[key] as string, 'environment variable')) {
        continue;
      }
      delete process.env[key];
    }

    if (hydrateFrom(key, cwdValues, projectEnvLabel)) {
      continue;
    }

    if (hydrateFrom(key, homeValues, homeEnvLabel)) {
      continue;
    }
  }

  const missing = targetKeys.filter((key) => !resolved.has(key));

  if (missing.length === 0 && invalidReasons.size === 0) {
    return { wrote: false };
  }

  if (!options.interactive) {
    if (invalidReasons.size > 0) {
      for (const message of invalidReasons.values()) {
        console.log(message);
      }
      const invalidKeys = [...invalidReasons.keys()];
      // If we have at least one valid provider and no required keys, only report invalid keys
      if (!requiredKeys && resolved.size > 0) {
        return { wrote: false, missing: invalidKeys };
      }
      // Otherwise report both invalid and missing keys
      return { wrote: false, missing: [...new Set([...invalidKeys, ...missing])] };
    }
    if (!requiredKeys && resolved.size > 0) {
      // At least one provider is configured and valid, we're good
      return { wrote: false };
    }
    if (requiredKeys) {
      console.log(`Missing required API keys: ${missing.join(', ')}`);
      return { wrote: false, missing: [...missing] };
    }

    console.log(`No provider API keys detected. Set one of: ${targetKeys.join(', ')}`);
    console.log('Provide it via your shell or .env file, then re-run with --non-interactive.');
    return { wrote: false, missing: [...targetKeys] };
  }

  if (!requiredKeys && resolved.size > 0 && invalidReasons.size === 0) {
    return { wrote: false };
  }

  const targetPath = options.local ? resolve(process.cwd(), '.env') : resolve(homeConfigDir(), '.env');
  const targetValues = options.local ? cwdValues : homeValues;
  const targetLabel = options.local ? projectEnvLabel : homeEnvLabel;
  const prompter = options.prompt;

  let rl: any = null;
  const ask = async (key: string): Promise<string> => {
    if (prompter) {
      console.log(`[${targetLabel}] Enter value for ${key} (leave blank to skip):`);
      return prompter(key);
    }

    if (!rl) {
      rl = createInterface({ input, output });
    }

    const answer = await rl.question(`[${targetLabel}] Enter value for ${key} (leave blank to skip): `);
    return answer;
  };

  const newEntries: Record<string, string> = {};
  const invalidKeys = [...invalidReasons.keys()];
  const promptedKeys = requiredKeys ?? [...new Set([...invalidKeys, ...missing])];
  let providedAny = false;

  if (invalidReasons.size > 0) {
    for (const message of invalidReasons.values()) {
      console.log(`${message} Please provide a new value.`);
    }
  }

  let stopPrompting = false;

  try {
    for (const key of promptedKeys) {
      if (stopPrompting) {
        break;
      }
      while (true) {
        const value = (await ask(key)).trim();
        if (!value) {
          if (requiredKeys) {
            break;
          }
          break;
        }

        const error = validateProviderKey(key, value);
        if (error) {
          console.log(`${error} Please try again.`);
          continue;
        }

        process.env[key] = value;
        targetValues[key] = value;
        newEntries[key] = value;
        resolved.add(key);
        invalidReasons.delete(key);
        providedAny = true;

        if (!requiredKeys) {
          stopPrompting = true;
        }
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
