import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CASE_IDS } from '../verification/cases.js';
import { applyPatchToSource, validatePatchText } from '../verification/patch.js';
import { createProvider } from './provider.js';

describe('deterministic mock provider', () => {
  it('cycles through good, bad, narrow, endpoint-disabling, and invalid patches', async () => {
    const expected = [
      ['good', true],
      ['bad', true],
      ['narrow', true],
      ['disable', true],
      ['invalid', false],
    ] as const;

    for (const caseId of CASE_IDS) {
      for (let index = 0; index < expected.length; index += 1) {
        const item = expected[index];
        if (!item) throw new Error('Missing expected mock scenario');
        const [scenario, valid] = item;
        const provider = await createProvider('mock', process.cwd(), caseId, index + 1);
        const response = await provider.generate({
          prompt: { system: 'not used by mock', user: 'not used by mock' },
          model: 'unused',
          parameters: { maxTokens: 128, temperature: 0 },
        });

        expect(response.provider).toBe('mock');
        expect(response.scenario).toBe(scenario);
        const validation = validatePatchText(response.text);
        expect(validation.valid).toBe(valid);
        if (validation.valid) {
          const source = await readFile(
            resolve(process.cwd(), 'lab/cases', caseId, 'vulnerable/source.ts'),
            'utf8',
          );
          expect(() => applyPatchToSource(source, validation.patch)).not.toThrow();
        }
      }
    }
  });
});
