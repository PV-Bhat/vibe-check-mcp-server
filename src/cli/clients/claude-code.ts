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

const locateClaudeCodeConfig = async (customPath?: string): Promise<string | null> => {
  if (customPath) {
    return expandHomePath(customPath);
  }

  const home = os.homedir();
  const candidates: string[] = [];

  if (process.platform === 'darwin') {
    candidates.push(join(home, 'Library', 'Application Support', 'Claude', 'claude_code_config.json'));
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) {
      candidates.push(join(appData, 'Claude', 'claude_code_config.json'));
    }
  } else {
    const xdgConfig = process.env.XDG_CONFIG_HOME;
    if (xdgConfig) {
      candidates.push(join(xdgConfig, 'Claude', 'claude_code_config.json'));
    }
    candidates.push(join(home, '.config', 'Claude', 'claude_code_config.json'));
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
};

const readClaudeCodeConfig = async (path: string, raw?: string): Promise<JsonRecord> => {
  return readJsonFile(path, raw, 'Claude Code config');
};

const writeClaudeCodeConfigAtomic = async (path: string, data: JsonRecord): Promise<void> => {
  await writeJsonFileAtomic(path, data);
};

const mergeClaudeCodeEntry = (config: JsonRecord, entry: JsonRecord, options: MergeOpts): MergeResult => {
  return mergeIntoMap(config, entry, options, 'mcpServers');
};

const adapter: ClientAdapter = {
  locate: locateClaudeCodeConfig,
  read: readClaudeCodeConfig,
  merge: mergeClaudeCodeEntry,
  writeAtomic: writeClaudeCodeConfigAtomic,
  describe() {
    return {
      name: 'Claude Code',
      pathHint: '~/.config/Claude/claude_code_config.json',
      summary: 'Anthropic\'s Claude Code CLI agent configuration.',
      transports: ['stdio'],
      defaultTransport: 'stdio',
      requiredEnvKeys: ['ANTHROPIC_API_KEY'],
      notes: 'Run `claude code login` once to scaffold the config file.',
      docsUrl: 'https://docs.anthropic.com/en/docs/agents/claude-code',
    };
  },
};

export default adapter;
