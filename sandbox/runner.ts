import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { applyPatchToSource, validatePatchText } from '../src/verification/patch.js';
import { CASE_IDS } from '../src/verification/cases.js';
import type { SandboxRunResult, TestStageResult } from '../src/verification/types.js';

const imageRoot = '/opt/patchproof';
const workRoot = '/work/project';
const maxStageOutputLength = 20_000;
const stageTimeoutMs = 20_000;
const notRun: TestStageResult = {
  passed: false,
  exitCode: null,
  timedOut: false,
  output: 'Not run because an earlier stage did not complete.',
};

function hasSystemErrorCode(error: unknown, expected: string[]): boolean {
  if (!(error instanceof Error)) return false;
  const code: unknown = Reflect.get(error, 'code');
  return typeof code === 'string' && expected.includes(code);
}

async function runSandboxProbe(): Promise<void> {
  const networkAllowed = await fetch('http://192.0.2.1', {
    signal: AbortSignal.timeout(500),
  }).then(() => true, () => false);
  let testWriteDenied = false;
  try {
    await writeFile(
      resolve(imageRoot, 'lab/cases/sql-injection/tests/security.test.ts'),
      'tampered',
    );
  } catch (error) {
    if (hasSystemErrorCode(error, ['EROFS', 'EACCES'])) {
      testWriteDenied = true;
    } else {
      throw error;
    }
  }

  const probePath = '/work/sandbox-probe';
  await writeFile(probePath, 'ok');
  const workspaceWritable = (await readFile(probePath, 'utf8')) === 'ok';

  const memoryLimit = (await readFile('/sys/fs/cgroup/memory.max', 'utf8')).trim();
  const cpuLimit = (await readFile('/sys/fs/cgroup/cpu.max', 'utf8')).trim();
  const processLimit = (await readFile('/sys/fs/cgroup/pids.max', 'utf8')).trim();
  const probe = {
    schemaVersion: 1,
    networkBlocked: !networkAllowed,
    testWriteDenied,
    workspaceWritable,
    nonRoot: process.getuid?.() !== 0,
    memoryLimit,
    cpuLimit,
    processLimit,
  };
  process.stdout.write(JSON.stringify(probe));
}

function trimOutput(output: string): string {
  if (output.length <= maxStageOutputLength) return output;
  return `${output.slice(0, 2_000)}\n[output truncated]\n${output.slice(-18_000)}`;
}

function runVitest(caseRoot: string, testFile: string): TestStageResult {
  const vitestCli = resolve(imageRoot, 'node_modules/vitest/vitest.mjs');
  const result = spawnSync(
    process.execPath,
    [vitestCli, 'run', '--root', caseRoot, '--reporter=dot', '--maxWorkers=1', testFile],
    {
      cwd: caseRoot,
      encoding: 'utf8',
      env: {
        CI: '1',
        HOME: '/tmp',
        NODE_ENV: 'test',
        NO_COLOR: '1',
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        TMPDIR: '/tmp',
      },
      maxBuffer: 1_000_000,
      timeout: stageTimeoutMs,
    },
  );

  const output = trimOutput(`${result.stdout ?? ''}${result.stderr ?? ''}`);
  const timedOut = result.error ? hasSystemErrorCode(result.error, ['ETIMEDOUT']) : false;
  if (result.error && !timedOut) {
    throw new Error(`Vitest could not start: ${result.error.message}`);
  }
  return {
    passed: result.status === 0,
    exitCode: result.status,
    timedOut,
    output,
  };
}

function emptyResult(caseId: string): SandboxRunResult {
  return {
    schemaVersion: 1,
    caseId,
    patchApplied: false,
    patchValidation: { valid: false, changedLines: 0 },
    baseline: { security: notRun, reproduction: notRun, reproduced: false },
    stages: {
      security: notRun,
      regression: notRun,
      holdout: notRun,
      behavior: notRun,
    },
  };
}

async function runCase(caseId: string): Promise<SandboxRunResult> {
  if (!CASE_IDS.some((allowedCase) => allowedCase === caseId)) {
    throw new Error('Unknown lab case');
  }

  const caseImageRoot = resolve(imageRoot, 'lab/cases', caseId);
  const caseWorkRoot = resolve(workRoot, 'lab/cases', caseId);
  await mkdir(resolve(workRoot, 'lab/cases'), { recursive: true });
  await cp(resolve(imageRoot, 'lab/support'), resolve(workRoot, 'lab/support'), { recursive: true });
  await cp(caseImageRoot, caseWorkRoot, { recursive: true });
  await cp(resolve(imageRoot, 'node_modules'), resolve(workRoot, 'node_modules'), { recursive: true });

  const sourcePath = resolve(caseWorkRoot, 'source.ts');
  await cp(resolve(caseWorkRoot, 'vulnerable/source.ts'), sourcePath);

  const result = emptyResult(caseId);
  const baselineSecurity = runVitest(caseWorkRoot, 'tests/security.test.ts');
  const baselineReproduction = runVitest(caseWorkRoot, 'tests/reproduction.test.ts');
  result.baseline = {
    security: baselineSecurity,
    reproduction: baselineReproduction,
    reproduced: !baselineSecurity.passed
      && baselineSecurity.output.includes('AssertionError')
      && baselineReproduction.passed,
  };

  if (!result.baseline.reproduced) {
    result.runnerError = 'The original case did not reproduce as expected.';
    return result;
  }

  const patchText = await readFile('/input/patch.diff', 'utf8');
  const validation = validatePatchText(patchText);
  if (!validation.valid) {
    result.patchValidation = { valid: false, changedLines: 0, reason: validation.reason };
    result.runnerError = validation.reason;
    return result;
  }

  const vulnerableSource = await readFile(sourcePath, 'utf8');
  let patchedSource: string;
  try {
    patchedSource = applyPatchToSource(vulnerableSource, validation.patch);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    result.patchValidation = { valid: false, changedLines: validation.changedLines, reason };
    result.runnerError = reason;
    return result;
  }
  await writeFile(sourcePath, patchedSource);
  result.patchApplied = true;
  result.patchValidation = { valid: true, changedLines: validation.changedLines };
  result.stages = {
    security: runVitest(caseWorkRoot, 'tests/security.test.ts'),
    regression: runVitest(caseWorkRoot, 'tests/regression.test.ts'),
    holdout: runVitest(caseWorkRoot, 'tests/holdout.test.ts'),
    behavior: runVitest(caseWorkRoot, 'tests/behavior.test.ts'),
  };
  return result;
}

const caseId = process.argv[2];
if (caseId === '--probe') {
  runSandboxProbe().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(JSON.stringify({ schemaVersion: 1, runnerError: message }));
    process.exitCode = 1;
  });
} else if (!caseId) {
  process.stdout.write(JSON.stringify({ schemaVersion: 1, runnerError: 'Missing case id' }));
  process.exitCode = 2;
} else {
  runCase(caseId)
    .then((result) => process.stdout.write(JSON.stringify(result)))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(JSON.stringify({ schemaVersion: 1, caseId, runnerError: message }));
      process.exitCode = 1;
    });
}
