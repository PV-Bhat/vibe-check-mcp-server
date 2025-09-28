/**
 * Example CPI integration stub for VibeCheck MCP.
 *
 * Wire this into your agent orchestrator to forward VibeCheck signals to a CPI policy.
 */

export interface AgentSnapshot {
  sessionId: string;
  summary: string;
  nextAction: string;
  done?: boolean;
}

export interface ResumeSignal {
  reason: string;
  followUp?: string;
}

export interface AgentStepCallback {
  (input: { resumeSignal?: ResumeSignal }): Promise<AgentSnapshot>;
}

export interface VibeCheckSignal {
  riskScore: number;
  traits: string[];
  advice: string;
}

const RISK_THRESHOLD = 0.6;

const vibecheckShim = {
  // TODO: replace with an actual call to the VibeCheck MCP tool over MCP or HTTP.
  async analyze(snapshot: AgentSnapshot): Promise<VibeCheckSignal> {
    return {
      riskScore: Math.random(),
      traits: ['focus-drift'],
      advice: `Reflect on: ${snapshot.summary}`,
    };
  },
};

// TODO: replace with `import { createPolicy } from '@cpi/sdk';`
const cpiPolicyShim = {
  interrupt(input: { snapshot: AgentSnapshot; signal: VibeCheckSignal }) {
    if (input.signal.riskScore >= RISK_THRESHOLD) {
      return {
        action: 'interrupt' as const,
        reason: 'High metacognitive risk detected by VibeCheck',
      };
    }

    return { action: 'allow' as const };
  },
};

async function handleInterrupt(
  decision: { action: 'interrupt' | 'allow'; reason?: string },
  snapshot: AgentSnapshot,
): Promise<ResumeSignal | undefined> {
  if (decision.action === 'allow') {
    return undefined;
  }

  console.warn('[CPI] interrupting agent step:', decision.reason ?? 'policy requested pause');
  console.warn('Agent summary:', snapshot.summary);

  // TODO: replace with human-in-the-loop logic or CPI repro harness callback.
  return {
    reason: decision.reason ?? 'Paused for inspection',
    followUp: 'Agent acknowledged CPI feedback and is ready to resume.',
  };
}

export async function runWithCPI(agentStep: AgentStepCallback): Promise<void> {
  let resumeSignal: ResumeSignal | undefined;

  while (true) {
    const snapshot = await agentStep({ resumeSignal });

    if (snapshot.done) {
      console.log('Agent workflow completed.');
      break;
    }

    const signal = await vibecheckShim.analyze(snapshot);
    console.log('VibeCheck signal', signal);

    const decision = cpiPolicyShim.interrupt({ snapshot, signal });

    if (decision.action !== 'allow') {
      resumeSignal = await handleInterrupt(decision, snapshot);
      continue;
    }

    resumeSignal = undefined;
  }
}
