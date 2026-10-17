import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export const SANDBOX_IMAGE = 'patchproof-sandbox:0.1.0';

export interface DockerCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function sandboxRunArguments(inputDirectory: string | undefined, caseId?: string): string[] {
  const args = [
    'run',
    '--rm',
    '--network=none',
    '--read-only',
    '--user=10001:10001',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--pids-limit=64',
    '--memory=1g',
    '--cpus=1',
    '--tmpfs',
    '/work:rw,nosuid,nodev,size=512m,mode=1777',
    '--tmpfs',
    '/tmp:rw,nosuid,nodev,noexec,size=64m,mode=1777',
  ];

  if (inputDirectory) {
    args.push('--mount', `type=bind,src=${resolve(inputDirectory)},dst=/input,readonly`);
  }
  args.push(SANDBOX_IMAGE);
  if (caseId) args.push(caseId);
  return args;
}

export function runDockerCommand(
  args: string[],
  projectRoot: string,
  timeoutMs: number,
): DockerCommandResult {
  const result = spawnSync('docker', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 4_000_000,
    timeout: timeoutMs,
  });

  if (result.error) {
    throw new Error(`Docker command failed: ${result.error.message}`);
  }
  if (result.status === null) {
    throw new Error(`Docker command exceeded its ${timeoutMs}ms time limit`);
  }
  if (result.status !== 0) {
    const details = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    throw new Error(`Docker exited with status ${result.status}: ${details}`);
  }

  return {
    exitCode: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function buildSandboxImage(projectRoot: string): DockerCommandResult {
  return runDockerCommand(
    ['build', '--file', 'Dockerfile.sandbox', '--tag', SANDBOX_IMAGE, '.'],
    projectRoot,
    180_000,
  );
}

export function runSandboxContainer(
  projectRoot: string,
  inputDirectory: string,
  caseId: string,
): DockerCommandResult {
  return runDockerCommand(sandboxRunArguments(inputDirectory, caseId), projectRoot, 150_000);
}

export function runSandboxProbe(projectRoot: string): DockerCommandResult {
  return runDockerCommand(sandboxRunArguments(undefined, '--probe'), projectRoot, 5_000);
}
