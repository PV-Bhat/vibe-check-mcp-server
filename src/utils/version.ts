import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let cachedVersion: string | null = null;

export function getPackageVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }

  const pkg = require('../../package.json') as { version?: string };
  const version = pkg?.version;

  if (!version) {
    throw new Error('Package version is missing from package.json');
  }

  cachedVersion = version;
  return cachedVersion;
}
