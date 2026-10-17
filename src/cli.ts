#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function formatHelp(): string {
  return [
    'PatchProof - verify proposed security fixes',
    '',
    'Usage:',
    '  patchproof [--help]',
    '',
    'Verification, proposal, and benchmark commands are not available yet.',
  ].join('\n');
}

export function runCli(args: string[], write: (message: string) => void = console.log): number {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    write(formatHelp());
    return 0;
  }

  write(`Unknown command: ${args[0]}\n\n${formatHelp()}`);
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli(process.argv.slice(2));
}
