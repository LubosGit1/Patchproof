import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer } from '../source.js';

describe('path traversal visible regressions', () => {
  it('serves a published file', async () => {
    const response = await request(createLabServer, '/api/files', {
      params: { path: 'public/readme.txt' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toBe('PatchProof local demo document.\n');
  });

  it('rejects an empty path without disabling the download endpoint', async () => {
    const response = await request(createLabServer, '/api/files');

    expect(response.status).toBe(400);
    expect(response.body).toBe('path required');
  });
});
