import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer as createVulnerableServer } from '../vulnerable/source.js';

describe('path traversal vulnerability reproduction', () => {
  it('confirms the vulnerable snapshot can read a private lab fixture', async () => {
    const response = await request(createVulnerableServer, '/api/files', {
      params: { path: '../private/secret.txt' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain('LAB-ONLY-SECRET-4b119');
  });
});
