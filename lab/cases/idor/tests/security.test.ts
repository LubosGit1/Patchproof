import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer } from '../source.js';

const visibleForeignInvoices = ['inv-2001', 'inv-2002'];

describe('IDOR security regression', () => {
  it.each(visibleForeignInvoices)('does not disclose invoice %s to Alice', async (invoiceId) => {
    const response = await request(createLabServer, `/api/invoices/${invoiceId}`, {
      headers: { 'x-user-id': 'alice' },
    });

    expect(response.status).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'invoice_not_found' });
  });

  it('requires an authenticated user', async () => {
    const response = await request(createLabServer, '/api/invoices/inv-1001');

    expect(response.status).toBe(401);
    expect(JSON.parse(response.body)).toEqual({ error: 'authentication_required' });
  });
});
