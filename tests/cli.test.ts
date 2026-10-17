import { describe, expect, it } from 'vitest';

import { formatHelp, runCli } from '../src/cli.js';

describe('CLI bootstrap', () => {
  it('shows help when no command is provided', () => {
    const output: string[] = [];

    expect(runCli([], (message) => output.push(message))).toBe(0);
    expect(output).toEqual([formatHelp()]);
  });

  it('shows help for the help option', () => {
    const output: string[] = [];

    expect(runCli(['--help'], (message) => output.push(message))).toBe(0);
    expect(output[0]).toContain('Usage:');
  });

  it('rejects commands that are not implemented yet', () => {
    const output: string[] = [];

    expect(runCli(['verify'], (message) => output.push(message))).toBe(2);
    expect(output[0]).toContain('Unknown command: verify');
  });
});
