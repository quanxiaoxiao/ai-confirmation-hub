import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import type { EventStore } from './store.js';
import { createRouter, type HealthProvider } from './routes.js';

export function startServer(
  port: number,
  store: EventStore,
  health?: HealthProvider,
): ServerType {
  const app = createRouter(store, health);

  const server = serve({
    fetch: app.fetch,
    port,
  }, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });

  return server;
}
