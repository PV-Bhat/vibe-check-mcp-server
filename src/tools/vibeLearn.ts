import { addMistake, getMistakeCategorySummary, MistakeEntry } from '../utils/storage.js';

// Vibe Learn tool interfaces
export interface VibeLearnInput {
  mistake: string;
  category: string;
  solution: string;
  sessionId?: string;
}

export interface VibeLearnOutput {
  added: boolean;
  currentTally: number;
  topCategories: Array<{
    category: string;
    count: number;
    recentExample: MistakeEntry;
  }>;
}

/**
 * The vibe_learn tool records one-sentence mistakes and solutions
 * to build a pattern recognition system for future improvement
 */
export async function vibeLearnTool(input: VibeLearnInput): Promise<VibeLearnOutput> {
  try {
    // Validate input
    if (!input.mistake) {
      throw new Error('Mistake description is required');
    }
    if (!input.category) {
      throw new Error('Mistake category is required');
    }
    if (!input.solution) {
      throw new Error('Solution is required');
    }
    
    // Enforce single-sentence constraints
    const mistake = enforceOneSentence(input.mistake);
    const solution = enforceOneSentence(input.solution);
    
    // Normalize category to one of our standard categories if possible
    const category = normalizeCategory(input.category);
    
    // Add mistake to log
    const entry = addMistake(mistake, category, solution);
    
    // Get category summaries
    const categorySummary = getMistakeCategorySummary();
    
    // Find current tally for this category
    const categoryData = categorySummary.find(m => m.category === category);
    const currentTally = categoryData?.count || 1;
    
    // Get top 3 categories
    const topCategories = categorySummary.slice(0, 3);
    
    return {
      added: true,
      currentTally,
      topCategories
    };
  } catch (error) {
    console.error('Error in vibe_learn tool:', error);
    return {
      added: false,
      currentTally: 0,
      topCategories: []
    };
  }
}

/**
 * Ensure text is a single sentence
 */
function enforceOneSentence(text: string): string {
  // Remove newlines
  let sentence = text.replace(/\r?\n/g, ' ');
  
  // Split by sentence-ending punctuation
  const sentences = sentence.split(/([.!?])\s+/);
  
  // Take just the first sentence
  if (sentences.length > 0) {
    // If there's punctuation, include it
    const firstSentence = sentences[0] + (sentences[1] || '');
    sentence = firstSentence.trim();
  }
  
  // Ensure it ends with sentence-ending punctuation
  if (!/[.!?]$/.test(sentence)) {
    sentence += '.';
  }
  
  return sentence;
}

/**
 * Normalize category to one of our standard categories
 */
function normalizeCategory(category: string): string {
  // Standard categories
  const standardCategories = {
    'Complex Solution Bias': ['complex', 'complicated', 'over-engineered', 'complexity'],
    'Feature Creep': ['feature', 'extra', 'additional', 'scope creep'],
    'Premature Implementation': ['premature', 'early', 'jumping', 'too quick'],
    'Misalignment': ['misaligned', 'wrong direction', 'off target', 'misunderstood'],
    'Overtooling': ['overtool', 'too many tools', 'unnecessary tools']
  };
  
  // Convert category to lowercase for matching
  const lowerCategory = category.toLowerCase();
  
  // Try to match to a standard category
  for (const [standardCategory, keywords] of Object.entries(standardCategories)) {
    if (keywords.some(keyword => lowerCategory.includes(keyword))) {
      return standardCategory;
    }
  }
  
  // If no match, return the original category
  return category;
}
