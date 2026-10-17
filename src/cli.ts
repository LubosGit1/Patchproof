#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CASE_IDS } from './verification/cases.js';
import { evidenceRelativePaths, verifyPatch } from './verification/verify.js';

export function formatHelp(): string {
  return [
    'PatchProof - verify proposed security fixes',
    '',
    'Usage:',
    '  patchproof [--help]',
    '  patchproof verify --case <id> --patch <file.diff>',
    '',
    `Cases: ${CASE_IDS.join(', ')}`,
  ].join('\n');
}

function parseVerifyArgs(args: string[]): { caseId: string; patchPath: string } {
  let caseId: string | undefined;
  let patchPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Option ${option ?? ''} requires a value`);
    }
    if (option === '--case' && !caseId) {
      caseId = value;
    } else if (option === '--patch' && !patchPath) {
      patchPath = value;
    } else {
      throw new Error(`Unknown or repeated verify option: ${option}`);
    }
    index += 1;
  }
  if (!caseId || !patchPath) {
    throw new Error('Usage: patchproof verify --case <id> --patch <file.diff>');
  }
  return { caseId, patchPath };
}

export async function runCli(
  args: string[],
  write: (message: string) => void = console.log,
): Promise<number> {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    write(formatHelp());
    return 0;
  }

  if (args[0] !== 'verify') {
    write(`Unknown command: ${args[0]}\n\n${formatHelp()}`);
    return 2;
  }

  try {
    const options = parseVerifyArgs(args.slice(1));
    const projectRoot = process.cwd();
    const result = await verifyPatch({ ...options, projectRoot });
    const paths = evidenceRelativePaths(projectRoot, result);
    write(JSON.stringify({
      verdict: result.evidence.verdict,
      reasoning: result.evidence.reasoning,
      runId: result.evidence.runId,
      evidence: paths,
    }, null, 2));
    return result.evidence.verdict === 'VERIFIED_FIX' ? 0 : 1;
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
