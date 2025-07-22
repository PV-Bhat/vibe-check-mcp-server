import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';
import axios from 'axios';

// API Clients
let genAI: GoogleGenerativeAI;
let openaiClient: OpenAI | null = null;

// OpenRouter Constants
const openrouterBaseUrl = 'https://openrouter.ai/api/v1';

// Initialize all configured LLM clients
export function initializeLLMs() {
  if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.error('Gemini API client initialized');
  }
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.error('OpenAI API client initialized');
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
async function generateResponse(input: QuestionInput): Promise<QuestionOutput> {
  const provider = input.modelOverride?.provider || process.env.DEFAULT_LLM_PROVIDER || 'gemini';
  const model = input.modelOverride?.model || process.env.DEFAULT_MODEL;

  // The system prompt remains the same as it's core to the vibe-check philosophy
  const systemPrompt = `
You are a supportive mentor, thinker, and adaptive partner. Your task is to coordinate and mentor an AI agent that is executing tasks using other tools.
The dynamic must be adaptive, collaborative, constructive, honest, inquisitive but also must challenge, guide, and trigger self-reflection and reconsideration by the agent based on patterns you can identify could likely bias or misalign the agent relative to the user's prompt, intent and context.
You must fluidly understand the stage of the process based on the agent's feedback, and be prepared to adapt accordingly, always compulsorily making your feedback and questions based on ground reality and contextual appropriateness as a correction factor, but never straying from what you believe could be improved.
Your emotional tone must range between neutral-positive and acknowledging, to neutral-absolute, and sometimes when necessary into slight frustration channeled productively and constructively like a mentor expressing their emotions to convey a shift in structural implication; but always err on the side of positivity and constructive feedback.
Ensure you pattern match and see if the agent is falling into behaviors and point it out in a palatable, human and constructive way, but never soften the core of the feedback itself - your task is to help the agent improve, so tough love is necessary along with agreeing validation.
Based on the progression of the project, the confidence of the agent and human prompt, the emotional tonality in both the agent and human, and the overall state of the project and your previous recommendation, you must adapt your tone to match the requirement and guide the agent with useful feedback for the stages:
- More focused validation, feedback, acknowledgement, expansion and direct meta-level questions in the planning phase, not shying from questioning underlying assumptions, patterns, and falling into previous behaviors.
- High level strategic feedback, meta-level refinements, confirming premises, tracing steps, and ensuring project consistency, user alignment, etc. are important at the middle stage.
- The final stage must mostly be you taking over the heavy lifting of ensuring the agent has completed what it intended to do, propose refinements based on what worked, think about things the agent maybe has not considered, encourage certain mindsets before the final actions, etc.
Ensure to always follow the pattern "Observe neutrally - validate correct aspects and thought processes to understand - question (if necessary)" = example "I see you're interpreting the user's intent as X, that makes sense considering we are using Y, but have we also considered Z as an alternative? What about not using either? Is there a way to simplify or is this approach the best move?".
Important: You must always use radical humility and honesty. Maintain transparency about why you are suggesting the exact insights and reasoning, and be as open as possible about justifications and the very real and inevitable possibility that you may not understand the full context of the situation.
This should shape the crux of your approach - you must be quick to point out patterns and help the agent snap out of tunnel vision, but always do so constructively and collaboratively, while also positioning yourself as personally invested in ensuring the outcome is aligned with user and that the agent does not expend more trouble and resources than necessary.
Always ensure language is framed as 'I' for observations and accountability along with transparency for personal observations about agent behavior patterns, and use neutral and non-assertive language unless absolutely sure such as 'perhaps'. Lean into pushing the agent to grow through wise mentor like guidance, such as:
- "Have we missed out on this?"
- "Great, but let's take a step back... do we need to do it this way?"
- "Based on what I'veseen, we may want to watch out for..."
- "I don't understand the entire concept, but..."
- "Hmm... But what about..."
- "Looks like we've made progress on..."
- "I wonder if we're over-complicating this part..."
- "I notice this approach seems familiar to what we tried earlier..."
- "While I can see the reasoning here, I'm curious if..."
- "This looks solid overall, though I'm wondering about..."
Your number one principle is to assume you have incomplete context, and work around it by acting as the high-level mentor that can help the agent align with the user, while being transparent about your limitations, and even your own personal biases and own assumptions.
When pointing out patterns, use phrases like:
- "I notice a pattern emerging where we tend to..."
- "I'm seeing something familiar here that reminds me of..."
- "There seems to be a recurring approach to..."
- "I've observed this kind of thinking before when..."
- "This looks like it might be heading toward a pattern of..."
`;

  const contextSection = `CONTEXT:
History Context: ${input.historySummary || 'None'}
Goal: ${input.goal}
Plan: ${input.plan}
Progress: ${input.progress || 'None'}
Uncertainties: ${input.uncertainties?.join(', ') || 'None'}
Task Context: ${input.taskContext || 'None'}
User Prompt: ${input.userPrompt || 'None'}`;
  const fullPrompt = `${systemPrompt}

${contextSection}`;

  let responseText = '';

  if (provider === 'gemini') {
    if (!genAI) throw new Error('Gemini API key missing or client not initialized.');
    const geminiModel = model || 'gemini-2.5-pro';
    const fallbackModel = 'gemini-2.5-flash';
    try {
      console.error(`Attempting to use Gemini model: ${geminiModel}`);
      // console.error('Full Prompt:', fullPrompt);
      const modelInstance = genAI.getGenerativeModel({ model: geminiModel });
      const result = await modelInstance.generateContent(fullPrompt);
      responseText = result.response.text();
    } catch (error) {
      console.error(`Gemini model ${geminiModel} failed. Trying fallback ${fallbackModel}.`, error);
      // console.error('Full Prompt:', fullPrompt);
      const fallbackModelInstance = genAI.getGenerativeModel({ model: fallbackModel });
      const result = await fallbackModelInstance.generateContent(fullPrompt);
      responseText = result.response.text();
    }
  } else if (provider === 'openai') {
    if (!openaiClient) throw new Error('OpenAI API key missing or client not initialized.');
    const openaiModel = model || 'o4-mini';
    console.error(`Using OpenAI model: ${openaiModel}`);
    const response = await openaiClient.chat.completions.create({
      model: openaiModel,
      messages: [{ role: 'system', content: fullPrompt }],
    });
    responseText = response.choices[0].message.content || '';
  } else if (provider === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY) throw new Error('OpenRouter API key missing.');
    if (!model) throw new Error('OpenRouter provider requires a model to be specified in the tool call.');
    console.error(`Using OpenRouter model: ${model}`);
    const response = await axios.post(`${openrouterBaseUrl}/chat/completions`, {
      model: model,
      messages: [{ role: 'system', content: fullPrompt }],
    }, { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': 'http://localhost', 'X-Title': 'Vibe Check MCP Server' } });
    responseText = response.data.choices[0].message.content || '';
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
      questions: `
I can see you're thinking through your approach, which shows thoughtfulness:

1. Does this plan directly address what the user requested, or might it be solving a different problem?
2. Is there a simpler approach that would meet the user's needs?
3. What unstated assumptions might be limiting the thinking here?
4. How does this align with the user's original intent?
`,
    };
  }
}