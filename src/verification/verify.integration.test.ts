import { describe, expect, it } from 'vitest';

import { verifyPatch } from './verify.js';

const scenarios = [
  {
    caseId: 'sql-injection',
    patchPath: 'lab/cases/sql-injection/reference.patch',
    verdict: 'VERIFIED_FIX',
  },
  {
    caseId: 'sql-injection',
    patchPath: 'lab/cases/sql-injection/known-bad/narrow-blacklist.patch',
    verdict: 'FALSE_SUCCESS',
  },
  {
    caseId: 'idor',
    patchPath: 'lab/cases/idor/known-bad/narrow-blacklist.patch',
    verdict: 'FALSE_SUCCESS',
  },
  {
    caseId: 'path-traversal',
    patchPath: 'lab/cases/path-traversal/known-bad/narrow-blacklist.patch',
    verdict: 'FALSE_SUCCESS',
  },
  {
    caseId: 'sql-injection',
    patchPath: 'lab/cases/sql-injection/known-bad/disable-endpoint.patch',
    verdict: 'REGRESSION',
  },
] as const;

describe('Docker verification pipeline', () => {
  it.runIf(process.env.PATCHPROOF_DOCKER_INTEGRATION === '1')(
    'verifies reference and rejects narrow or endpoint-disabling fixes',
    async () => {
      const projectRoot = process.cwd();
      for (const scenario of scenarios) {
        const result = await verifyPatch({
          projectRoot,
          caseId: scenario.caseId,
          patchPath: scenario.patchPath,
        });
        expect(
          result.evidence.verdict,
          `${scenario.caseId} with ${scenario.patchPath}: ${result.evidence.reasoning}`,
        ).toBe(scenario.verdict);
      }
    },
    300_000,
  );
});
