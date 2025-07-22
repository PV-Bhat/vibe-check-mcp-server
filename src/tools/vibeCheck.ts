import { getMetacognitiveQuestions } from '../utils/llm.js';
import { addToHistory, getHistorySummary } from '../utils/state.js';

// Vibe Check tool handler
export interface VibeCheckInput {
  goal: string;
  plan: string;
  modelOverride?: {
    provider?: string;
    model?: string;
  };
  userPrompt?: string;
  progress?: string;
  uncertainties?: string[];
  taskContext?: string;
  sessionId?: string;
}

export interface VibeCheckOutput {
  questions: string;
}

/**
 * The vibe_check tool provides metacognitive questioning to identify assumptions
 * and break tunnel vision, focusing on simplicity and user alignment.
 * 
 * The userRequest parameter is REQUIRED and must contain the FULL original user request
 * to ensure proper alignment checking.
 * 
 * New dynamic parameters:
 * - previousAdvice: Optional previous feedback to avoid repetition
 * - phase: Optional indicator of project phase (planning/implementation/review)
 * - confidence: Optional agent confidence level (0-1)
 */
export async function vibeCheckTool(input: VibeCheckInput): Promise<VibeCheckOutput> {
  console.log('vibeCheckTool called with input:', input);
  try {
    // Get history summary
    const historySummary = getHistorySummary(input.sessionId);

    // Get metacognitive questions from Gemini with dynamic parameters
    const response = await getMetacognitiveQuestions({
      goal: input.goal,
      plan: input.plan,
      modelOverride: input.modelOverride,
      userPrompt: input.userPrompt,
      progress: input.progress,
      uncertainties: input.uncertainties,
      taskContext: input.taskContext,
      sessionId: input.sessionId,
      historySummary,
    });

    // Add to history
    addToHistory(input.sessionId, input, response.questions);

    return {
      questions: response.questions,
    };
  } catch (error) {
    console.error('Error in vibe_check tool:', error);

    // Fallback to basic questions if there's an error
    return {
      questions: generateFallbackQuestions(input.userPrompt || "", input.plan || ""),
    };
  }
}

/**
 * Generate adaptive fallback questions when API fails
 */
function generateFallbackQuestions(userRequest: string, plan: string): string {
    return `
I can see you're thinking through your approach, which shows thoughtfulness:

1. Does this plan directly address what the user requested, or might it be solving a different problem?
2. Is there a simpler approach that would meet the user's needs?
3. What unstated assumptions might be limiting the thinking here?
4. How does this align with the user's original intent?
`;
}