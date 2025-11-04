import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PromptConfig {
  path: string;
  description: string;
  version: string;
  lastModified: string;
}

interface PromptsConfiguration {
  prompts: {
    metaMentorSystem: PromptConfig;
    fallbackQuestionsLLM: PromptConfig;
    fallbackQuestionsTool: PromptConfig;
  };
  settings: {
    enablePromptValidation: boolean;
    allowPromptOverride: boolean;
    logPromptUsage: boolean;
  };
}

let promptsCache: Map<string, string> = new Map();
let config: PromptsConfiguration | null = null;

/**
 * Load the prompts configuration file
 */
function loadConfig(): PromptsConfiguration {
  if (config) {
    return config;
  }

  try {
    const configPath = join(__dirname, '../../config/prompts.json');
    const configData = readFileSync(configPath, 'utf-8');
    config = JSON.parse(configData) as PromptsConfiguration;
    return config;
  } catch (error) {
    console.error('Error loading prompts configuration:', error);
    throw new Error('Failed to load prompts configuration');
  }
}

/**
 * Load a prompt from the file system
 */
function loadPromptFromFile(promptPath: string): string {
  try {
    const fullPath = join(__dirname, '../..', promptPath);
    const content = readFileSync(fullPath, 'utf-8');
    
    // Remove markdown title if present (first line starting with #)
    const lines = content.split('\n');
    if (lines[0].startsWith('#')) {
      lines.shift(); // Remove title
      // Remove empty line after title if present
      if (lines[0] === '') {
        lines.shift();
      }
    }
    
    return lines.join('\n').trim();
  } catch (error) {
    console.error(`Error loading prompt from ${promptPath}:`, error);
    throw new Error(`Failed to load prompt: ${promptPath}`);
  }
}

/**
 * Get a prompt by key
 */
export function getPrompt(key: keyof PromptsConfiguration['prompts']): string {
  // Check cache first
  if (promptsCache.has(key)) {
    return promptsCache.get(key)!;
  }

  // Load config and prompt
  const configuration = loadConfig();
  const promptConfig = configuration.prompts[key];
  
  if (!promptConfig) {
    throw new Error(`Prompt configuration not found: ${key}`);
  }

  const prompt = loadPromptFromFile(promptConfig.path);
  
  // Cache the prompt
  promptsCache.set(key, prompt);
  
  // Log usage if enabled
  if (configuration.settings.logPromptUsage) {
    console.log(`[Prompt] Loaded: ${key} (version ${promptConfig.version})`);
  }

  return prompt;
}

/**
 * Clear the prompts cache (useful for testing or hot-reloading)
 */
export function clearPromptsCache(): void {
  promptsCache.clear();
  config = null;
}

/**
 * Get prompt configuration metadata
 */
export function getPromptMetadata(key: keyof PromptsConfiguration['prompts']): PromptConfig | null {
  try {
    const configuration = loadConfig();
    return configuration.prompts[key] || null;
  } catch {
    return null;
  }
}

/**
 * Validate that all configured prompts exist and are readable
 */
export function validatePrompts(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    const configuration = loadConfig();
    const promptKeys = Object.keys(configuration.prompts) as Array<keyof PromptsConfiguration['prompts']>;
    
    for (const key of promptKeys) {
      try {
        getPrompt(key);
      } catch (error) {
        errors.push(`Failed to load prompt "${key}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    errors.push(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
