export interface AnthropicConfig {
  baseUrl: string;
  apiKey?: string;
  authToken?: string;
  version: string;
}

export interface AnthropicHeaderInput {
  apiKey?: string;
  authToken?: string;
  version: string;
}

export function resolveAnthropicConfig(): AnthropicConfig {
  const trimmedBase = process.env.ANTHROPIC_BASE_URL?.replace(/\/+$/, '');
  const baseUrl = trimmedBase && trimmedBase.length > 0 ? trimmedBase : 'https://api.anthropic.com';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
  const version = process.env.ANTHROPIC_VERSION || '2023-06-01';

  if (!apiKey && !authToken) {
    throw new Error(
      'Anthropic configuration error: set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN when provider "anthropic" is selected.'
    );
  }

  return {
    baseUrl,
    apiKey,
    authToken,
    version,
  };
}

export function buildAnthropicHeaders({ apiKey, authToken, version }: AnthropicHeaderInput): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': version,
  };

  if (apiKey) {
    headers['x-api-key'] = apiKey;
  } else if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }

  return headers;
}
