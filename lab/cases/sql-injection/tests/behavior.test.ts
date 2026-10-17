import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer } from '../source.js';

describe('SQL injection behaviour checks', () => {
  it('keeps the account lookup available for existing accounts', async () => {
    const response = await request(createLabServer, '/api/accounts', {
      params: { email: 'alice@example.test' },
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      accounts: [{ email: 'alice@example.test' }],
    });
  });
});
