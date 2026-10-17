import type {
  PatchProvider,
  ProviderParameters,
  ProviderRequest,
  ProviderResponse,
} from './types.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class AnthropicProvider implements PatchProvider {
  readonly name = 'anthropic' as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {
    if (!apiKey.trim()) {
      throw new Error('ANTHROPIC_API_KEY is required for the Anthropic provider');
    }
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const response = await this.fetchImplementation(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.parameters.maxTokens,
        temperature: request.parameters.temperature,
        system: request.prompt.system,
        messages: [{ role: 'user', content: request.prompt.user }],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API returned HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.content) || typeof body.model !== 'string') {
      throw new Error('Anthropic API returned an invalid message response');
    }

    const text = body.content
      .filter((block): block is Record<string, unknown> => isRecord(block) && block.type === 'text')
      .map((block) => block.text)
      .filter((part): part is string => typeof part === 'string')
      .join('');
    if (!text.trim()) {
      throw new Error('Anthropic API response contained no patch text');
    }

    const parameters: ProviderParameters = {
      maxTokens: request.parameters.maxTokens,
      temperature: request.parameters.temperature,
    };
    return { provider: this.name, model: body.model, parameters, text };
  }
}
