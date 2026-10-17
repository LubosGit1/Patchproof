import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { AnthropicProvider } from './anthropic.js';
import { MockProvider } from './mock.js';
import type { PatchProvider, ProviderName } from './types.js';

export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
export const DEFAULT_PARAMETERS = { maxTokens: 4096, temperature: 0 } as const;

export function parseProviderName(value: string): ProviderName {
  if (value === 'mock' || value === 'anthropic') return value;
  throw new Error(`Unknown provider "${value}". Choose mock or anthropic.`);
}

export async function createProvider(
  providerName: ProviderName,
  projectRoot: string,
  caseId: string,
  attempt: number,
): Promise<PatchProvider> {
  if (providerName === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for --provider anthropic');
    }
    return new AnthropicProvider(apiKey);
  }

  const caseRoot = resolve(projectRoot, 'lab/cases', caseId);
  const [source, reference, narrow, disable] = await Promise.all([
    readFile(resolve(caseRoot, 'vulnerable/source.ts'), 'utf8'),
    readFile(resolve(caseRoot, 'reference.patch'), 'utf8'),
    readFile(resolve(caseRoot, 'known-bad/narrow-blacklist.patch'), 'utf8'),
    readFile(resolve(caseRoot, 'known-bad/disable-endpoint.patch'), 'utf8'),
  ]);
  return new MockProvider({ source, reference, narrow, disable }, attempt);
}
