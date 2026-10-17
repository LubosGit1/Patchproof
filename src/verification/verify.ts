import { createHash, randomBytes } from 'node:crypto';
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { SANDBOX_IMAGE, buildSandboxImage, runSandboxContainer } from './docker.js';
import { CASE_IDS, isCaseId, type CaseId } from './cases.js';
import { renderEvidenceMarkdown, type VerificationEvidence } from './evidence.js';
import { MAX_PATCH_BYTES, validatePatchText } from './patch.js';
import { decideVerdict, type VerdictResult, type VerificationChecks } from './verdict.js';
import { isSandboxRunResult, type SandboxRunResult } from './types.js';

interface CaseMetadata {
  id: CaseId;
  cwe: string;
  title: string;
  description: string;
  intended_behaviour: string;
  source: 'source.ts';
  vulnerable_snapshot: 'vulnerable/source.ts';
  reference_patch: 'reference.patch';
  lab_only: true;
}

export interface VerifyOptions {
  projectRoot: string;
  caseId: string;
  patchPath: string;
}

export interface VerifyResult {
  evidence: VerificationEvidence;
  jsonPath: string;
  markdownPath: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseMetadata(value: unknown, expectedId: CaseId): CaseMetadata {
  if (!isRecord(value)
    || value.id !== expectedId
    || typeof value.cwe !== 'string'
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.intended_behaviour !== 'string'
    || value.source !== 'source.ts'
    || value.vulnerable_snapshot !== 'vulnerable/source.ts'
    || value.reference_patch !== 'reference.patch'
    || value.lab_only !== true
  ) {
    throw new Error(`Case metadata is invalid for ${expectedId}`);
  }
  return {
    id: expectedId,
    cwe: value.cwe,
    title: value.title,
    description: value.description,
    intended_behaviour: value.intended_behaviour,
    source: 'source.ts',
    vulnerable_snapshot: 'vulnerable/source.ts',
    reference_patch: 'reference.patch',
    lab_only: true,
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function emptySandboxResult(caseId: string): SandboxRunResult {
  const skipped = {
    passed: false,
    exitCode: null,
    timedOut: false,
    output: 'Not run because patch validation did not pass.',
  };
  return {
    schemaVersion: 1,
    caseId,
    patchApplied: false,
    patchValidation: { valid: false, changedLines: 0 },
    baseline: { security: skipped, reproduction: skipped, reproduced: false },
    stages: { security: skipped, regression: skipped, holdout: skipped, behavior: skipped },
  };
}

function verdictForRun(
  run: SandboxRunResult,
  hostPatchValid: boolean,
): VerdictResult {
  if (!run.baseline.reproduced || !run.baseline.reproduction.passed) {
    return {
      verdict: 'INVALID_CASE',
      reasoning: run.runnerError ?? 'The original case did not reliably reproduce the documented vulnerability.',
    };
  }
  if (!hostPatchValid || !run.patchValidation.valid || !run.patchApplied) {
    return {
      verdict: 'INVALID_PATCH',
      reasoning: run.patchValidation.reason ?? run.runnerError ?? 'The patch could not be applied cleanly.',
    };
  }
  if (run.runnerError) {
    return { verdict: 'SANDBOX_ERROR', reasoning: run.runnerError };
  }

  const checks: VerificationChecks = {
    patchValid: true,
    baselineSecurityFailed: !run.baseline.security.passed
      && run.baseline.security.output.includes('AssertionError'),
    baselineReproductionPassed: run.baseline.reproduction.passed,
    securityPassed: run.stages.security.passed,
    regressionPassed: run.stages.regression.passed,
    holdoutPassed: run.stages.holdout.passed,
    behaviorPassed: run.stages.behavior.passed,
  };
  return decideVerdict(checks);
}

async function readPatchFile(patchPath: string): Promise<{ text: string; reason?: string }> {
  try {
    const info = await lstat(patchPath);
    if (info.isSymbolicLink() || !info.isFile()) {
      return { text: '', reason: 'Patch path must be a regular, non-symlink file' };
    }
    if (info.size > MAX_PATCH_BYTES) {
      return { text: '', reason: `Patch exceeds the ${MAX_PATCH_BYTES}-byte limit` };
    }
    return { text: await readFile(patchPath, 'utf8') };
  } catch (error) {
    return { text: '', reason: `Could not read patch file: ${errorMessage(error)}` };
  }
}

async function runInSandbox(
  projectRoot: string,
  caseId: CaseId,
  patchText: string,
): Promise<SandboxRunResult> {
  await ensureSandboxImage(projectRoot);
  const inputDirectory = await mkdtemp(join(tmpdir(), 'patchproof-input-'));
  try {
    await chmod(inputDirectory, 0o711);
    const inputPath = join(inputDirectory, 'patch.diff');
    await writeFile(inputPath, patchText, { mode: 0o444 });
    const command = runSandboxContainer(projectRoot, inputDirectory, caseId);
    let parsed: unknown;
    try {
      parsed = JSON.parse(command.stdout);
    } catch (error) {
      throw new Error(`Sandbox returned invalid JSON: ${errorMessage(error)}; ${command.stderr}`);
    }

    if (!isSandboxRunResult(parsed)) {
      throw new Error(`Sandbox returned an invalid result: ${command.stderr}`);
    }
    return parsed;
  } finally {
    await rm(inputDirectory, { recursive: true });
  }
}

const sandboxImageBuilds = new Map<string, Promise<void>>();

function ensureSandboxImage(projectRoot: string): Promise<void> {
  const existing = sandboxImageBuilds.get(projectRoot);
  if (existing) return existing;

  const building = Promise.resolve()
    .then(() => buildSandboxImage(projectRoot))
    .then(() => undefined);
  sandboxImageBuilds.set(projectRoot, building);
  return building;
}

async function writeEvidence(
  projectRoot: string,
  evidence: VerificationEvidence,
): Promise<{ jsonPath: string; markdownPath: string }> {
  const outputDirectory = resolve(projectRoot, 'results', evidence.case.id, evidence.runId);
  await mkdir(outputDirectory, { recursive: true });
  if (await realpath(outputDirectory) !== outputDirectory) {
    throw new Error('Evidence output path must not traverse a symlink');
  }

  const jsonPath = join(outputDirectory, 'verification.json');
  const markdownPath = join(outputDirectory, 'verification.md');
  await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o644 });
  await writeFile(markdownPath, renderEvidenceMarkdown(evidence), { mode: 0o644 });
  return { jsonPath, markdownPath };
}

export async function verifyPatch(options: VerifyOptions): Promise<VerifyResult> {
  if (!isCaseId(options.caseId)) {
    throw new Error(`Unknown case "${options.caseId}". Available cases: ${CASE_IDS.join(', ')}`);
  }

  const projectRoot = await realpath(options.projectRoot);
  const caseRoot = resolve(projectRoot, 'lab/cases', options.caseId);
  const metadataValue: unknown = JSON.parse(await readFile(resolve(caseRoot, 'metadata.json'), 'utf8'));
  const metadata = parseMetadata(metadataValue, options.caseId);
  const vulnerableSource = await readFile(resolve(caseRoot, metadata.vulnerable_snapshot), 'utf8');
  const referenceSource = await readFile(resolve(caseRoot, metadata.source), 'utf8');
  const patchPath = resolve(options.patchPath);
  const patchFile = await readPatchFile(patchPath);
  const patchText = patchFile.text;
  const patchValidation = patchFile.reason
    ? { valid: false as const, reason: patchFile.reason }
    : validatePatchText(patchText);
  const runId = `${new Date().toISOString().replaceAll(/[-:.]/g, '')}-${randomBytes(4).toString('hex')}`;
  const sandbox: VerificationEvidence['sandbox'] = {
    image: SANDBOX_IMAGE,
    network: 'none' as const,
    rootFilesystem: 'read-only' as const,
    user: '10001:10001' as const,
    limits: {
      memory: '1g' as const,
      cpus: 1 as const,
      pids: 64 as const,
      stageTimeoutMs: 20_000 as const,
    },
    run: emptySandboxResult(options.caseId),
  };
  let verdict: VerdictResult;

  if (!patchValidation.valid) {
    verdict = { verdict: 'INVALID_PATCH', reasoning: patchValidation.reason };
  } else {
    try {
      sandbox.run = await runInSandbox(projectRoot, options.caseId, patchText);
      verdict = verdictForRun(sandbox.run, true);
    } catch (error) {
      sandbox.error = errorMessage(error);
      verdict = { verdict: 'SANDBOX_ERROR', reasoning: sandbox.error };
    }
  }

  const evidence: VerificationEvidence = {
    schemaVersion: 1,
    runId,
    createdAt: new Date().toISOString(),
    case: {
      id: metadata.id,
      cwe: metadata.cwe,
      title: metadata.title,
      description: metadata.description,
      intendedBehaviour: metadata.intended_behaviour,
    },
    patch: {
      fileName: basename(patchPath).replaceAll(/[^A-Za-z0-9._-]/g, '_'),
      sha256: sha256(patchText),
      bytes: Buffer.byteLength(patchText, 'utf8'),
      diff: patchText,
      valid: patchValidation.valid,
      changedLines: patchValidation.valid ? patchValidation.changedLines : 0,
      ...(patchValidation.valid ? {} : { reason: patchValidation.reason }),
    },
    sourceHashes: {
      vulnerable: sha256(vulnerableSource),
      reference: sha256(referenceSource),
    },
    sandbox,
    verdict: verdict.verdict,
    reasoning: verdict.reasoning,
  };
  const paths = await writeEvidence(projectRoot, evidence);
  return { evidence, ...paths };
}

export function evidenceRelativePaths(projectRoot: string, result: VerifyResult): {
  json: string;
  markdown: string;
} {
  return {
    json: relative(projectRoot, result.jsonPath),
    markdown: relative(projectRoot, result.markdownPath),
  };
}
