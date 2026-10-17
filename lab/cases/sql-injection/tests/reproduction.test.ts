import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer as createVulnerableServer } from '../vulnerable/source.js';

describe('SQL injection vulnerability reproduction', () => {
  it('confirms the vulnerable snapshot returns accounts for an injected email', async () => {
    const response = await request(createVulnerableServer, '/api/accounts', {
      params: { email: "' OR '1'='1" },
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      accounts: expect.arrayContaining([
        expect.objectContaining({ email: 'admin@example.test', role: 'admin' }),
      ]),
    });
  });
});
