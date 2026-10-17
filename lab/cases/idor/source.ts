import { createServer, type Server, type ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

interface Invoice {
  id: string;
  owner_id: string;
  amount: number;
  description: string;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export function createLabServer(): Server {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    CREATE TABLE invoices (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT NOT NULL
    );
    INSERT INTO invoices VALUES
      ('inv-1001', 'alice', 1200, 'Alice consulting'),
      ('inv-2001', 'bob', 2300, 'Bob equipment'),
      ('inv-2002', 'bob', 3400, 'Bob travel'),
      ('inv-3001', 'charlie', 4500, 'Charlie services');
  `);

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const invoiceId = /^\/api\/invoices\/([a-z0-9-]+)$/.exec(url.pathname)?.[1];
    if (request.method !== 'GET' || invoiceId === undefined) {
      sendJson(response, 404, { error: 'not_found' });
      return;
    }

    const userId = request.headers['x-user-id'];
    if (typeof userId !== 'string' || userId.length === 0) {
      sendJson(response, 401, { error: 'authentication_required' });
      return;
    }

    const invoice = database
      .prepare('SELECT id, owner_id, amount, description FROM invoices WHERE id = ? AND owner_id = ?')
      .get(invoiceId, userId) as Invoice | undefined;
    if (!invoice) {
      sendJson(response, 404, { error: 'invoice_not_found' });
      return;
    }

    sendJson(response, 200, {
      invoice: {
        id: invoice.id,
        amount: invoice.amount,
        description: invoice.description,
      },
    });
  });
  server.once('close', () => database.close());
  return server;
}
