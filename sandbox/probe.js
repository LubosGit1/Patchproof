export function isSandboxProbe(value) {
    if (!value || typeof value !== 'object')
        return false;
    const probe = value;
    return probe.schemaVersion === 1
        && typeof probe.networkBlocked === 'boolean'
        && typeof probe.testWriteDenied === 'boolean'
        && typeof probe.workspaceWritable === 'boolean'
        && typeof probe.nonRoot === 'boolean'
        && typeof probe.memoryLimit === 'string'
        && typeof probe.cpuLimit === 'string'
        && typeof probe.processLimit === 'string';
}
