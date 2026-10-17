import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { proposePatch } from './propose.js';

describe('patch proposal artifacts', () => {
  it('stores the candidate diff and a complete prompt/model/parameter record', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'patchproof-propose-test-'));
    try {
      await cp(
        resolve(process.cwd(), 'lab/cases/sql-injection'),
        resolve(projectRoot, 'lab/cases/sql-injection'),
        { recursive: true },
      );
      const result = await proposePatch({
        projectRoot,
        caseId: 'sql-injection',
        providerName: 'mock',
        attempt: 1,
      });
      const patch = await readFile(result.patchPath, 'utf8');
      const savedRecord: unknown = JSON.parse(await readFile(result.recordPath, 'utf8'));

      expect(patch).toContain('diff --git a/source.ts b/source.ts');
      expect(result.record).toMatchObject({
        provider: 'mock',
        model: 'patchproof-mock-v1',
        scenario: 'good',
        parameters: { maxTokens: 4096, temperature: 0 },
        patchSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      expect(result.record.promptSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.record.prompt.user).not.toContain("missing@example.test' OR 2=2 --");
      expect(savedRecord).toEqual(result.record);
    } finally {
      await rm(projectRoot, { recursive: true });
    }
  });
});
