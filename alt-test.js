import { spawn } from 'child_process';
import fs from 'fs';

const request = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
        name: 'vibe_check',
        arguments: {
            goal: 'Test goal',
            plan: 'Test plan',
            progress: 'Test progress'
        }
    },
    id: 1
});

fs.writeFileSync('request.json', request);
