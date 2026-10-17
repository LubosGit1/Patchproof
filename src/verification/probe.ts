export interface SandboxProbe {
  schemaVersion: 1;
  networkBlocked: boolean;
  testWriteDenied: boolean;
  workspaceWritable: boolean;
  nonRoot: boolean;
  memoryLimit: string;
  cpuLimit: string;
  processLimit: string;
}

export function isSandboxProbe(value: unknown): value is SandboxProbe {
  if (!value || typeof value !== 'object') return false;
  if (!('schemaVersion' in value)
    || !('networkBlocked' in value)
    || !('testWriteDenied' in value)
    || !('workspaceWritable' in value)
    || !('nonRoot' in value)
    || !('memoryLimit' in value)
    || !('cpuLimit' in value)
    || !('processLimit' in value)
  ) {
    return false;
  }
  return value.schemaVersion === 1
    && typeof value.networkBlocked === 'boolean'
    && typeof value.testWriteDenied === 'boolean'
    && typeof value.workspaceWritable === 'boolean'
    && typeof value.nonRoot === 'boolean'
    && typeof value.memoryLimit === 'string'
    && typeof value.cpuLimit === 'string'
    && typeof value.processLimit === 'string';
}
