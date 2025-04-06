import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import axios from 'axios';

// Gemini API setup
let genAI: GoogleGenerativeAI;
let apiKey: string;

// Use only one Gemini model for simplicity
const MODEL_ID = 'learnlm-1.5-pro-experimental';

// Initialize the Gemini API client
export function initializeGemini(key: string): void {
  apiKey = key;
  genAI = new GoogleGenerativeAI(key);
  console.error('Gemini API client initialized');
}

// Input interface for metacognitive questioning
interface QuestionInput {
  plan?: string;
  userRequest?: string;
  thinkingLog?: string;
  availableTools?: string[];
  focusAreas?: string[];
  mistakeHistory?: Record<string, any>;
  previousAdvice?: string;
  phase?: 'planning' | 'implementation' | 'review';
  confidence?: number;
}

interface QuestionOutput {
  questions: string;
  patternAlert?: string;
}

/**
 * Get metacognitive questions from Gemini
 */
export async function getMetacognitiveQuestions(input: QuestionInput): Promise<QuestionOutput> {
  if (!apiKey) {
    throw new Error('Gemini API not initialized. Please set GEMINI_API_KEY environment variable.');
  }

  try {
    // Create metacognitive questioning prompt with adaptive mentorship approach
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
- "Based on what I've seen, we may want to watch out for..."
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

    // Build the context section with phase awareness
    let contextSection = 'CONTEXT:\n';
    
    // Add phase information if provided
    if (input.phase) {
      contextSection += `\n[Current Phase]: ${input.phase}\n`;
    } else {
      // Try to infer phase from context
      if (input.thinkingLog && input.thinkingLog.includes('implement') || 
          (input.plan && input.plan.includes('implement'))) {
        contextSection += `\n[Inferred Phase]: implementation\n`;
      } else if (input.thinkingLog && input.thinkingLog.includes('review') || 
                (input.plan && input.plan.includes('review'))) {
        contextSection += `\n[Inferred Phase]: review\n`;
      } else {
        contextSection += `\n[Inferred Phase]: planning\n`;
      }
    }
    
    // Add confidence level if provided
    if (input.confidence !== undefined) {
      contextSection += `\n[Agent Confidence Level]: ${input.confidence * 100}%\n`;
    }
    
    // Add previous advice if provided
    if (input.previousAdvice) {
      contextSection += `\n[Previous Advice]: ${input.previousAdvice}\n`;
    }
    
    if (input.userRequest) {
      contextSection += `\n[User Request]: ${input.userRequest}\n`;
    } else {
      contextSection += `\n[WARNING]: No user request provided. This is essential for alignment checking.\n`;
    }
    
    if (input.plan) {
      contextSection += `\n[Current Plan/Thinking]: ${input.plan}\n`;
    }
    
    // Format mistake history if available
    if (input.mistakeHistory && Object.keys(input.mistakeHistory).length > 0) {
      contextSection += '\n[Previous Patterns]:\n';
      Object.entries(input.mistakeHistory).forEach(([category, examples]) => {
        if (Array.isArray(examples) && examples.length > 0) {
          // Just include the most recent example
          const recent = examples[examples.length - 1];
          contextSection += `- ${category}: ${recent.mistake} - Solution: ${recent.solution}\n`;
        }
      });
    }
    
    // Full prompt combining system prompt and context
    const fullPrompt = systemPrompt + '\n\n' + contextSection;
    
    // Try using the Gemini API (simplified approach)
    let response: string;
    let patternAlert: string | undefined;
    
    try {
      // Use the SDK
      const model = genAI.getGenerativeModel({ 
        model: MODEL_ID,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          }
        ]
      });

      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: fullPrompt }] }
        ],
        generationConfig: {
          temperature: 0.3, // Slightly higher temperature for more dynamic responses
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
        }
      });

      response = result.response.text();
    } 
    catch (sdkError) {
      console.error('SDK method failed, trying direct API call:', sdkError);
      
      // Fall back to direct API call
      const apiResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${apiKey}`,
        {
          contents: [
            { 
              role: 'user',
              parts: [{ text: fullPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 1024
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      response = apiResponse.data.candidates[0].content.parts[0].text;
    }

    // Extract pattern alert if present
    const patternAlertMatch = response.match(/I notice a pattern emerging:\s*(.+?)(?=\n|$)/i);
    if (patternAlertMatch && patternAlertMatch[1]) {
      patternAlert = patternAlertMatch[1].trim();
    }

    return {
      questions: response,
      patternAlert
    };
  } catch (error) {
    console.error('Error getting metacognitive questions from Gemini:', error);
    throw error;
  }
}
