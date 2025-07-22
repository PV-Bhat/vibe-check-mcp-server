import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function main() {
  const transport = new StdioClientTransport({ command: 'node', args: ['build/index.js'] });
  const client = new Client({ transport });

  const request = {
    name: 'vibe_check',
    arguments: {
      goal: 'Implement the core logic for the new feature',
      plan: '1. Define the data structures. 2. Implement the main algorithm. 3. Add error handling.',
      userPrompt: 'Create a new feature that does X, Y, and Z.',
      progress: 'Just started',
      uncertainties: ['The third-party API might be unreliable'],
      taskContext: 'This is part of a larger project to refactor the billing module.',
      sessionId: 'test-session-123',
    },
  };

  try {
    await client.connect();
    const response = await client.callTool(request.name, request.arguments);
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    transport.destroy();
  }
}

main();