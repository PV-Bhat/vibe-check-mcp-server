import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';
import semver from 'semver';
import { homeConfigDir } from './env.js';

export function checkNodeVersion(requiredRange: string): { ok: boolean; current: string } {
  const currentRaw = process.version.startsWith('v') ? process.version.slice(1) : process.version;
  const ok = semver.satisfies(currentRaw, requiredRange, { includePrerelease: true });
  return { ok, current: currentRaw };
}

export async function portStatus(port: number): Promise<'free' | 'in-use' | 'unknown'> {
  return new Promise((resolve) => {
    const server = createServer();

    const cleanup = (status: 'free' | 'in-use' | 'unknown') => {
      server.removeAllListeners('error');
      server.removeAllListeners('listening');
      resolve(status);
    };

    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        cleanup('in-use');
        return;
      }

      cleanup('unknown');
    });

    server.once('listening', () => {
      server.close(() => cleanup('free'));
    });

    try {
      server.listen(port, '0.0.0.0');
    } catch {
      cleanup('unknown');
    }
  });
}

export function detectEnvFiles(): { cwdEnv: string | null; homeEnv: string | null } {
  const cwdEnvPath = join(process.cwd(), '.env');
  const homeEnvPath = join(homeConfigDir(), '.env');

  return {
    cwdEnv: existsSync(cwdEnvPath) ? cwdEnvPath : null,
    homeEnv: existsSync(homeEnvPath) ? homeEnvPath : null,
  };
}
