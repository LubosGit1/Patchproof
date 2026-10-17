import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { MAX_CHANGED_LINES, MAX_PATCH_BYTES, applyPatchToSource, validatePatchText } from './patch.js';

const root = process.cwd();

describe('patch validation', () => {
  it.each(['sql-injection', 'idor', 'path-traversal'])('accepts and applies the %s reference patch', async (caseId) => {
    const caseRoot = resolve(root, 'lab/cases', caseId);
    const [source, diff] = await Promise.all([
      readFile(resolve(caseRoot, 'vulnerable/source.ts'), 'utf8'),
      readFile(resolve(caseRoot, 'reference.patch'), 'utf8'),
    ]);

    const validation = validatePatchText(diff);
    if (!validation.valid) throw new Error(validation.reason);

    expect(applyPatchToSource(source, validation.patch)).toBe(
      await readFile(resolve(caseRoot, 'source.ts'), 'utf8'),
    );
  });

  it('rejects paths outside the selected case source', () => {
    const patch = [
      'diff --git a/../../outside.ts b/../../outside.ts',
      '--- a/../../outside.ts',
      '+++ b/../../outside.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\n');

    expect(validatePatchText(patch)).toMatchObject({ valid: false });
  });

  it('rejects attempts to modify test files or multiple files', () => {
    const patch = [
      'diff --git a/source.ts b/source.ts',
      '--- a/source.ts',
      '+++ b/source.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      'diff --git a/tests/security.test.ts b/tests/security.test.ts',
      '--- a/tests/security.test.ts',
      '+++ b/tests/security.test.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\n');

    expect(validatePatchText(patch)).toMatchObject({ valid: false });
  });

  it('enforces the patch byte limit', () => {
    expect(validatePatchText('x'.repeat(MAX_PATCH_BYTES + 1))).toMatchObject({ valid: false });
  });

  it('enforces the changed-line limit', () => {
    const lines = Array.from({ length: MAX_CHANGED_LINES + 1 }, (_, index) => `+line${index}`);
    const patch = [
      'diff --git a/source.ts b/source.ts',
      '--- a/source.ts',
      '+++ b/source.ts',
      `@@ -1,0 +1,${lines.length} @@`,
      ...lines,
    ].join('\n');

    expect(validatePatchText(patch)).toMatchObject({ valid: false });
  });
});
