export type Verdict =
  | 'VERIFIED_FIX'
  | 'FAILED_FIX'
  | 'REGRESSION'
  | 'FALSE_SUCCESS'
  | 'INVALID_PATCH'
  | 'INVALID_CASE'
  | 'SANDBOX_ERROR';

export interface VerificationChecks {
  patchValid: boolean;
  baselineSecurityFailed: boolean;
  baselineReproductionPassed: boolean;
  securityPassed: boolean;
  regressionPassed: boolean;
  holdoutPassed: boolean;
  behaviorPassed: boolean;
}

export interface VerdictResult {
  verdict: Verdict;
  reasoning: string;
}

export function decideVerdict(checks: VerificationChecks): VerdictResult {
  if (!checks.patchValid) {
    return { verdict: 'INVALID_PATCH', reasoning: 'The patch did not pass static validation or could not be applied.' };
  }
  if (!checks.baselineSecurityFailed || !checks.baselineReproductionPassed) {
    return { verdict: 'INVALID_CASE', reasoning: 'The original case did not reliably reproduce the documented vulnerability.' };
  }
  if (!checks.securityPassed) {
    return { verdict: 'FAILED_FIX', reasoning: 'At least one visible security regression test still fails after the patch.' };
  }
  if (!checks.regressionPassed) {
    return { verdict: 'REGRESSION', reasoning: 'Visible application behaviour regressed after the patch.' };
  }
  if (!checks.holdoutPassed) {
    return { verdict: 'FALSE_SUCCESS', reasoning: 'Visible checks pass, but at least one hidden holdout test fails.' };
  }
  if (!checks.behaviorPassed) {
    return { verdict: 'FALSE_SUCCESS', reasoning: 'Security checks pass, but behaviour checks detected a blocked or disabled feature.' };
  }
  return { verdict: 'VERIFIED_FIX', reasoning: 'The patch reproduces the baseline flaw, passes security and regression checks, and preserves holdout and behaviour checks.' };
}
