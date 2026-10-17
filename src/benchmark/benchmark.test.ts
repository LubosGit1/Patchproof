import { describe, expect, it } from 'vitest';

import type { BenchmarkAttempt } from './benchmark.js';
import { summarizeAttempts } from './benchmark.js';

function attempt(
  verdict: BenchmarkAttempt['verdict'],
  naiveSecurityPassed: boolean,
): BenchmarkAttempt {
  return {
    caseId: 'sql-injection',
    attempt: 1,
    model: 'patchproof-mock-v1',
    verdict,
    reasoning: 'test result',
    naiveSecurityPassed,
    proposalRecord: 'proposal.json',
    patchFile: 'candidate.diff',
    verificationJson: 'verification.json',
    verificationMarkdown: 'verification.md',
  };
}

describe('benchmark metrics', () => {
  it('reports verdict rates and naive accepts rejected by PatchProof', () => {
    const evidence = summarizeAttempts([
      attempt('VERIFIED_FIX', true),
      attempt('FALSE_SUCCESS', true),
      attempt('REGRESSION', true),
      attempt('FAILED_FIX', false),
      attempt('INVALID_PATCH', false),
    ], 5, 'mock', 'benchmark-1', '2026-01-01T00:00:00.000Z');

    expect(evidence.totalAttempts).toBe(5);
    expect(evidence.verdicts.VERIFIED_FIX).toEqual({ count: 1, ratePercent: 20 });
    expect(evidence.verdicts.FALSE_SUCCESS).toEqual({ count: 1, ratePercent: 20 });
    expect(evidence.byCase['sql-injection']?.verdicts.FALSE_SUCCESS).toEqual({
      count: 1,
      ratePercent: 20,
    });
    expect(evidence.byCase.idor?.verdicts.VERIFIED_FIX).toEqual({
      count: 0,
      ratePercent: 0,
    });
    expect(evidence.naive).toEqual({
      accepted: 3,
      falseAccepts: 2,
      patchProofVerified: 1,
    });
  });
});
