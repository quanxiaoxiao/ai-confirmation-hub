import { createServer, type Server } from 'node:http';
import type { EventStore } from './store.js';
import { handleRequest, type HealthProvider } from './routes.js';

export function startServer(
  port: number,
  store: EventStore,
  health?: HealthProvider
): Server {
  const server = createServer((req, res) => {
    void handleRequest(req, res, store, health);
  });

  server.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });

  return server;
}
