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

const locateWindsurfConfig = async (customPath?: string): Promise<string | null> => {
  if (customPath) {
    return expandHomePath(customPath);
  }

  const home = os.homedir();
  const legacy = join(home, '.codeium', 'windsurf', 'mcp_config.json');
  if (await pathExists(legacy)) {
    return legacy;
  }

  const modern = join(home, '.codeium', 'mcp_config.json');
  if (await pathExists(modern)) {
    return modern;
  }

  return null;
};

const readWindsurfConfig = async (path: string, raw?: string): Promise<JsonRecord> => {
  return readJsonFile(path, raw);
};

const mergeWindsurfEntry = (config: JsonRecord, entry: JsonRecord, options: MergeOpts): MergeResult => {
  if (options.transport === 'http') {
    const httpEntry: JsonRecord = {
      serverUrl: options.httpUrl ?? 'http://127.0.0.1:2091',
    };
    return mergeIntoMap(config, httpEntry, options, 'mcpServers');
  }

  const stdioEntry: JsonRecord = {
    command: entry.command,
    args: entry.args,
    env: entry.env ?? {},
  };

  return mergeIntoMap(config, stdioEntry, options, 'mcpServers');
};

const writeWindsurfConfigAtomic = async (path: string, data: JsonRecord): Promise<void> => {
  await writeJsonFileAtomic(path, data);
};

const adapter: ClientAdapter = {
  locate: locateWindsurfConfig,
  read: readWindsurfConfig,
  merge: mergeWindsurfEntry,
  writeAtomic: writeWindsurfConfigAtomic,
  describe() {
    return {
      name: 'Windsurf',
      pathHint: '~/.codeium/windsurf/mcp_config.json',
      summary: 'Codeium Windsurf IDE with stdio and HTTP MCP transports.',
      transports: ['stdio', 'http'],
      defaultTransport: 'stdio',
      notes: 'Newer builds use ~/.codeium/mcp_config.json. Create an empty file to opt-in.',
      docsUrl: 'https://docs.codeium.com/windsurf/model-context-protocol',
    };
  },
};

export default adapter;
