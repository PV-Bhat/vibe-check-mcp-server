// Vibe Distill tool for plan distillation
export interface VibeDistillInput {
  plan: string;
  userRequest: string; // Now required, not optional
  sessionId?: string;
}

export interface VibeDistillOutput {
  distilledPlan: string;
  rationale: string;
}

/**
 * The vibe_distill tool provides a simple output format for plan distillation
 * focused on clarity and conciseness.
 * 
 * The userRequest parameter is REQUIRED and must contain the FULL original user request
 * to ensure proper alignment in the distillation process.
 */
export async function vibeDistillTool(input: VibeDistillInput): Promise<VibeDistillOutput> {
  try {
    // Validate required parameters
    if (!input.plan) {
      throw new Error('Plan is required');
    }
    
    if (!input.userRequest || input.userRequest.trim() === '') {
      throw new Error('FULL user request is required for proper distillation and alignment');
    }
    
    // Prepare the input plan for processing
    const originalPlan = input.plan.trim();
    const userRequest = input.userRequest.trim();
    
    // Create instructions for the distillation process
    const instructions = `
Distill the provided plan into its most essential form.

1. Extract only the core actions and decisions
2. Remove all unnecessary elaboration
3. Present in the most concise format possible
4. Provide a one-sentence explanation of WHY this distillation captures the essence

PLAN TO DISTILL:
${originalPlan}

USER REQUEST:
${userRequest}
`;

    // In a real implementation, we would use an LLM to distill the plan
    // For this simplified implementation, we'll use a basic approach
    
    const distilledPlan = createSimpleDistillation(originalPlan, userRequest);
    
    // Simple rationale
    const rationale = "This distillation focuses on core actions while removing unnecessary complexity.";
    
    return {
      distilledPlan,
      rationale
    };
  } catch (error) {
    console.error('Error in vibe_distill tool:', error);
    return {
      distilledPlan: `Error creating distillation: ${error instanceof Error ? error.message : String(error)}`,
      rationale: 'Error occurred during plan distillation.'
    };
  }
}

/**
 * Simple function to create a basic distillation of a plan
 */
function createSimpleDistillation(plan: string, userRequest: string): string {
  // Create a simple structure
  let distilled = "";
  
  // Add a header
  distilled += "# Distilled Plan\n\n";
  
  // Add essential elements section
  distilled += "## Essential Actions\n";
  
  // Extract key sentences (simple approach)
  const sentences = plan.split(/[.!?]\s+/);
  const keyPhrases = sentences
    .filter(s => 
      s.toLowerCase().includes("will") || 
      s.toLowerCase().includes("need to") ||
      s.toLowerCase().includes("should") ||
      s.toLowerCase().includes("must") ||
      s.toLowerCase().includes("going to")
    )
    .slice(0, 5)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => `- ${s}`);
  
  if (keyPhrases.length > 0) {
    distilled += keyPhrases.join('\n');
  } else {
    // If no key phrases found, just take the first few lines
    distilled += sentences
      .slice(0, 3)
      .map(s => `- ${s.trim()}`)
      .join('\n');
  }
  
  return distilled;
}