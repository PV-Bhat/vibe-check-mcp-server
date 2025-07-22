# Advanced Integration

For full control you can override the LLM provider per call:
```javascript
vibe_check({
  goal: 'Refactor module',
  plan: '...',
  modelOverride: { provider: 'openai', model: 'gpt-3.5-turbo' }
});
```
Use `sessionId` to maintain history across calls. Combine `vibe_check` with `vibe_learn` to build a knowledge base of past mistakes. The stored patterns can optionally be summarized into future prompts when `USE_LEARNING_HISTORY=true`.
