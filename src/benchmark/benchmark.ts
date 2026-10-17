import { randomBytes } from 'node:crypto';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { CASE_IDS } from '../verification/cases.js';
import type { Verdict } from '../verification/verdict.js';
import { verifyPatch } from '../verification/verify.js';
import { proposePatch } from '../providers/propose.js';
import type { ProviderName } from '../providers/types.js';

export const VERDICTS: readonly Verdict[] = [
  'VERIFIED_FIX',
  'FAILED_FIX',
  'REGRESSION',
  'FALSE_SUCCESS',
  'INVALID_PATCH',
  'INVALID_CASE',
  'SANDBOX_ERROR',
];

export interface BenchmarkAttempt {
  caseId: string;
  attempt: number;
  scenario?: string;
  model: string;
  verdict: Verdict;
  reasoning: string;
  naiveSecurityPassed: boolean;
  proposalRecord: string;
  patchFile: string;
  verificationJson: string;
  verificationMarkdown: string;
}

export interface BenchmarkEvidence {
  schemaVersion: 1;
  benchmarkId: string;
  createdAt: string;
  provider: ProviderName;
  attemptsPerCase: number;
  totalAttempts: number;
  nodeVersion: string;
  verdicts: Record<Verdict, { count: number; ratePercent: number }>;
  byCase: Record<string, {
    verdicts: Record<Verdict, { count: number; ratePercent: number }>;
    naive: { accepted: number; falseAccepts: number; patchProofVerified: number };
  }>;
  naive: {
    accepted: number;
    falseAccepts: number;
    patchProofVerified: number;
  };
  attempts: BenchmarkAttempt[];
}

export interface BenchmarkResult {
  evidence: BenchmarkEvidence;
  jsonPath: string;
  markdownPath: string;
}

function newBenchmarkId(): string {
  return `${new Date().toISOString().replaceAll(/[-:.]/g, '')}-${randomBytes(4).toString('hex')}`;
}

function summarizeVerdicts(
  attempts: BenchmarkAttempt[],
): Record<Verdict, { count: number; ratePercent: number }> {
  return Object.fromEntries(
    VERDICTS.map((verdict) => {
      const count = attempts.filter((attempt) => attempt.verdict === verdict).length;
      return [verdict, {
        count,
        ratePercent: attempts.length === 0 ? 0 : Number((count / attempts.length * 100).toFixed(2)),
      }];
    }),
  ) as Record<Verdict, { count: number; ratePercent: number }>;
}

export function summarizeAttempts(
  attempts: BenchmarkAttempt[],
  attemptsPerCase: number,
  provider: ProviderName,
  benchmarkId: string,
  createdAt: string,
): BenchmarkEvidence {
  const verdicts = summarizeVerdicts(attempts);
  const naiveAccepted = attempts.filter((attempt) => attempt.naiveSecurityPassed);
  const byCase = Object.fromEntries(CASE_IDS.map((caseId) => {
    const caseAttempts = attempts.filter((attempt) => attempt.caseId === caseId);
    const caseVerdicts = summarizeVerdicts(caseAttempts);
    const caseNaiveAccepted = caseAttempts.filter((attempt) => attempt.naiveSecurityPassed);
    return [caseId, {
      verdicts: caseVerdicts,
      naive: {
        accepted: caseNaiveAccepted.length,
        falseAccepts: caseNaiveAccepted.filter((attempt) => attempt.verdict !== 'VERIFIED_FIX').length,
        patchProofVerified: caseVerdicts.VERIFIED_FIX.count,
      },
    }];
  }));
  return {
    schemaVersion: 1,
    benchmarkId,
    createdAt,
    provider,
    attemptsPerCase,
    totalAttempts: attempts.length,
    nodeVersion: process.version,
    verdicts,
    byCase,
    naive: {
      accepted: naiveAccepted.length,
      falseAccepts: naiveAccepted.filter((attempt) => attempt.verdict !== 'VERIFIED_FIX').length,
      patchProofVerified: verdicts.VERIFIED_FIX.count,
    },
    attempts,
  };
}

function markdown(evidence: BenchmarkEvidence): string {
  const verdictRows = VERDICTS.map((verdict) => {
    const item = evidence.verdicts[verdict];
    return `| ${verdict} | ${item.count} | ${item.ratePercent}% |`;
  });
  const attemptRows = evidence.attempts.map((attempt) =>
    `| ${attempt.caseId} | ${attempt.attempt} | ${attempt.scenario ?? 'n/a'} | ${attempt.verdict} | ${attempt.naiveSecurityPassed ? 'yes' : 'no'} |`);
  const caseRows = CASE_IDS.map((caseId) => {
    const item = evidence.byCase[caseId];
    if (!item) throw new Error(`Missing per-case benchmark metrics for ${caseId}`);
    return `| ${caseId} | ${item.verdicts.VERIFIED_FIX.ratePercent}% | ${item.verdicts.FALSE_SUCCESS.ratePercent}% | ${item.verdicts.FAILED_FIX.ratePercent}% | ${item.verdicts.REGRESSION.ratePercent}% | ${item.verdicts.INVALID_PATCH.ratePercent}% |`;
  });

  return [
    '# PatchProof benchmark',
    '',
    `- **Benchmark ID:** \`${evidence.benchmarkId}\``,
    `- **Created:** ${evidence.createdAt}`,
    `- **Provider:** ${evidence.provider}`,
    `- **Attempts per case:** ${evidence.attemptsPerCase}`,
    `- **Node:** \`${evidence.nodeVersion}\``,
    '',
    '## Verdict rates',
    '',
    '| Verdict | Count | Rate |',
    '|---|---:|---:|',
    ...verdictRows,
    '',
    '## Rates by case',
    '',
    '| Case | Verified fix | False success | Failed fix | Regression | Invalid patch |',
    '|---|---:|---:|---:|---:|---:|',
    ...caseRows,
    '',
    '## Naive checker comparison',
    '',
    `The naive checker (security regression test passes) would accept **${evidence.naive.accepted}** of ${evidence.totalAttempts} attempts, including **${evidence.naive.falseAccepts}** that PatchProof did not verify. PatchProof verified **${evidence.naive.patchProofVerified}** fixes.`,
    '',
    '## Attempts',
    '',
    '| Case | Attempt | Mock scenario | Verdict | Naive accepts |',
    '|---|---:|---|---|---|',
    ...attemptRows,
    '',
  ].join('\n');
}

export async function runBenchmark(options: {
  projectRoot: string;
  providerName: ProviderName;
  attemptsPerCase: number;
}): Promise<BenchmarkResult> {
  if (!Number.isSafeInteger(options.attemptsPerCase)
    || options.attemptsPerCase < 1
    || options.attemptsPerCase > 100
  ) {
    throw new Error('Attempts per case must be an integer from 1 to 100');
  }
  const projectRoot = await realpath(options.projectRoot);
  const benchmarkId = newBenchmarkId();
  const createdAt = new Date().toISOString();
  const attempts: BenchmarkAttempt[] = [];

  for (const caseId of CASE_IDS) {
    for (let attempt = 1; attempt <= options.attemptsPerCase; attempt += 1) {
      const proposal = await proposePatch({
        projectRoot,
        caseId,
        providerName: options.providerName,
        attempt,
      });
      const verification = await verifyPatch({
        projectRoot,
        caseId,
        patchPath: proposal.patchPath,
      });
      const sandboxRun = verification.evidence.sandbox.run;
      const proposalRecordPath = relative(projectRoot, join(
        projectRoot,
        'results/proposals',
        caseId,
        proposal.record.attemptId,
        'proposal.json',
      ));
      attempts.push({
        caseId,
        attempt,
        ...(proposal.record.scenario ? { scenario: proposal.record.scenario } : {}),
        model: proposal.record.model,
        verdict: verification.evidence.verdict,
        reasoning: verification.evidence.reasoning,
        naiveSecurityPassed: sandboxRun?.stages.security.passed ?? false,
        proposalRecord: proposalRecordPath,
        patchFile: relative(projectRoot, proposal.patchPath),
        verificationJson: relative(projectRoot, verification.jsonPath),
        verificationMarkdown: relative(projectRoot, verification.markdownPath),
      });
    }
  }

  const evidence = summarizeAttempts(
    attempts,
    options.attemptsPerCase,
    options.providerName,
    benchmarkId,
    createdAt,
  );
  const outputDirectory = resolve(projectRoot, 'results/benchmarks', benchmarkId);
  await mkdir(outputDirectory, { recursive: true });
  if (await realpath(outputDirectory) !== outputDirectory) {
    throw new Error('Benchmark output path must not traverse a symlink');
  }
  const jsonPath = join(outputDirectory, 'benchmark.json');
  const markdownPath = join(outputDirectory, 'benchmark.md');
  await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o644 });
  await writeFile(markdownPath, markdown(evidence), { mode: 0o644 });
  return { evidence, jsonPath, markdownPath };
}
