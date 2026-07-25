
import fs from 'fs';

const request = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
        name: 'vibe_check',
        arguments: {
            goal: 'Test OpenAI provider',
            plan: '1. Make a call to vibe_check using the OpenAI provider.',
            modelOverride: { 
              provider: 'openai',
              model: 'gpt-5.6-terra'
            }
        }
    },
    id: 1
});

fs.writeFileSync('request.json', request, 'utf-8');

console.log('Generated request.json for the OpenAI test.');
