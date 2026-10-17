import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer } from '../source.js';

describe('SQL injection visible regressions', () => {
  it('returns only the requested account', async () => {
    const response = await request(createLabServer, '/api/accounts', {
      params: { email: 'alice@example.test' },
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      accounts: [{ id: 1, email: 'alice@example.test', role: 'user' }],
    });
  });

  it('rejects an empty lookup without disabling the endpoint', async () => {
    const response = await request(createLabServer, '/api/accounts');

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'email_required' });
  });
});
