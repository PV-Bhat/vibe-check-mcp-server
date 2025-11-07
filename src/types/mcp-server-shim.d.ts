declare module '@modelcontextprotocol/sdk/server/mcp' {
  import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

  export class McpServer {
    readonly server: Server;
    constructor(...args: any[]);
    connect(...args: any[]): Promise<void>;
    close(): Promise<void>;
    tool(...args: any[]): any;
    prompt(...args: any[]): any;
    resource(...args: any[]): any;
  }
}
