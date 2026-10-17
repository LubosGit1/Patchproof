import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer } from '../source.js';

const visibleTraversalPaths = [
  '../private/secret.txt',
  'nested/../../private/secret.txt',
  'nested/sub/../../../private/secret.txt',
];

describe('path traversal security regression', () => {
  it.each(visibleTraversalPaths)('rejects path %s outside the public directory', async (path) => {
    const response = await request(createLabServer, '/api/files', { params: { path } });

    expect(response.status).toBe(403);
    expect(response.body).not.toContain('LAB-ONLY-SECRET');
  });
});
