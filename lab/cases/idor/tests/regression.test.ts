import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer } from '../source.js';

describe('IDOR visible regressions', () => {
  it('allows Alice to read her own invoice', async () => {
    const response = await request(createLabServer, '/api/invoices/inv-1001', {
      headers: { 'x-user-id': 'alice' },
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      invoice: { id: 'inv-1001', amount: 1200, description: 'Alice consulting' },
    });
  });

  it("does not return another user's record as an error-shaped success", async () => {
    const response = await request(createLabServer, '/api/invoices/inv-missing', {
      headers: { 'x-user-id': 'alice' },
    });

    expect(response.status).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'invoice_not_found' });
  });
});
