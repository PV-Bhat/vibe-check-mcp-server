# Agent Prompting Guide

Treat `vibe_check` as a collaborative debugger. It works best when given the current goal, plan and original user request. Use the same `sessionId` for related calls so the mentor can reference prior feedback.

Example workflow:
1. Plan your approach.
2. Call `vibe_check` with the plan and user request.
3. Adjust your strategy based on the questions returned.
4. Optionally log resolved issues with `vibe_learn`.

Keep the tone conversational. The goal is to surface blind spots and encourage simpler, user‑aligned solutions.
