/**
 * Central registry of the providers and model IDs Vibe Check supports.
 *
 * Keeping the catalogue in one module means the LLM dispatcher and the
 * `vibe_check` tool schema never drift apart when a provider ships a new tier.
 * Any model ID accepted by the provider still works — this list only drives the
 * defaults, the fallbacks and the discovery hints surfaced to agents.
 *
 * `label` and `notes` are not read at runtime: they are the source text for the
 * provider tables in README.md and docs/api-keys.md, kept here so the prose and
 * the behaviour are updated in the same place.
 */

export const SUPPORTED_LLM_PROVIDERS = ['gemini', 'openai', 'openrouter', 'anthropic'] as const;

export type LlmProvider = (typeof SUPPORTED_LLM_PROVIDERS)[number];

export interface ModelInfo {
  /** Model ID sent to the provider API verbatim. */
  id: string;
  /** Human-readable name used in docs and CLI output. */
  label: string;
  /** Short positioning note (cost/latency/capability trade-off). */
  notes: string;
}

/**
 * Recommended models per provider, most capable first within each tier group.
 * Gemini runs natively against Google AI Studio (Gemini Developer API).
 */
export const PROVIDER_MODELS: Record<LlmProvider, ModelInfo[]> = {
  gemini: [
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', notes: 'Default. GA agentic/multimodal flagship of the Flash line.' },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', notes: 'Previous Flash generation, still GA.' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', notes: 'Fallback. Lowest cost and latency in the Flash class.' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', notes: 'Legacy long-context reasoning model.' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', notes: 'Legacy fast model.' },
  ],
  openai: [
    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', notes: 'Flagship tier — deepest reasoning, highest cost.' },
    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', notes: 'Default. Balanced everyday tier.' },
    { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', notes: 'Fastest and cheapest tier.' },
  ],
  anthropic: [
    { id: 'claude-opus-5', label: 'Claude Opus 5', notes: 'Flagship tier — deepest reasoning, highest cost.' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', notes: 'Default. Balanced everyday tier.' },
    { id: 'claude-fable-5', label: 'Claude Fable 5', notes: 'Claude 5 family sibling tuned for expressive prose.' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', notes: 'Fastest and cheapest tier.' },
  ],
  // OpenRouter proxies every upstream catalogue, so there is no useful default:
  // callers must pass a fully-qualified `vendor/model` slug.
  openrouter: [
    { id: 'google/gemini-3.6-flash', label: 'Gemini 3.6 Flash (via OpenRouter)', notes: 'Example slug — any OpenRouter model ID works.' },
    { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5 (via OpenRouter)', notes: 'Example slug — any OpenRouter model ID works.' },
    { id: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra (via OpenRouter)', notes: 'Example slug — any OpenRouter model ID works.' },
  ],
};

/**
 * Model used when neither `modelOverride.model` nor `DEFAULT_MODEL` is set.
 * `openrouter` is intentionally absent — it requires an explicit model.
 */
export const DEFAULT_MODELS: Partial<Record<LlmProvider, string>> = {
  gemini: 'gemini-3.6-flash',
  openai: 'gpt-5.6-terra',
  anthropic: 'claude-sonnet-5',
};

/** Secondary Gemini model tried when the primary model errors out. */
export const GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite';

export const DEFAULT_LLM_PROVIDER: LlmProvider = 'gemini';

/** Model IDs suggested for a provider, in registry order. */
export function listModelIds(provider: LlmProvider): string[] {
  return PROVIDER_MODELS[provider].map((model) => model.id);
}
