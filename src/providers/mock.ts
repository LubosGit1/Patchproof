import { createTwoFilesPatch } from 'diff';

import type {
  PatchProvider,
  ProviderParameters,
  ProviderRequest,
  ProviderResponse,
} from './types.js';

export const MOCK_SCENARIOS = ['good', 'bad', 'narrow', 'disable', 'invalid'] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export interface MockPatches {
  source: string;
  reference: string;
  narrow: string;
  disable: string;
}

export class MockProvider implements PatchProvider {
  readonly name = 'mock' as const;
  readonly model = 'patchproof-mock-v1';
  readonly scenario: MockScenario;

  constructor(
    private readonly patches: MockPatches,
    attempt: number,
  ) {
    this.scenario = MOCK_SCENARIOS[(attempt - 1) % MOCK_SCENARIOS.length] ?? 'good';
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const text = this.patchForScenario();
    const parameters: ProviderParameters = {
      maxTokens: request.parameters.maxTokens,
      temperature: request.parameters.temperature,
    };
    return {
      provider: this.name,
      model: this.model,
      parameters,
      text,
      scenario: this.scenario,
    };
  }

  private patchForScenario(): string {
    switch (this.scenario) {
      case 'good':
        return this.patches.reference;
      case 'bad':
        return `diff --git a/source.ts b/source.ts\n${createTwoFilesPatch(
          'a/source.ts',
          'b/source.ts',
          this.patches.source,
          `${this.patches.source}// Mock provider: deliberately ineffective change.\n`,
        )}`;
      case 'narrow':
        return this.patches.narrow;
      case 'disable':
        return this.patches.disable;
      case 'invalid':
        return [
          'diff --git a/tests/security.test.ts b/tests/security.test.ts',
          '--- a/tests/security.test.ts',
          '+++ b/tests/security.test.ts',
          '@@ -1 +1 @@',
          '-original test',
          '+disabled test',
        ].join('\n');
    }
  }
}
