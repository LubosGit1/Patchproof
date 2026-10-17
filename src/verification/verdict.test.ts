import { describe, expect, it } from 'vitest';

import { decideVerdict, type VerificationChecks } from './verdict.js';

const passingChecks: VerificationChecks = {
  patchValid: true,
  baselineSecurityFailed: true,
  baselineReproductionPassed: true,
  securityPassed: true,
  regressionPassed: true,
  holdoutPassed: true,
  behaviorPassed: true,
};

describe('verification verdicts', () => {
  it('verifies a patch only when every check passes', () => {
    expect(decideVerdict(passingChecks).verdict).toBe('VERIFIED_FIX');
  });

  it('classifies an invalid patch before running tests', () => {
    expect(decideVerdict({ ...passingChecks, patchValid: false }).verdict).toBe('INVALID_PATCH');
  });

  it('rejects cases that do not reproduce the vulnerability', () => {
    expect(decideVerdict({ ...passingChecks, baselineSecurityFailed: false }).verdict).toBe('INVALID_CASE');
  });

  it('classifies a persistent vulnerability as a failed fix', () => {
    expect(decideVerdict({ ...passingChecks, securityPassed: false }).verdict).toBe('FAILED_FIX');
  });

  it('classifies broken visible behaviour as a regression', () => {
    expect(decideVerdict({ ...passingChecks, regressionPassed: false }).verdict).toBe('REGRESSION');
  });

  it('catches visible-test false successes with holdouts and behaviour checks', () => {
    expect(decideVerdict({ ...passingChecks, holdoutPassed: false }).verdict).toBe('FALSE_SUCCESS');
    expect(decideVerdict({ ...passingChecks, behaviorPassed: false }).verdict).toBe('FALSE_SUCCESS');
  });
});
