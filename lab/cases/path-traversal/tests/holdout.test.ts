import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer } from '../source.js';

describe('path traversal hidden holdouts', () => {
  it('rejects a different normalized traversal path', async () => {
    const response = await request(createLabServer, '/api/files', {
      params: { path: './nested/../../private/secret.txt' },
    });

    expect(response.status).toBe(403);
    expect(response.body).not.toContain('LAB-ONLY-SECRET');
  });
});
