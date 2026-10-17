import type { Server } from 'node:http';

export type LabServerFactory = () => Server;

export interface LabResponse {
  status: number;
  body: string;
}

export async function request(
  createServer: LabServerFactory,
  path: string,
  options: { params?: Record<string, string>; headers?: Record<string, string> } = {},
): Promise<LabResponse> {
  const server = createServer();
  const listening = new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  await listening;

  const address = server.address();
  if (!address || typeof address === 'string') {
    await closeServer(server);
    throw new Error('Lab server did not bind to a TCP address');
  }

  const url = new URL(path, `http://127.0.0.1:${address.port}`);
  for (const [key, value] of Object.entries(options.params ?? {})) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url, {
      ...(options.headers ? { headers: options.headers } : {}),
      signal: AbortSignal.timeout(2_000),
    });
    return { status: response.status, body: await response.text() };
  } finally {
    await closeServer(server);
  }
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}
