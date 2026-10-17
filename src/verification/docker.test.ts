import { describe, expect, it } from 'vitest';

import { SANDBOX_IMAGE, sandboxRunArguments, runSandboxProbe } from './docker.js';
import { isSandboxProbe } from './probe.js';

describe('Docker sandbox boundary', () => {
  it('always requests the documented isolation and resource limits', () => {
    const args = sandboxRunArguments('/tmp/patchproof-input', 'sql-injection');

    expect(args).toContain('--network=none');
    expect(args).toContain('--read-only');
    expect(args).toContain('--user=10001:10001');
    expect(args).toContain('--cap-drop=ALL');
    expect(args).toContain('--security-opt=no-new-privileges');
    expect(args).toContain('--pids-limit=64');
    expect(args).toContain('--memory=1g');
    expect(args).toContain('--cpus=1');
    expect(args).toContain(SANDBOX_IMAGE);
    expect(args).not.toContain('--privileged');
  });

  it.runIf(process.env.PATCHPROOF_DOCKER_INTEGRATION === '1')(
    'blocks network and test-file writes inside the non-root resource-limited container',
    () => {
      const output = runSandboxProbe(process.cwd()).stdout;
      const probe: unknown = JSON.parse(output);

      expect(isSandboxProbe(probe)).toBe(true);
      if (!isSandboxProbe(probe)) throw new Error('Docker probe returned an invalid result');
      expect(probe.networkBlocked).toBe(true);
      expect(probe.testWriteDenied).toBe(true);
      expect(probe.workspaceWritable).toBe(true);
      expect(probe.nonRoot).toBe(true);
      expect(Number(probe.memoryLimit)).toBeLessThanOrEqual(1_073_741_824);
      expect(probe.cpuLimit).toBe('100000 100000');
      expect(probe.processLimit).toBe('64');
    },
    10_000,
  );
});
