import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, afterAll } from 'vitest';
import { mergeMcpEntry, writeClaudeConfigAtomic } from '../src/cli/clients/claude.js';

const SENTINEL = 'vibe-check-mcp-cli';
const ENTRY = {
  command: 'npx',
  args: ['@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
  env: {},
  managedBy: SENTINEL,
};

async function readFixture(name: string): Promise<any> {
  const path = join(process.cwd(), 'tests', 'fixtures', 'claude', name);
  const raw = await fs.readFile(path, 'utf8');
  return JSON.parse(raw);
}

describe('mergeMcpEntry', () => {
  it('appends managed entry when missing', async () => {
    const base = await readFixture('config.base.json');
    const result = mergeMcpEntry(base, ENTRY, { id: 'vibe-check-mcp', sentinel: SENTINEL });

    expect(result.changed).toBe(true);
    expect(result.next).toMatchInlineSnapshot(`
      {
        "mcpServers": {
          "vibe-check-mcp": {
            "args": [
              "@pv-bhat/vibe-check-mcp",
              "start",
              "--stdio",
            ],
            "command": "npx",
            "env": {},
            "managedBy": "vibe-check-mcp-cli",
          },
        },
        "theme": "system",
      }
    `);
  });

  it('updates existing managed entry', async () => {
    const base = await readFixture('config.with-managed-entry.json');
    const updatedEntry = {
      ...ENTRY,
      args: ['@pv-bhat/vibe-check-mcp', 'start', '--stdio', '--http'],
    };

    const result = mergeMcpEntry(base, updatedEntry, { id: 'vibe-check-mcp', sentinel: SENTINEL });

    expect(result.changed).toBe(true);
    expect(result.next.mcpServers['vibe-check-mcp'].args).toEqual(updatedEntry.args);
    expect(result.next.mcpServers.other).toEqual(base.mcpServers.other);
  });

  it('does not modify unmanaged entries', async () => {
    const base = await readFixture('config.with-other-servers.json');
    const result = mergeMcpEntry(base, ENTRY, { id: 'vibe-check-mcp', sentinel: SENTINEL });

    expect(result.changed).toBe(false);
    expect(result.reason).toBe('existing entry without sentinel');
  });
});

describe('writeClaudeConfigAtomic', () => {
  const tempDirs: string[] = [];

  afterAll(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('creates a backup and writes new config', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'claude-config-'));
    tempDirs.push(dir);
    const configPath = join(dir, 'claude_desktop_config.json');

    const base = await readFixture('config.with-managed-entry.json');
    await fs.writeFile(configPath, `${JSON.stringify(base, null, 2)}\n`);

    const merged = mergeMcpEntry(base, ENTRY, { id: 'vibe-check-mcp', sentinel: SENTINEL });
    await writeClaudeConfigAtomic(configPath, merged.next);

    const files = await fs.readdir(dir);
    const backup = files.find((file) => file.endsWith('.bak'));
    expect(backup).toBeDefined();

    const finalRaw = await fs.readFile(configPath, 'utf8');
    expect(JSON.parse(finalRaw)).toEqual(merged.next);

    const backupRaw = await fs.readFile(join(dir, backup!), 'utf8');
    expect(JSON.parse(backupRaw)).toEqual(base);
  });
});
