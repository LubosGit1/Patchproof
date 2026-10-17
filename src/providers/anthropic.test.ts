import { describe, expect, it } from 'vitest';

import { AnthropicProvider } from './anthropic.js';

describe('Anthropic provider', () => {
  it('sends the recorded prompt and parameters and returns the model response', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const fetchMock: typeof fetch = async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify({
        model: 'claude-test-model',
        content: [{ type: 'text', text: 'diff --git a/source.ts b/source.ts\n' }],
      }), { status: 200 });
    };
    const provider = new AnthropicProvider('test-api-key', fetchMock);
    const result = await provider.generate({
      prompt: { system: 'system prompt', user: 'user prompt' },
      model: 'requested-model',
      parameters: { maxTokens: 300, temperature: 0 },
    });

    expect(requestUrl).toBe('https://api.anthropic.com/v1/messages');
    expect(new Headers(requestInit?.headers).get('x-api-key')).toBe('test-api-key');
    expect(new Headers(requestInit?.headers).get('anthropic-version')).toBe('2023-06-01');
    const body: unknown = JSON.parse(String(requestInit?.body));
    expect(body).toMatchObject({
      model: 'requested-model',
      max_tokens: 300,
      temperature: 0,
      system: 'system prompt',
      messages: [{ role: 'user', content: 'user prompt' }],
    });
    expect(result).toMatchObject({
      provider: 'anthropic',
      model: 'claude-test-model',
      parameters: { maxTokens: 300, temperature: 0 },
      text: 'diff --git a/source.ts b/source.ts\n',
    });
  });

  it('does not reveal the API key in a failed request error', async () => {
    const fetchMock: typeof fetch = async () => new Response('private provider details', { status: 401 });
    const provider = new AnthropicProvider('never-log-this-key', fetchMock);
    await expect(provider.generate({
      prompt: { system: 'system', user: 'user' },
      model: 'model',
      parameters: { maxTokens: 1, temperature: 0 },
    })).rejects.toThrow('Anthropic API returned HTTP 401');
  });
});
