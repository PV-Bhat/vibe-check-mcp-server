import {
  addLearningEntry,
  getLearningCategorySummary,
  getLearningEntries,
  LearningEntry,
  LearningType
} from '../utils/storage.js';

// Vibe Learn tool interfaces
export interface VibeLearnInput {
  mistake: string;
  category: string;
  solution?: string;
  type?: LearningType;
  sessionId?: string;
}

export interface VibeLearnOutput {
  added: boolean;
  currentTally: number;
  alreadyKnown?: boolean;
  topCategories: Array<{
    category: string;
    count: number;
    recentExample: LearningEntry;
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
    const entryType: LearningType = input.type ?? 'mistake';
    if (entryType !== 'preference' && !input.solution) {
      throw new Error('Solution is required for this entry type');
    }
    
    // Enforce single-sentence constraints
    const mistake = enforceOneSentence(input.mistake);
    const solution = input.solution ? enforceOneSentence(input.solution) : undefined;
    
    // Normalize category to one of our standard categories if possible
    const category = normalizeCategory(input.category);
    
    // Check for similar mistake
    const existing = getLearningEntries()[category] || [];
    const alreadyKnown = existing.some(e => isSimilar(e.mistake, mistake));

    // Add mistake to log if new
    let entry: LearningEntry | undefined;
    if (!alreadyKnown) {
      entry = addLearningEntry(mistake, category, solution, entryType);
    }
    
    // Get category summaries
    const categorySummary = getLearningCategorySummary();
    
    // Find current tally for this category
    const categoryData = categorySummary.find(m => m.category === category);
    const currentTally = categoryData?.count || 1;
    
    // Get top 3 categories
    const topCategories = categorySummary.slice(0, 3);

    return {
      added: !alreadyKnown,
      alreadyKnown,
      currentTally,
      topCategories
    };
  } catch (error) {
    console.error('Error in vibe_learn tool:', error);
    return {
      added: false,
      alreadyKnown: false,
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
 * Simple similarity check between two sentences
 */
function isSimilar(a: string, b: string): boolean {
  const aWords = a.toLowerCase().split(/\W+/).filter(Boolean);
  const bWords = b.toLowerCase().split(/\W+/).filter(Boolean);
  if (aWords.length === 0 || bWords.length === 0) return false;
  const overlap = aWords.filter(w => bWords.includes(w));
  const ratio = overlap.length / Math.min(aWords.length, bWords.length);
  return ratio >= 0.6;
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
