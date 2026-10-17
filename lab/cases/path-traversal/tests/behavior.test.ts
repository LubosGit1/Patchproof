import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer } from '../source.js';

describe('path traversal behaviour checks', () => {
  it('keeps published files available', async () => {
    const response = await request(createLabServer, '/api/files', {
      params: { path: 'public/readme.txt' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain('PatchProof local demo document.');
  });
});
