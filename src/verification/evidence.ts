import type { SandboxRunResult } from './types.js';
import type { Verdict } from './verdict.js';

export interface VerificationEvidence {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  case: {
    id: string;
    cwe: string;
    title: string;
    description: string;
    intendedBehaviour: string;
  };
  patch: {
    fileName: string;
    sha256: string;
    bytes: number;
    diff: string;
    valid: boolean;
    changedLines: number;
    reason?: string;
  };
  sourceHashes: {
    vulnerable: string;
    reference: string;
  };
  sandbox: {
    image: string;
    network: 'none';
    rootFilesystem: 'read-only';
    user: '10001:10001';
    limits: {
      memory: '1g';
      cpus: 1;
      pids: 64;
      stageTimeoutMs: 20_000;
    };
    run: SandboxRunResult | null;
    error?: string;
  };
  verdict: Verdict;
  reasoning: string;
}

function markdownFence(value: string): string {
  const longest = Math.max(0, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length));
  return '`'.repeat(Math.max(3, longest + 1));
}

function stageStatus(passed: boolean, timedOut: boolean): string {
  if (timedOut) return 'TIMED OUT';
  return passed ? 'PASS' : 'FAIL';
}

export function renderEvidenceMarkdown(evidence: VerificationEvidence): string {
  const output = evidence.sandbox.run;
  const stages = output?.stages;
  const logs = [
    ['Baseline visible security test', output?.baseline.security.output ?? 'Not run'],
    ['Baseline vulnerability reproduction', output?.baseline.reproduction.output ?? 'Not run'],
    ['Candidate security tests', stages?.security.output ?? 'Not run'],
    ['Visible regression tests', stages?.regression.output ?? 'Not run'],
    ['Hidden holdout tests', stages?.holdout.output ?? 'Not run'],
    ['Behaviour checks', stages?.behavior.output ?? 'Not run'],
  ] as const;
  const fence = markdownFence([
    evidence.patch.diff,
    ...logs.map(([, text]) => text),
  ].join('\n'));
  const stageRows = stages
    ? [
      ['Security', stages.security],
      ['Visible regressions', stages.regression],
      ['Hidden holdouts', stages.holdout],
      ['Behaviour', stages.behavior],
    ].map(([name, result]) => {
      if (typeof name !== 'string' || !result || typeof result !== 'object') {
        throw new Error('Invalid verification stage while rendering evidence');
      }
      return `| ${name} | ${stageStatus(result.passed, result.timedOut)} | ${result.exitCode ?? 'n/a'} |`;
    }).join('\n')
    : '| Not run | n/a | n/a |';

  return [
    `# PatchProof verification: ${evidence.case.id}`,
    '',
    `- **Verdict:** \`${evidence.verdict}\``,
    `- **Reason:** ${evidence.reasoning}`,
    `- **Run ID:** \`${evidence.runId}\``,
    `- **Created:** ${evidence.createdAt}`,
    `- **Case:** ${evidence.case.title} (${evidence.case.cwe})`,
    '',
    '## Checks',
    '',
    '| Stage | Result | Exit code |',
    '|---|---|---:|',
    `| Baseline reproduction | ${output?.baseline.reproduced ? 'PASS' : 'FAIL'} | ${output?.baseline.security.exitCode ?? 'n/a'} |`,
    stageRows,
    '',
    '## Patch',
    '',
    `- SHA-256: \`${evidence.patch.sha256}\``,
    `- Size: ${evidence.patch.bytes} bytes; changed lines: ${evidence.patch.changedLines}`,
    `- Static validation: ${evidence.patch.valid ? 'PASS' : 'FAIL'}${evidence.patch.reason ? ` — ${evidence.patch.reason}` : ''}`,
    '',
    `${fence}diff`,
    evidence.patch.diff || '[Patch content unavailable]',
    fence,
    '',
    '## Source hashes',
    '',
    `- Vulnerable snapshot: \`${evidence.sourceHashes.vulnerable}\``,
    `- Reference fix: \`${evidence.sourceHashes.reference}\``,
    '',
    '## Sandbox',
    '',
    `Docker image: \`${evidence.sandbox.image}\`; network: \`${evidence.sandbox.network}\`; root filesystem: \`${evidence.sandbox.rootFilesystem}\`; user: \`${evidence.sandbox.user}\`.`,
    `Limits: ${evidence.sandbox.limits.memory} memory, ${evidence.sandbox.limits.cpus} CPU, ${evidence.sandbox.limits.pids} processes, ${evidence.sandbox.limits.stageTimeoutMs}ms per test stage.`,
    ...(evidence.sandbox.error ? [`Sandbox error: ${evidence.sandbox.error}`] : []),
    '',
    '## Test output',
    '',
    ...logs.flatMap(([name, text]) => [
      `### ${name}`,
      '',
      `${fence}text`,
      text || '[No output]',
      fence,
      '',
    ]),
  ].join('\n');
}
