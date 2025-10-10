import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import net from 'node:net';
import { parse as parseEnv } from 'dotenv';
import semver from 'semver';
import { homeConfigDir } from './env.js';

export function checkNodeVersion(requiredRange: string, currentVersion: string = process.version): {
  ok: boolean;
  current: string;
} {
  const current = currentVersion;
  const coerced = semver.coerce(current);
  const satisfies = coerced ? semver.satisfies(coerced, requiredRange) : false;
  return {
    ok: satisfies,
    current,
  };
}

export async function portStatus(port: number): Promise<'free' | 'in-use' | 'unknown'> {
  return new Promise((resolveStatus) => {
    const tester = net.createServer();

    tester.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        resolveStatus('in-use');
      } else {
        resolveStatus('unknown');
      }
    });

    tester.once('listening', () => {
      tester.close(() => resolveStatus('free'));
    });

    try {
      tester.listen({ port, host: '127.0.0.1' });
    } catch {
      resolveStatus('unknown');
    }
  });
}

export function detectEnvFiles(): {
  cwdEnv: string | null;
  homeEnv: string | null;
} {
  const cwdEnvPath = resolve(process.cwd(), '.env');
  const homeEnvPath = resolve(homeConfigDir(), '.env');

  return {
    cwdEnv: existsSync(cwdEnvPath) ? cwdEnvPath : null,
    homeEnv: existsSync(homeEnvPath) ? homeEnvPath : null,
  };
}

export function readEnvFile(path: string): Record<string, string> {
  const raw = readFileSync(path, 'utf8');
  return parseEnv(raw);
}
