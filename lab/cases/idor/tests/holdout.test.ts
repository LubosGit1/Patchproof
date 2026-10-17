import { describe, expect, it } from 'vitest';

import { request } from '../../../support/http.js';
import { createLabServer } from '../source.js';

describe('IDOR hidden holdouts', () => {
  it('does not disclose an invoice belonging to a third user', async () => {
    const response = await request(createLabServer, '/api/invoices/inv-3001', {
      headers: { 'x-user-id': 'alice' },
    });

    expect(response.status).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'invoice_not_found' });
  });
});
