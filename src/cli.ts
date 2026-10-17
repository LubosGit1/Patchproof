#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runBenchmark } from './benchmark/benchmark.js';
import { proposePatch } from './providers/propose.js';
import { parseProviderName } from './providers/provider.js';
import { CASE_IDS } from './verification/cases.js';
import { evidenceRelativePaths, verifyPatch } from './verification/verify.js';

export function formatHelp(): string {
  return [
    'PatchProof - propose and verify security fixes',
    '',
    'Usage:',
    '  patchproof [--help]',
    '  patchproof verify --case <id> --patch <file.diff>',
    '  patchproof propose --case <id> --provider <mock|anthropic> [--attempt N] [--model ID] [--output file.diff]',
    '  patchproof bench --provider <mock|anthropic> --attempts N',
    '',
    `Cases: ${CASE_IDS.join(', ')}`,
    '',
    'The Anthropic provider requires ANTHROPIC_API_KEY; ANTHROPIC_MODEL can override its default model.',
  ].join('\n');
}

function parseOptions(args: string[], allowed: readonly string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    const value = args[index + 1];
    if (!option || !allowed.includes(option)) {
      throw new Error(`Unknown option: ${option ?? ''}`);
    }
    if (!value || value.startsWith('--')) {
      throw new Error(`Option ${option ?? ''} requires a value`);
    }
    if (options.has(option)) {
      throw new Error(`Repeated option: ${option}`);
    }
    options.set(option, value);
    index += 1;
  }
  return options;
}

function requiredOption(options: Map<string, string>, option: string): string {
  const value = options.get(option);
  if (!value) throw new Error(`Missing required option: ${option}`);
  return value;
}

function positiveInteger(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${option} must be a positive integer`);
  }
  return parsed;
}

export async function runCli(
  args: string[],
  write: (message: string) => void = console.log,
): Promise<number> {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    write(formatHelp());
    return 0;
  }

  if (args[0] !== 'verify' && args[0] !== 'propose' && args[0] !== 'bench') {
    write(`Unknown command: ${args[0]}\n\n${formatHelp()}`);
    return 2;
  }

  try {
    const projectRoot = process.cwd();
    if (args[0] === 'verify') {
      const options = parseOptions(args.slice(1), ['--case', '--patch']);
      if (!options.has('--case') || !options.has('--patch')) {
        throw new Error('Usage: patchproof verify --case <id> --patch <file.diff>');
      }
      const result = await verifyPatch({
        caseId: requiredOption(options, '--case'),
        patchPath: requiredOption(options, '--patch'),
        projectRoot,
      });
      const paths = evidenceRelativePaths(projectRoot, result);
      write(JSON.stringify({
        verdict: result.evidence.verdict,
        reasoning: result.evidence.reasoning,
        runId: result.evidence.runId,
        evidence: paths,
      }, null, 2));
      return result.evidence.verdict === 'VERIFIED_FIX' ? 0 : 1;
    }

    if (args[0] === 'propose') {
      const options = parseOptions(args.slice(1), [
        '--case',
        '--provider',
        '--attempt',
        '--model',
        '--output',
      ]);
      const result = await proposePatch({
        projectRoot,
        caseId: requiredOption(options, '--case'),
        providerName: parseProviderName(requiredOption(options, '--provider')),
        attempt: options.has('--attempt')
          ? positiveInteger(requiredOption(options, '--attempt'), '--attempt')
          : 1,
        ...(options.has('--model') ? { model: requiredOption(options, '--model') } : {}),
        ...(options.has('--output') ? { outputPath: requiredOption(options, '--output') } : {}),
      });
      write(JSON.stringify({
        provider: result.record.provider,
        model: result.record.model,
        ...(result.record.scenario ? { mockScenario: result.record.scenario } : {}),
        patch: result.patchPath,
        promptAndAttemptRecord: result.recordPath,
        patchSha256: result.record.patchSha256,
      }, null, 2));
      return 0;
    }

    const options = parseOptions(args.slice(1), ['--provider', '--attempts']);
    const result = await runBenchmark({
      projectRoot,
      providerName: parseProviderName(requiredOption(options, '--provider')),
      attemptsPerCase: positiveInteger(requiredOption(options, '--attempts'), '--attempts'),
    });
    write(JSON.stringify({
      benchmark: result.jsonPath,
      report: result.markdownPath,
      totalAttempts: result.evidence.totalAttempts,
      verdicts: result.evidence.verdicts,
      naive: result.evidence.naive,
    }, null, 2));
    return 0;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    write(JSON.stringify({ error: detail }, null, 2));
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(detail);
      process.exitCode = 1;
    },
  );
}
