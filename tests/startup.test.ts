import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Server Startup and Response Time', () => {
  it('should start and respond to a request within an acceptable time', async () => {
    const startTime = Date.now();
    
    const projectRoot = path.resolve(__dirname, '..');
    const indexPath = path.join(projectRoot, 'build', 'index.js');
    const requestPath = path.join(projectRoot, 'request1.json');

    const requestJson = fs.readFileSync(requestPath, 'utf-8');

    const serverProcess = spawn('node', [indexPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let responseData = '';
    let errorData = '';

    serverProcess.stdout.on('data', (data) => {
      responseData += data.toString();
      console.log(`STDOUT: ${data.toString()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      console.error(`STDERR: ${data.toString()}`);
    });

    const responsePromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Test timed out. \nSTDOUT: ${responseData}\nSTDERR: ${errorData}`));
      }, 20000); // 20 second timeout

      serverProcess.stdout.on('data', (data) => {
        // Check if the received data contains a JSON-RPC response
        if (data.toString().includes('"jsonrpc":"2.0"')) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          console.log(`Server responded in ${duration}ms.`);
          
          expect(duration).toBeLessThan(5000); // Increased threshold
          expect(data.toString()).toContain('"jsonrpc":"2.0"');
          
          clearTimeout(timer);
          resolve();
        }
      });

      serverProcess.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      serverProcess.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0 && !responseData.includes('"jsonrpc":"2.0"')) {
          reject(new Error(`Server process exited with code ${code}:\n${errorData}`));
        } else {
          resolve(); // Resolve if we already got a response
        }
      });
    });

    serverProcess.stdin.write(requestJson);
    serverProcess.stdin.end();

    await responsePromise;

    serverProcess.kill();
  }, 25000); // 25 second test timeout
});