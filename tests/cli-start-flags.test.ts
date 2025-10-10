import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const cliPath = resolve(projectRoot, 'build', 'cli', 'index.js');

describe('CLI start command flags', () => {
  it('--stdio --dry-run prints MCP_TRANSPORT=stdio', () => {
    const output = execFileSync('node', [cliPath, 'start', '--stdio', '--dry-run'], {
      encoding: 'utf8',
    });

    expect(output).toContain('MCP_TRANSPORT=stdio');
  });

  it('--http --port 1234 --dry-run prints HTTP overrides', () => {
    const output = execFileSync('node', [cliPath, 'start', '--http', '--port', '1234', '--dry-run'], {
      encoding: 'utf8',
    });

    expect(output).toContain('MCP_TRANSPORT=http');
    expect(output).toContain('MCP_HTTP_PORT=1234');
  });
});

