import { DatabaseSync } from 'node:sqlite';
import { createServer, type Server } from 'node:http';

function sendJson(response: import('node:http').ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export function createLabServer(): Server {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL
    );
    INSERT INTO accounts (email, role) VALUES
      ('alice@example.test', 'user'),
      ('bob@example.test', 'user'),
      ('admin@example.test', 'admin');
  `);

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method !== 'GET' || url.pathname !== '/api/accounts') {
      sendJson(response, 404, { error: 'not_found' });
      return;
    }

    const email = url.searchParams.get('email');
    if (email === null || email.length === 0) {
      sendJson(response, 400, { error: 'email_required' });
      return;
    }

    const rows = database
      .prepare(`SELECT id, email, role FROM accounts WHERE email = '${email}'`)
      .all()
      .map((row) => ({ id: Number(row.id), email: String(row.email), role: String(row.role) }));

    if (rows.length === 0) {
      sendJson(response, 404, { error: 'account_not_found' });
      return;
    }

    sendJson(response, 200, { accounts: rows });
  });
  server.once('close', () => database.close());
  return server;
}
