import { join } from 'node:path';
import os from 'node:os';
import {
  ClientAdapter,
  JsonRecord,
  MergeOpts,
  MergeResult,
  expandHomePath,
  mergeIntoMap,
  pathExists,
  readJsonFile,
  writeJsonFileAtomic,
} from './shared.js';

type LocateFn = (customPath?: string) => Promise<string | null>;

type ReadFn = (path: string, raw?: string) => Promise<JsonRecord>;

type MergeFn = (config: JsonRecord, entry: JsonRecord, options: MergeOpts) => MergeResult;

type WriteFn = (path: string, data: JsonRecord) => Promise<void>;

export const locateClaudeConfig: LocateFn = async (customPath) => {
  if (customPath) {
    return expandHomePath(customPath);
  }

  const home = os.homedir();
  const candidates: string[] = [];

  if (process.platform === 'darwin') {
    candidates.push(join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'));
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) {
      candidates.push(join(appData, 'Claude', 'claude_desktop_config.json'));
    }
  } else {
    const xdgConfig = process.env.XDG_CONFIG_HOME;
    if (xdgConfig) {
      candidates.push(join(xdgConfig, 'Claude', 'claude_desktop_config.json'));
    }
    candidates.push(join(home, '.config', 'Claude', 'claude_desktop_config.json'));
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const readClaudeConfig: ReadFn = async (path, raw) => {
  return readJsonFile(path, raw, 'Claude config');
};

export const writeClaudeConfigAtomic: WriteFn = async (path, data) => {
  await writeJsonFileAtomic(path, data);
};

export const mergeMcpEntry: MergeFn = (config, entry, options) => {
  return mergeIntoMap(config, entry, options, 'mcpServers');
};

const adapter: ClientAdapter = {
  locate: locateClaudeConfig,
  read: readClaudeConfig,
  merge: mergeMcpEntry,
  writeAtomic: writeClaudeConfigAtomic,
  describe() {
    return {
      name: 'Claude Desktop',
      pathHint: 'claude_desktop_config.json',
      summary: 'Claude Desktop app integration for Windows, macOS, and Linux.',
      transports: ['stdio'],
      defaultTransport: 'stdio',
      requiredEnvKeys: ['ANTHROPIC_API_KEY'],
      notes: 'Launch Claude Desktop once to generate the config file.',
      docsUrl: 'https://docs.anthropic.com/en/docs/claude-desktop/model-context-protocol',
    };
  },
};

export default adapter;
