import { describe, expect, it } from 'vitest';

import { formatHelp, runCli } from '../src/cli.js';

describe('CLI bootstrap', () => {
  it('shows help when no command is provided', async () => {
    const output: string[] = [];

    expect(await runCli([], (message) => output.push(message))).toBe(0);
    expect(output).toEqual([formatHelp()]);
  });

  it('shows help for the help option', async () => {
    const output: string[] = [];

    expect(await runCli(['--help'], (message) => output.push(message))).toBe(0);
    expect(output[0]).toContain('Usage:');
  });

  it('rejects unknown commands', async () => {
    const output: string[] = [];

    expect(await runCli(['unknown'], (message) => output.push(message))).toBe(2);
    expect(output[0]).toContain('Unknown command: unknown');
  });

  it('requires both verify options', async () => {
    const output: string[] = [];

    expect(await runCli(['verify'], (message) => output.push(message))).toBe(2);
    expect(output[0]).toContain('Usage: patchproof verify');
  });
});
