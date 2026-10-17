import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer as createVulnerableServer } from '../vulnerable/source.js';

describe('IDOR vulnerability reproduction', () => {
  it("confirms Alice can read Bob's invoice in the vulnerable snapshot", async () => {
    const response = await request(createVulnerableServer, '/api/invoices/inv-2001', {
      headers: { 'x-user-id': 'alice' },
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      invoice: { id: 'inv-2001', amount: 2300, description: 'Bob equipment' },
    });
  });
});
