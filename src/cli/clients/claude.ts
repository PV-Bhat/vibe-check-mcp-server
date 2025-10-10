import { constants as fsConstants } from 'node:fs';
import { access, copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import os from 'node:os';

const backupsCreated = new Set<string>();

export function claudeConfigCandidates(): string[] {
  const home = os.homedir();
  const paths: string[] = [];

  if (process.platform === 'darwin') {
    paths.push(join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'));
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming');
    paths.push(join(appData, 'Claude', 'claude_desktop_config.json'));
  } else {
    const xdgHome = process.env.XDG_CONFIG_HOME ?? join(home, '.config');
    paths.push(join(xdgHome, 'Claude', 'claude_desktop_config.json'));
    paths.push(join(home, '.config', 'Claude', 'claude_desktop_config.json'));
  }

  return paths;
}

export async function locateClaudeConfig(customPath?: string): Promise<string | null> {
  if (customPath) {
    return resolve(customPath);
  }

  for (const candidate of claudeConfigCandidates()) {
    try {
      await access(candidate, fsConstants.F_OK);
      return candidate;
    } catch {
      // Continue scanning
    }
  }

  return null;
}

export async function readClaudeConfig(path: string): Promise<any> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function ensureBackup(path: string): Promise<void> {
  if (backupsCreated.has(path)) {
    return;
  }

  try {
    await access(path, fsConstants.F_OK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw error;
  }

  const dir = dirname(path);
  const stamp = formatTimestamp(new Date());
  const backupName = `${basename(path)}.${stamp}.${process.pid}.bak`;
  const backupPath = join(dir, backupName);
  await mkdir(dir, { recursive: true });
  await copyFile(path, backupPath);
  backupsCreated.add(path);
}

export async function writeClaudeConfigAtomic(path: string, data: any): Promise<void> {
  await ensureBackup(path);

  const dir = dirname(path);
  const tempName = `${basename(path)}.${process.pid}.${Date.now()}.tmp`;
  const tempPath = join(dir, tempName);
  const serialized = `${JSON.stringify(data, null, 2)}\n`;

  await mkdir(dir, { recursive: true });
  await writeFile(tempPath, serialized, { mode: 0o600 });

  try {
    await rename(tempPath, path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') {
      await rm(path, { force: true });
      await rename(tempPath, path);
    } else {
      await rm(tempPath, { force: true });
      throw error;
    }
  }
}

type MergeOptions = {
  id: string;
  sentinel: string;
};

type MergeResult = {
  next: any;
  changed: boolean;
  reason?: string;
};

export function mergeMcpEntry(cfg: any, entry: any, options: MergeOptions): MergeResult {
  const { id, sentinel } = options;
  const baseConfig = cfg && typeof cfg === 'object' ? cfg : {};
  const nextConfig = Array.isArray(baseConfig) ? {} : JSON.parse(JSON.stringify(baseConfig));

  const currentServers = nextConfig.mcpServers && typeof nextConfig.mcpServers === 'object'
    ? { ...nextConfig.mcpServers }
    : {};

  const existing = currentServers[id];

  const managedEntry = { ...entry, managedBy: sentinel };

  if (existing) {
    if (existing.managedBy !== sentinel) {
      return {
        next: cfg,
        changed: false,
        reason: 'existing entry without sentinel',
      };
    }

    const serializedExisting = JSON.stringify(existing);
    const serializedNext = JSON.stringify(managedEntry);
    if (serializedExisting === serializedNext) {
      return { next: cfg, changed: false };
    }

    currentServers[id] = managedEntry;
    return {
      next: { ...nextConfig, mcpServers: currentServers },
      changed: true,
    };
  }

  currentServers[id] = managedEntry;
  return {
    next: { ...nextConfig, mcpServers: currentServers },
    changed: true,
  };
}
