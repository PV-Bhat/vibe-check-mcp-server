import fs from 'fs';
import path from 'path';
import os from 'os';

// Define data directory - store in user's home directory
const DATA_DIR = path.join(os.homedir(), '.vibe-check');
const LOG_FILE = path.join(DATA_DIR, 'vibe-log.json');

// Interfaces for the log data structure
export interface MistakeEntry {
  category: string;
  mistake: string;
  solution: string;
  timestamp: number;
}

export interface VibeLog {
  mistakes: {
    [category: string]: {
      count: number;
      examples: MistakeEntry[];
      lastUpdated: number;
    };
  };
  lastUpdated: number;
}

// Standard mistake categories
export const STANDARD_CATEGORIES = [
  'Complex Solution Bias',
  'Feature Creep',
  'Premature Implementation',
  'Misalignment',
  'Overtooling',
  'Other'
];

// Initial empty log structure
const emptyLog: VibeLog = {
  mistakes: {},
  lastUpdated: Date.now()
};

/**
 * Ensure the data directory exists
 */
export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Read the vibe log from disk
 */
export function readLogFile(): VibeLog {
  ensureDataDir();
  
  if (!fs.existsSync(LOG_FILE)) {
    // Initialize with empty log if file doesn't exist
    writeLogFile(emptyLog);
    return emptyLog;
  }
  
  try {
    const data = fs.readFileSync(LOG_FILE, 'utf8');
    return JSON.parse(data) as VibeLog;
  } catch (error) {
    console.error('Error reading vibe log:', error);
    // Return empty log as fallback
    return emptyLog;
  }
}

/**
 * Write data to the vibe log file
 */
export function writeLogFile(data: VibeLog): void {
  ensureDataDir();
  
  try {
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(LOG_FILE, jsonData, 'utf8');
  } catch (error) {
    console.error('Error writing vibe log:', error);
  }
}

/**
 * Add a mistake to the vibe log
 */
export function addMistake(mistake: string, category: string, solution: string): MistakeEntry {
  const log = readLogFile();
  const now = Date.now();
  
  // Create new entry
  const entry: MistakeEntry = {
    category,
    mistake,
    solution,
    timestamp: now
  };
  
  // Initialize category if it doesn't exist
  if (!log.mistakes[category]) {
    log.mistakes[category] = {
      count: 0,
      examples: [],
      lastUpdated: now
    };
  }
  
  // Update category data
  log.mistakes[category].count += 1;
  log.mistakes[category].examples.push(entry);
  log.mistakes[category].lastUpdated = now;
  log.lastUpdated = now;
  
  // Write updated log
  writeLogFile(log);
  
  return entry;
}

/**
 * Get all mistake entries
 */
export function getMistakes(): Record<string, MistakeEntry[]> {
  const log = readLogFile();
  const result: Record<string, MistakeEntry[]> = {};
  
  // Convert to flat structure by category
  for (const [category, data] of Object.entries(log.mistakes)) {
    result[category] = data.examples;
  }
  
  return result;
}

/**
 * Get mistake category summaries, sorted by count (most frequent first)
 */
export function getMistakeCategorySummary(): Array<{
  category: string;
  count: number;
  recentExample: MistakeEntry;
}> {
  const log = readLogFile();
  
  // Convert to array with most recent example
  const summary = Object.entries(log.mistakes).map(([category, data]) => {
    // Get most recent example
    const recentExample = data.examples[data.examples.length - 1];
    
    return {
      category,
      count: data.count,
      recentExample
    };
  });
  
  // Sort by count (descending)
  return summary.sort((a, b) => b.count - a.count);
}