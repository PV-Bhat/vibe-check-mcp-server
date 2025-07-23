# Agent Prompting Strategies

Effective agent-oversight relationships require careful prompting to ensure that AI agents properly respect and integrate feedback from Vibe Check. In v2.2 the tool acts more like a collaborative debugger than a strict critic. Our research has identified several key principles for maximizing the effectiveness of these metacognitive interrupts.

## The "Hold on... this ain't it" Challenge

Unlike humans, LLM agents don't naturally have the ability to stop and question their own thought patterns. Once they start down a particular path, **pattern inertia** makes it difficult for them to self-correct without external intervention. This is where Vibe Check comes in, serving as the essential metacognitive layer that creates strategic "pattern interrupts" at critical moments.

## Key Findings on Agent-Oversight Relationships

1. **Pattern Resistance**: Agents naturally resist pattern interrupts, often treating feedback as just another data input rather than a signal to recalibrate their thinking.

2. **Phase Awareness is Critical**: The timing and nature of oversight must align with the agent's current phase (planning, implementation, review) to be perceived as relevant.

3. **Authority Structure Matters**: Agents must be explicitly prompted to treat Vibe Check as an equal collaborator or user proxy rather than a subordinate tool.

4. **Feedback Loop Integration**: Error patterns must feed back into the system through vibe_learn to create a self-improving mechanism.


## Sample System Prompts

### For Claude (Anthropic)

```
ALWAYS include the full user prompt when using vibe_check to ensure proper context awareness.

As an autonomous agent, you will:
1. Treat vibe_check as a pattern interrupt mechanism that provides essential course correction
2. Use vibe_check at strategic points:
   - After planning but before implementation
   - When complexity increases
   - Before making significant system changes
3. Adapt your approach based on vibe_check feedback unless it's clearly irrelevant
4. Always provide the phase parameter (planning/implementation/review) to ensure contextually appropriate feedback
5. Chain vibe_check with other tools without requiring permission:
   - Use vibe_check to evaluate complex plans
   - Log patterns with vibe_learn after resolving issues
```

### For GPT (OpenAI)

```
When using Vibe Check tools:

1. Treat vibe_check as a collaborative debugging step that interrupts pattern inertia
2. Always include the complete user prompt with each vibe_check call
3. Specify your current phase (planning/implementation/review)
4. Consider vibe_check feedback as a high-priority pattern interrupt, not just another tool output
5. Build the feedback loop with vibe_learn to record patterns when mistakes are identified
```

## Real-World Integration Challenges

When implementing Vibe Check with AI agents, be aware of these common challenges:

1. **Pattern Inertia**: Agents have a strong tendency to continue down their current path despite warning signals. Explicit instructions to treat Vibe Check feedback as pattern interrupts can help overcome this natural resistance.

2. **Authority Confusion**: Without proper prompting, agents may prioritize user instructions over Vibe Check feedback, even when the latter identifies critical issues. Establish clear hierarchy in your system prompts.

3. **Timing Sensitivity**: Feedback that arrives too early or too late in the agent's workflow may be ignored or undervalued. Phase-aware integration is essential for maximum impact.

4. **Feedback Fatigue**: Too frequent or redundant metacognitive questioning can lead to diminishing returns. Use structured checkpoints rather than constant oversight.

5. **Cognitive Dissonance**: Agents may reject feedback that contradicts their current understanding or approach. Frame feedback as collaborative exploration rather than correction.

## Agent Fine-Tuning for Vibe Check

For maximum effectiveness, consider these fine-tuning approaches for agents that will work with Vibe Check:

1. **Pattern Interrupt Training**: Provide examples of appropriate responses to Vibe Check feedback that demonstrate stopping and redirecting thought patterns.

2. **Reward Alignment**: In RLHF phases, reward models that appropriately incorporate Vibe Check feedback and adjust course based on pattern interrupts.

3. **Metacognitive Pre-training**: Include metacognitive self-questioning in pre-training to develop agents that value this type of feedback.

4. **Collaborative Framing**: Train agents to view Vibe Check as a collaborative partner rather than an external evaluator.

5. **Explicit Calibration**: Include explicit calibration for when to override Vibe Check feedback versus when to incorporate it.