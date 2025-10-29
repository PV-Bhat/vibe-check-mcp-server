import { getLearningContextText } from './storage.js';
import { getConstitution } from '../tools/constitution.js';
import { resolveAnthropicConfig, buildAnthropicHeaders } from './anthropic.js';
import { getPrompt } from './prompts.js';

// API Clients - Use 'any' to support dynamic import
let genAI: any = null;
let openaiClient: any = null;

// OpenRouter Constants
const openrouterBaseUrl = 'https://openrouter.ai/api/v1';

// Initialize all configured LLM clients
export async function initializeLLMs() {
  await ensureGemini();
  await ensureOpenAI();
}

async function ensureGemini() {
  if (!genAI && process.env.GEMINI_API_KEY) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('Gemini API client initialized dynamically');
  }
}

async function ensureOpenAI() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    const { OpenAI } = await import('openai');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('OpenAI API client initialized dynamically');
  }
}

// Input/Output Interfaces
interface QuestionInput {
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
  historySummary?: string;
}

interface QuestionOutput {
  questions: string;
}

// Main dispatcher function to generate responses from the selected LLM provider
export async function generateResponse(input: QuestionInput): Promise<QuestionOutput> {
  const provider = input.modelOverride?.provider || process.env.DEFAULT_LLM_PROVIDER || 'gemini';
  const model = input.modelOverride?.model || process.env.DEFAULT_MODEL;

  // The system prompt remains the same as it's core to the vibe-check philosophy
  const systemPrompt = getPrompt('metaMentorSystem');

  let learningContext = '';
  if (process.env.USE_LEARNING_HISTORY === 'true') {
    learningContext = getLearningContextText();
  }

  const rules = input.sessionId ? getConstitution(input.sessionId) : [];
  const constitutionBlock = rules.length ? `\nConstitution:\n${rules.map(r => `- ${r}`).join('\n')}` : '';

  const contextSection = `CONTEXT:\nHistory Context: ${input.historySummary || 'None'}\n${learningContext ? `Learning Context:\n${learningContext}` : ''}\nGoal: ${input.goal}\nPlan: ${input.plan}\nProgress: ${input.progress || 'None'}\nUncertainties: ${input.uncertainties?.join(', ') || 'None'}\nTask Context: ${input.taskContext || 'None'}\nUser Prompt: ${input.userPrompt || 'None'}${constitutionBlock}`;
  const fullPrompt = `${systemPrompt}\n\n${contextSection}`;
  const compiledPrompt = contextSection;

  let responseText = '';

  if (provider === 'gemini') {
    await ensureGemini();
    if (!genAI) throw new Error('Gemini API key missing.');
    const geminiModel = model || 'gemini-2.5-pro';
    const fallbackModel = 'gemini-2.5-flash';
    try {
      console.log(`Attempting to use Gemini model: ${geminiModel}`);
      // console.error('Full Prompt:', fullPrompt); // Keep this commented out for now
      const modelInstance = genAI.getGenerativeModel({ model: geminiModel });
      const result = await modelInstance.generateContent(fullPrompt);
      responseText = result.response.text();
    } catch (error) {
      console.error(`Gemini model ${geminiModel} failed. Trying fallback ${fallbackModel}.`, error);
      // console.error('Full Prompt:', fullPrompt); // Keep this commented out for now
      const fallbackModelInstance = genAI.getGenerativeModel({ model: fallbackModel });
      const result = await fallbackModelInstance.generateContent(fullPrompt);
      responseText = result.response.text();
    }
  } else if (provider === 'openai') {
    await ensureOpenAI();
    if (!openaiClient) throw new Error('OpenAI API key missing.');
    const openaiModel = model || 'o4-mini';
    console.log(`Using OpenAI model: ${openaiModel}`);
    const response = await openaiClient.chat.completions.create({
      model: openaiModel,
      messages: [{ role: 'system', content: fullPrompt }],
    });
    responseText = response.choices[0].message.content || '';
  } else if (provider === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY) throw new Error('OpenRouter API key missing.');
    if (!model) throw new Error('OpenRouter provider requires a model to be specified in the tool call.');
    console.log(`Using OpenRouter model: ${model}`);
    const { default: axios } = await import('axios');
    const response = await axios.post(`${openrouterBaseUrl}/chat/completions`, {
      model: model,
      messages: [{ role: 'system', content: fullPrompt }],
    }, { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': 'http://localhost', 'X-Title': 'Vibe Check MCP Server' } });
    responseText = response.data.choices[0].message.content || '';
  } else if (provider === 'anthropic') {
    const anthropicModel = model || 'claude-3-5-sonnet-20241022';
    responseText = await callAnthropic({
      model: anthropicModel,
      compiledPrompt,
      systemPrompt,
    });
  } else {
    throw new Error(`Invalid provider specified: ${provider}`);
  }

  return {
    questions: responseText,
  };
}

// The exported function is now a wrapper around the dispatcher
export async function getMetacognitiveQuestions(input: QuestionInput): Promise<QuestionOutput> {
  try {
    return await generateResponse(input);
  } catch (error) {
    console.error('Error getting metacognitive questions:', error);
    // Fallback questions
    return {
      questions: getPrompt('fallbackQuestionsLLM'),
    };
  }
}

// Testing helpers
export const __testing = {
  setGenAI(client: any) { genAI = client; },
  setOpenAIClient(client: any) { openaiClient = client; },
  getGenAI() { return genAI; },
  getOpenAIClient() { return openaiClient; }
};

interface AnthropicCallOptions {
  model: string;
  compiledPrompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

async function callAnthropic({
  model,
  compiledPrompt,
  systemPrompt,
  maxTokens = 1024,
  temperature = 0.2,
}: AnthropicCallOptions): Promise<string> {
  if (!model) {
    throw new Error('Anthropic provider requires a model to be specified in the tool call or DEFAULT_MODEL.');
  }

  const { baseUrl, apiKey, authToken, version } = resolveAnthropicConfig();
  const headers = buildAnthropicHeaders({ apiKey, authToken, version });
  const url = `${baseUrl}/v1/messages`;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      {
        role: 'user',
        content: compiledPrompt,
      },
    ],
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let parsedBody: any;
  if (rawText) {
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      parsedBody = undefined;
    }
  }

  if (!response.ok) {
    const requestId = response.headers.get('anthropic-request-id') || response.headers.get('x-request-id');
    const retryAfter = response.headers.get('retry-after');
    const requestSuffix = requestId ? ` (request id: ${requestId})` : '';
    const errorMessage =
      typeof parsedBody?.error?.message === 'string'
        ? parsedBody.error.message
        : typeof parsedBody?.message === 'string'
          ? parsedBody.message
          : rawText?.trim();

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Anthropic authentication failed with status ${response.status}${requestSuffix}. Verify ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN.`
      );
    }

    if (response.status === 429) {
      const retryMessage = retryAfter ? ` Retry after ${retryAfter} seconds if provided.` : '';
      throw new Error(`Anthropic rate limit exceeded (status 429)${requestSuffix}.${retryMessage}`);
    }

    const detail = errorMessage ? ` ${errorMessage}` : '';
    throw new Error(`Anthropic request failed with status ${response.status}${requestSuffix}.${detail}`.trim());
  }

  const content = Array.isArray(parsedBody?.content) ? parsedBody.content : [];
  const firstTextBlock = content.find((block: any) => block?.type === 'text' && typeof block?.text === 'string');
  if (firstTextBlock) {
    return firstTextBlock.text;
  }

  const fallbackText = content[0]?.text;
  return typeof fallbackText === 'string' ? fallbackText : '';
}
