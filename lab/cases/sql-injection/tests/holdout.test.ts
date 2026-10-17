import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer } from '../source.js';

describe('SQL injection hidden holdouts', () => {
  it('does not return rows for a boolean-expression mutation', async () => {
    const response = await request(createLabServer, '/api/accounts', {
      params: { email: "missing@example.test' OR 2=2 --" },
    });

    expect(response.status).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'account_not_found' });
  });
});
