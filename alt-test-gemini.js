
import fs from 'fs';

const request = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
        name: 'vibe_check',
        arguments: {
            goal: 'Test default Gemini provider',
            plan: '2. Make a call to vibe_check using the default Gemini provider.',
        }
    },
    id: 2
});

fs.writeFileSync('request.json', request, 'utf-8');

console.log('Generated request.json for the Gemini test.');
