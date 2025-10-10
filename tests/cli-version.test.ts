import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('CLI version', () => {
  it('prints the package version', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = resolve(__dirname, '..');
    const cliPath = resolve(projectRoot, 'build', 'cli', 'index.js');
    expect(existsSync(cliPath)).toBe(true);

    const output = execFileSync('node', [cliPath, '--version'], { encoding: 'utf8' }).trim();
    const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')) as { version: string };

    expect(output).toBe(pkg.version);
  });
});
