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

const locateCursorConfig = async (customPath?: string): Promise<string | null> => {
  if (customPath) {
    return expandHomePath(customPath);
  }

  const home = os.homedir();
  const candidate = join(home, '.cursor', 'mcp.json');
  if (await pathExists(candidate)) {
    return candidate;
  }

  return null;
};

const readCursorConfig = async (path: string, raw?: string): Promise<JsonRecord> => {
  return readJsonFile(path, raw);
};

const mergeCursorEntry = (config: JsonRecord, entry: JsonRecord, options: MergeOpts): MergeResult => {
  return mergeIntoMap(config, entry, options, 'mcpServers');
};

const writeCursorConfigAtomic = async (path: string, data: JsonRecord): Promise<void> => {
  await writeJsonFileAtomic(path, data);
};

const adapter: ClientAdapter = {
  locate: locateCursorConfig,
  read: readCursorConfig,
  merge: mergeCursorEntry,
  writeAtomic: writeCursorConfigAtomic,
  describe() {
    return {
      name: 'Cursor',
      pathHint: '~/.cursor/mcp.json',
      summary: 'Cursor IDE with Claude-style MCP configuration.',
      transports: ['stdio'],
      defaultTransport: 'stdio',
      notes: 'Open Cursor Settings → MCP Servers if the file does not exist yet.',
      docsUrl: 'https://docs.cursor.com/ai/model-context-protocol',
    };
  },
};

export default adapter;
