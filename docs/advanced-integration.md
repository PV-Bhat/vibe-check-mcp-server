# Advanced Integration Techniques

For optimal metacognitive oversight, these advanced integration strategies leverage the full power of Vibe Check as a pattern interrupt system, recalibration mechanism, and self-improving feedback loop. Starting with v2.2, previous vibe_check output is automatically summarized and fed back into subsequent calls, so a `sessionId` is recommended for continuity.

## HTTP Transport Negotiation

The HTTP transport negotiates response modes per request. JSON fallbacks are now request-scoped, so a legacy client that only advertises `application/json` receives a direct JSON reply without mutating the transport for concurrent SSE subscribers. Streaming clients that include `text/event-stream` in `Accept` continue to receive live SSE frames even when JSON-only calls are running in parallel.

## Progressive Confidence Levels

Start with lower confidence values (e.g., 0.5) during planning phases and increase confidence (e.g., 0.7-0.9) during implementation and review phases. This adjusts the intensity of pattern interrupts to match the current stage of development.

```javascript
// Planning phase - lower confidence for more thorough questioning
vibe_check({
  phase: "planning",
  confidence: 0.5,
  userRequest: "...",
  plan: "..."
})

// Implementation phase - higher confidence for focused feedback
vibe_check({
  phase: "implementation",
  confidence: 0.7,
  userRequest: "...",
  plan: "..."
})

// Review phase - highest confidence for minimal, high-impact feedback
vibe_check({
  phase: "review",
  confidence: 0.9,
  userRequest: "...",
  plan: "..."
})
```

## Feedback Chaining

Incorporate previous vibe_check feedback in subsequent calls using the `previousAdvice` parameter to build a coherent metacognitive narrative. This creates a more sophisticated pattern interrupt system that builds on past insights.

```javascript
const initialFeedback = await vibe_check({
  phase: "planning",
  userRequest: "...",
  plan: "..."
});

// Later, include previous feedback
const followupFeedback = await vibe_check({
  phase: "implementation",
  previousAdvice: initialFeedback,
  userRequest: "...",
  plan: "..."
});
```

## Self-Improving Feedback Loop

Use vibe_learn consistently to build a pattern library specific to your agent's tendencies. This creates a self-improving system that gets better at identifying and preventing errors over time.

```javascript
// After resolving an issue
vibe_learn({
  mistake: "Relied on unnecessary complexity for simple data transformation",
  category: "Complex Solution Bias",
  solution: "Used built-in array methods instead of custom solution",
  type: "mistake"
});

// Later, the pattern library will improve vibe_check's pattern recognition
// allowing it to spot similar issues earlier in future workflows
```

## Hybrid Oversight Model

Combine automated pattern interrupts at predetermined checkpoints with ad-hoc checks when uncertainty or complexity increases.

```javascript
// Scheduled checkpoint at the end of planning
const scheduledCheck = await vibe_check({
  phase: "planning",
  userRequest: "...",
  plan: "..."
});

// Ad-hoc check when complexity increases
if (measureComplexity(currentPlan) > THRESHOLD) {
  const adHocCheck = await vibe_check({
    phase: "implementation",
    userRequest: "...",
    plan: "...",
    focusAreas: ["complexity", "simplification"]
  });
}
```

## Complete Integration Example

Here's a comprehensive implementation example for integrating Vibe Check as a complete metacognitive system:

```javascript
// During planning phase
const planFeedback = await vibe_check({
  phase: "planning",
  confidence: 0.5,
  userRequest: "[COMPLETE USER REQUEST]",
  plan: "[AGENT'S INITIAL PLAN]"
});

// Consider feedback and potentially adjust plan
const updatedPlan = adjustPlanBasedOnFeedback(initialPlan, planFeedback);

// If plan seems overly complex, manually simplify before continuing
let finalPlan = updatedPlan;
if (planComplexity(updatedPlan) > COMPLEXITY_THRESHOLD) {
  finalPlan = simplifyPlan(updatedPlan);
}

// During implementation, create pattern interrupts before major actions
const implementationFeedback = await vibe_check({
  phase: "implementation",
  confidence: 0.7,
  previousAdvice: planFeedback,
  userRequest: "[COMPLETE USER REQUEST]",
  plan: `I'm about to [DESCRIPTION OF PENDING ACTION]`
});

// After completing the task, build the self-improving feedback loop
if (mistakeIdentified) {
  await vibe_learn({
    mistake: "Specific mistake description",
    category: "Complex Solution Bias", // or appropriate category
    solution: "How it was corrected",
    type: "mistake"
  });
}
```

This integrated approach creates a complete metacognitive system that provides pattern interrupts when needed, recalibration anchor points when complexity increases, and a self-improving feedback loop that gets better over time.