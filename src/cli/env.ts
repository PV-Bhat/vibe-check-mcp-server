import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import os from 'node:os';

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
