import { applyPatch, parsePatch, type StructuredPatch } from 'diff';

export const MAX_PATCH_BYTES = 16 * 1024;
export const MAX_CHANGED_LINES = 120;

export type PatchValidation =
  | { valid: true; patch: StructuredPatch; changedLines: number }
  | { valid: false; reason: string };

export function validatePatchText(patchText: string): PatchValidation {
  if (Buffer.byteLength(patchText, 'utf8') > MAX_PATCH_BYTES) {
    return { valid: false, reason: `Patch exceeds the ${MAX_PATCH_BYTES}-byte limit` };
  }

  if (patchText.includes('\uFFFD')) {
    return { valid: false, reason: 'Patch contains invalid UTF-8 replacement characters' };
  }

  const gitHeaders = patchText.match(/^diff --git .+$/gm) ?? [];
  if (gitHeaders.length !== 1 || gitHeaders[0] !== 'diff --git a/source.ts b/source.ts') {
    return { valid: false, reason: 'Patch must change exactly the case source.ts file' };
  }

  if (/^(?:new file mode|deleted file mode|old mode|new mode|rename from|rename to|copy from|copy to|GIT binary patch|Binary files )/m.test(patchText)) {
    return { valid: false, reason: 'File creation, deletion, rename, mode changes, and binary diffs are not allowed' };
  }

  let parsed: StructuredPatch[];
  try {
    parsed = parsePatch(patchText);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { valid: false, reason: `Patch could not be parsed: ${detail}` };
  }

  if (parsed.length !== 1) {
    return { valid: false, reason: 'Patch must contain exactly one file diff' };
  }

  const patch = parsed[0];
  if (!patch || patch.oldFileName !== 'a/source.ts' || patch.newFileName !== 'b/source.ts') {
    return { valid: false, reason: 'Patch paths must be exactly a/source.ts and b/source.ts' };
  }

  const pathSegments = [patch.oldFileName, patch.newFileName].flatMap((name) => name.split('/'));
  if (pathSegments.some((segment) => segment === '..' || segment === '.' || segment === '')) {
    return { valid: false, reason: 'Patch contains an unsafe path component' };
  }

  if (patch.hunks.length === 0) {
    return { valid: false, reason: 'Patch contains no hunks' };
  }

  const changedLines = patch.hunks.reduce(
    (count, hunk) => count + hunk.lines.filter((line) => line.startsWith('+') || line.startsWith('-')).length,
    0,
  );
  if (changedLines === 0) {
    return { valid: false, reason: 'Patch does not change any source lines' };
  }
  if (changedLines > MAX_CHANGED_LINES) {
    return { valid: false, reason: `Patch exceeds the ${MAX_CHANGED_LINES}-changed-line limit` };
  }

  return { valid: true, patch, changedLines };
}

export function applyPatchToSource(source: string, patch: StructuredPatch): string {
  const result = applyPatch(source, patch, { fuzzFactor: 0 });
  if (result === false) {
    throw new Error('Validated patch does not apply cleanly to the vulnerable source snapshot');
  }
  return result;
}
