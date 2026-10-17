import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer } from '../source.js';

describe('IDOR behaviour checks', () => {
  it('keeps the invoice endpoint available for the owner', async () => {
    const response = await request(createLabServer, '/api/invoices/inv-1001', {
      headers: { 'x-user-id': 'alice' },
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      invoice: { id: 'inv-1001', amount: 1200 },
    });
  });
});
