export interface TestStageResult {
  passed: boolean;
  exitCode: number | null;
  timedOut: boolean;
  output: string;
}

export interface SandboxRunResult {
  schemaVersion: 1;
  caseId: string;
  patchApplied: boolean;
  patchValidation: {
    valid: boolean;
    changedLines: number;
    reason?: string;
  };
  baseline: {
    security: TestStageResult;
    reproduction: TestStageResult;
    reproduced: boolean;
  };
  stages: {
    security: TestStageResult;
    regression: TestStageResult;
    holdout: TestStageResult;
    behavior: TestStageResult;
  };
  runnerError?: string;
}

export function isSandboxRunResult(value: unknown): value is SandboxRunResult {
  if (!value || typeof value !== 'object') return false;
  if (!isRecord(value)) return false;
  return value.schemaVersion === 1
    && typeof value.caseId === 'string'
    && typeof value.patchApplied === 'boolean'
    && isRecord(value.patchValidation)
    && typeof value.patchValidation.valid === 'boolean'
    && typeof value.patchValidation.changedLines === 'number'
    && isRecord(value.baseline)
    && isTestStageResult(value.baseline.security)
    && isTestStageResult(value.baseline.reproduction)
    && typeof value.baseline.reproduced === 'boolean'
    && isRecord(value.stages)
    && isTestStageResult(value.stages.security)
    && isTestStageResult(value.stages.regression)
    && isTestStageResult(value.stages.holdout)
    && isTestStageResult(value.stages.behavior)
    && (value.runnerError === undefined || typeof value.runnerError === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTestStageResult(value: unknown): value is TestStageResult {
  if (!isRecord(value)) return false;
  return typeof value.passed === 'boolean'
    && (typeof value.exitCode === 'number' || value.exitCode === null)
    && typeof value.timedOut === 'boolean'
    && typeof value.output === 'string';
}
