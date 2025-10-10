import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import dotenv from 'dotenv';

export function homeConfigDir(): string {
  return join(homedir(), '.vibe-check');
}

export type EnvSources = {
  cwdEnv: string | null;
  homeEnv: string | null;
  processEnv: NodeJS.ProcessEnv;
};

export function resolveEnvSources(): EnvSources {
  const cwdEnvPath = join(process.cwd(), '.env');
  const homeEnvPath = join(homeConfigDir(), '.env');

  return {
    cwdEnv: existsSync(cwdEnvPath) ? cwdEnvPath : null,
    homeEnv: existsSync(homeEnvPath) ? homeEnvPath : null,
    processEnv: process.env,
  };
}

export function loadEnvFromSources(sources: EnvSources): Record<string, string> {
  const loaded: Record<string, string> = {};

  const load = (path: string | null) => {
    if (!path) {
      return;
    }

    try {
      const parsed = dotenv.parse(readFileSync(path));
      Object.assign(loaded, parsed);
    } catch {
      // Ignore errors from missing/invalid env files; doctor command will report presence separately.
    }
  };

  load(sources.homeEnv);
  load(sources.cwdEnv);

  return loaded;
}

