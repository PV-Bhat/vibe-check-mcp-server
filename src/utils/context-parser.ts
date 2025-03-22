/**
 * Simple parser for extracting basic information from thinking logs
 * 
 * This is a greatly simplified version that just extracts the core content
 * without complex regex pattern matching or detailed analysis
 */

export interface ThinkingContext {
  keyPoints: string[];
  potentialConcerns: string[];
}

/**
 * Extract key points from thinking log using simple pattern matching
 */
export function parseThinking(rawThinking: string): ThinkingContext {
  // Just extract sentences containing certain keywords
  const keyPointPatterns = [
    "I need to", "important to", "we should", "key point", 
    "critical", "essential", "focus on", "necessary"
  ];
  
  const concernPatterns = [
    "caution", "careful", "risk", "problem", "issue", "concern",
    "might not", "may not", "uncertain", "unclear"
  ];
  
  const keyPoints = extractMatchingSentences(rawThinking, keyPointPatterns);
  const potentialConcerns = extractMatchingSentences(rawThinking, concernPatterns);
  
  return {
    keyPoints,
    potentialConcerns
  };
}

/**
 * Simple helper to extract sentences containing certain patterns
 */
function extractMatchingSentences(text: string, patterns: string[]): string[] {
  // Split text into sentences (approximately)
  const sentences = text.split(/[.!?]\s+/);
  
  // Filter sentences that contain any of the patterns
  const matches = sentences.filter(sentence => 
    patterns.some(pattern => 
      sentence.toLowerCase().includes(pattern.toLowerCase())
    )
  );
  
  // Limit to avoid too many matches
  return matches.slice(0, 10).map(s => s.trim());
}