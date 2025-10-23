import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['build/index.js'],
    stderr: 'pipe',
  });

  const stderr = transport.stderr;
  if (stderr) {
    stderr.on('data', (chunk) => process.stderr.write(chunk));
  }

  const responsePromise = new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for server response'));
    }, 10_000);

    transport.onmessage = (message) => {
      clearTimeout(timeout);
      resolve(message);
    };

    transport.onerror = (error) => {
      clearTimeout(timeout);
      reject(error);
    };
  });

  await transport.start();

  const requestId = Date.now();
  const request = {
    jsonrpc: '2.0' as const,
    id: requestId,
    method: 'tools/call',
    params: {
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
    },
  } satisfies Record<string, unknown>;

  await transport.send(request);

  const response = await responsePromise;
  console.log('Response:', JSON.stringify(response, null, 2));

  await transport.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
