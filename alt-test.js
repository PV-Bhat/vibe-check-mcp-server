import fs from 'fs';

function createVibeCheckRequest(id, goal, plan, userPrompt, progress, sessionId) {
    return JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
            name: 'vibe_check',
            arguments: {
                goal: goal,
                plan: plan,
                userPrompt: userPrompt,
                progress: progress,
                sessionId: sessionId,
                modelOverride: {
                    provider: 'openrouter',
                    model: 'tngtech/deepseek-r1t2-chimera:free'
                }
            }
        },
        id: id
    });
}

const sessionId = 'history-test-session-phase4';

// First call
const request1 = createVibeCheckRequest(
    1,
    'Test new meta-mentor prompt and history functionality',
    '1. Make the first call to establish history.',
    'Please test the new meta-mentor prompt and history feature.',
    'Starting the test.',
    sessionId
);
fs.writeFileSync('request1.json', request1, 'utf-8');
console.log('Generated request1.json for the first call.');

// Second call
const request2 = createVibeCheckRequest(
    2,
    'Test new meta-mentor prompt and history functionality',
    '2. Make the second call to verify history is included and prompt tone.',
    'Please test the new meta-mentor prompt and history feature.',
    'Just made the second call, expecting history context.',
    sessionId
);
fs.writeFileSync('request2.json', request2, 'utf-8');
console.log('Generated request2.json for the second call.');