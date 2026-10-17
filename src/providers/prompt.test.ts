import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildProviderPrompt } from './prompt.js';

describe('provider prompt boundaries', () => {
  it('includes only source, description, and visible security/regression tests', async () => {
    const { prompt } = await buildProviderPrompt(process.cwd(), 'sql-injection');
    const vulnerableSource = await readFile(
      resolve(process.cwd(), 'lab/cases/sql-injection/vulnerable/source.ts'),
      'utf8',
    );
    const visibleSecurity = await readFile(
      resolve(process.cwd(), 'lab/cases/sql-injection/tests/security.test.ts'),
      'utf8',
    );
    const visibleRegression = await readFile(
      resolve(process.cwd(), 'lab/cases/sql-injection/tests/regression.test.ts'),
      'utf8',
    );
    const text = `${prompt.system}\n${prompt.user}`;

    expect(text).toContain(vulnerableSource);
    expect(text).toContain(visibleSecurity);
    expect(text).toContain(visibleRegression);
    expect(text).not.toContain("missing@example.test' OR 2=2 --");
    expect(text).not.toContain('known-bad');
    expect(text).not.toContain('reference.patch');
    expect(text).not.toContain('holdout.test.ts');
  });
});
