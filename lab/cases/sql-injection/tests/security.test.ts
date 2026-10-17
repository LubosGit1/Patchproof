import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer } from '../source.js';

const visiblePayloads = [
  "' OR '1'='1",
  "admin@example.test' --",
  "' UNION SELECT 99, 'attacker@example.test', 'admin' --",
];

describe('SQL injection security regression', () => {
  it.each(visiblePayloads)('does not return accounts for injected email %s', async (email) => {
    const response = await request(createLabServer, '/api/accounts', { params: { email } });

    expect(response.status).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'account_not_found' });
  });
});
