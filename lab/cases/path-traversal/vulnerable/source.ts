import { createServer, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const caseDirectory = fileURLToPath(new URL('.', import.meta.url));
const publicDirectory = resolve(caseDirectory, 'files');

function sendText(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(body);
}

function isWithinCase(candidate: string): boolean {
  const pathFromCase = relative(caseDirectory, candidate);
  return pathFromCase !== '..'
    && !pathFromCase.startsWith(`..${sep}`);
}

export function createLabServer(): Server {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method !== 'GET' || url.pathname !== '/api/files') {
      sendText(response, 404, 'not found');
      return;
    }

    const requestedPath = url.searchParams.get('path');
    if (requestedPath === null || requestedPath.length === 0) {
      sendText(response, 400, 'path required');
      return;
    }

    const candidate = resolve(publicDirectory, requestedPath);
    if (!isWithinCase(candidate)) {
      sendText(response, 404, 'file not found');
      return;
    }

    try {
      sendText(response, 200, await readFile(candidate, 'utf8'));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        sendText(response, 404, 'file not found');
        return;
      }
      throw error;
    }
  });
}
