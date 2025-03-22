import { getMistakes } from '../utils/storage.js';
import { getMetacognitiveQuestions } from '../utils/gemini.js';

// Vibe Check tool handler
export interface VibeCheckInput {
  plan: string;
  userRequest: string; // Required
  thinkingLog?: string;
  availableTools?: string[];
  focusAreas?: string[];
  sessionId?: string;
  
  // New dynamic parameters
  previousAdvice?: string;
  phase?: 'planning' | 'implementation' | 'review';
  confidence?: number;
}

export interface VibeCheckOutput {
  questions: string;
  patternAlert?: string;
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
  try {
    // Validate required userRequest is present and not empty
    if (!input.userRequest || input.userRequest.trim() === '') {
      throw new Error('FULL user request is required to prevent bias and ensure alignment');
    }
    
    // Get past mistakes to inform questioning
    const mistakeHistory = getMistakes();
    
    // Get metacognitive questions from Gemini with dynamic parameters
    const response = await getMetacognitiveQuestions({
      plan: input.plan,
      userRequest: input.userRequest,
      thinkingLog: input.thinkingLog,
      availableTools: input.availableTools,
      focusAreas: input.focusAreas,
      mistakeHistory,
      
      // Include new dynamic parameters
      previousAdvice: input.previousAdvice,
      phase: input.phase,
      confidence: input.confidence
    });
    
    return {
      questions: response.questions,
      patternAlert: response.patternAlert
    };
  } catch (error) {
    console.error('Error in vibe_check tool:', error);
    
    // Fallback to basic questions if there's an error
    return {
      questions: generateFallbackQuestions(input.userRequest || "", input.plan || "", input.phase)
    };
  }
}

/**
 * Generate adaptive fallback questions when API fails
 */
function generateFallbackQuestions(userRequest: string, plan: string, phase?: 'planning' | 'implementation' | 'review'): string {
  // Adapt questions based on phase
  if (phase === 'implementation') {
    return `
I see you're working on implementing your approach. Let me offer some thoughts that might help:

1. The approach you're taking seems reasonable from what I can see, but I wonder if there are any simplifications possible?
2. How does this implementation align with the user's original request: "${userRequest.substring(0, 100)}..."?
3. Are there any parts of the implementation that might create maintenance challenges later?
`;
  } else if (phase === 'review') {
    return `
I see you're in the review phase. You've put a lot of thought into this, which is great:

1. Does the solution fully address what the user originally asked for?
2. Have you considered how the user will interact with or maintain this solution?
3. Is there anything that could be simplified further without losing functionality?
`;
  } else {
    // Default to planning phase
    return `
I can see you're thinking through your approach, which shows thoughtfulness:

1. Does this plan directly address what the user requested, or might it be solving a different problem?
2. Is there a simpler approach that would meet the user's needs?
3. What unstated assumptions might be limiting the thinking here?
4. How does this align with the user's original intent?
`;
  }
}