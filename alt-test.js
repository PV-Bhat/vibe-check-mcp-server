
import fs from 'fs';

const request = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
        name: 'vibe_check',
        arguments: {
            goal: 'Test session history functionality',
            plan: '2. Make a second call to verify history is included.',
            userPrompt: 'Please test the history feature.',
            progress: 'Just made the second call.',
            sessionId: 'history-test-session-1'
        }
    },
    id: 2
});

fs.writeFileSync('request.json', request, 'utf-8');

console.log('Generated request.json for the second call.');
