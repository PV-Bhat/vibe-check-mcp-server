import fs from 'fs';

const request = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
        name: 'vibe_check',
        arguments: {
            goal: 'Test OAICompatible provider with custom endpoint',
            plan: '1. Make a call to vibe_check using the new OAICompatible provider.',
            modelOverride: {
                provider: 'oai-compatible',
                model: 'glm-4.6'
            }
        }
    },
    id: 4  // Next available ID after existing tests
});

fs.writeFileSync('request.json', request, 'utf-8');

console.log('Generated request.json for OAICompatible provider test.');
console.log('Note: Set OAICOMPATIBLE_API_KEY and OAICOMPATIBLE_BASE_URL before running.');
console.log('Example for iflow API:');
console.log('  OAICOMPATIBLE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
console.log('  OAICOMPATIBLE_BASE_URL=https://apis.iflow.cn/v1');