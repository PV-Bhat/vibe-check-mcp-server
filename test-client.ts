import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testVibeCheck() {
  const serverProcess = spawn('node', ['build/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });

  await new Promise(resolve => setTimeout(resolve, 1000));

  const transport = new StdioClientTransport(serverProcess);
  const client = new Client(transport);

  const response = await client.tool('vibe_check', { goal: 'Test goal', plan: 'Test plan', progress: 'Initial stage' });

  console.log('Response:', response);

  await transport.close();
  serverProcess.kill();
}

testVibeCheck();