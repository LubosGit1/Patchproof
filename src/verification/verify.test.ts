import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { evidenceRelativePaths, verifyPatch } from './verify.js';

const metadata = {
  id: 'sql-injection',
  cwe: 'CWE-89',
  title: 'SQL injection in account lookup',
  source: 'source.ts',
  vulnerable_snapshot: 'vulnerable/source.ts',
  reference_patch: 'reference.patch',
  description: 'A local test case.',
  intended_behaviour: 'Only return the requested row.',
  lab_only: true,
};

describe('verification evidence', () => {
  it('writes JSON and Markdown evidence for an invalid patch without launching Docker', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'patchproof-verify-test-'));
    try {
      const caseRoot = resolve(projectRoot, 'lab/cases/sql-injection');
      await mkdir(resolve(caseRoot, 'vulnerable'), { recursive: true });
      await writeFile(resolve(caseRoot, 'metadata.json'), JSON.stringify(metadata));
      await writeFile(resolve(caseRoot, 'source.ts'), 'const fixed = true;\n');
      await writeFile(resolve(caseRoot, 'vulnerable/source.ts'), 'const vulnerable = true;\n');
      const patchPath = resolve(projectRoot, 'candidate.diff');
      const patch = [
        'diff --git a/../../outside.ts b/../../outside.ts',
        '--- a/../../outside.ts',
        '+++ b/../../outside.ts',
        '@@ -1 +1 @@',
        '-old',
        '+new',
        '```',
      ].join('\n');
      await writeFile(patchPath, patch);

      const result = await verifyPatch({ projectRoot, caseId: 'sql-injection', patchPath });
      const json = JSON.parse(await readFile(result.jsonPath, 'utf8')) as {
        verdict: string;
        patch: { diff: string; valid: boolean; sha256: string };
      };
      const markdown = await readFile(result.markdownPath, 'utf8');

      expect(result.evidence.verdict).toBe('INVALID_PATCH');
      expect(json.patch.valid).toBe(false);
      expect(json.patch.diff).toBe(patch);
      expect(json.patch.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(markdown).toContain('INVALID_PATCH');
      expect(evidenceRelativePaths(projectRoot, result).json).toMatch(/^results\/sql-injection\//);
      expect(result.evidence.sandbox.error).toBeUndefined();
    } finally {
      await rm(projectRoot, { recursive: true });
    }
  });

  it('rejects patch symlinks instead of following them', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'patchproof-verify-test-'));
    try {
      const caseRoot = resolve(projectRoot, 'lab/cases/sql-injection');
      await mkdir(resolve(caseRoot, 'vulnerable'), { recursive: true });
      await writeFile(resolve(caseRoot, 'metadata.json'), JSON.stringify(metadata));
      await writeFile(resolve(caseRoot, 'source.ts'), 'const fixed = true;\n');
      await writeFile(resolve(caseRoot, 'vulnerable/source.ts'), 'const vulnerable = true;\n');
      const realPatch = resolve(projectRoot, 'real.diff');
      const symlinkPath = resolve(projectRoot, 'candidate.diff');
      await writeFile(realPatch, 'not a patch');
      await symlink(realPatch, symlinkPath);

      const result = await verifyPatch({ projectRoot, caseId: 'sql-injection', patchPath: symlinkPath });

      expect(result.evidence.verdict).toBe('INVALID_PATCH');
      expect(result.evidence.patch.reason).toContain('non-symlink');
    } finally {
      await rm(projectRoot, { recursive: true });
    }
  });
});
