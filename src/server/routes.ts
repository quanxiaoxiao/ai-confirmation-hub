import type { IncomingMessage, ServerResponse } from 'node:http';
import { transitionEvent } from '../core/event.js';
import type { EventStatus } from '../core/types.js';
import type { EventStore } from './store.js';

export interface HealthProvider {
  watcher: () => { ok: boolean; running: boolean; lastScanAt: string | null; errorCount: number };
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.end(JSON.stringify(body, null, 2));
}

function notFound(res: ServerResponse): void {
  writeJson(res, 404, { error: 'not_found' });
}

function badRequest(res: ServerResponse, message: string): void {
  writeJson(res, 400, { error: 'bad_request', message });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseUrl(raw: string): { path: string; query: URLSearchParams } {
  const idx = raw.indexOf('?');
  if (idx === -1) return { path: raw, query: new URLSearchParams() };
  return { path: raw.slice(0, idx), query: new URLSearchParams(raw.slice(idx + 1)) };
}

const eventActionPattern = /^\/events\/([^/]+)\/(ack|snooze|ignore|resolve)$/;
const eventIdPattern = /^\/events\/([^/]+)$/;

const actionToStatus: Record<string, EventStatus> = {
  ack: 'acknowledged',
  snooze: 'snoozed',
  ignore: 'ignored',
  resolve: 'resolved'
};

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  store: EventStore,
  health?: HealthProvider
): Promise<void> {
  const method = req.method ?? 'GET';
  const rawUrl = req.url ?? '/';
  const { path, query } = parseUrl(rawUrl);

  // CORS preflight
  if (method === 'OPTIONS') {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type');
    res.statusCode = 204;
    res.end();
    return;
  }

  if (method === 'GET' && path === '/health') {
    const watcherHealth = health?.watcher() ?? { ok: true, running: false, lastScanAt: null, errorCount: 0 };
    writeJson(res, 200, {
      ok: watcherHealth.ok,
      watcher: watcherHealth,
      store: { ok: true }
    });
    return;
  }

  if (method === 'GET' && path === '/events') {
    let events = await store.list();

    const statusFilter = query.get('status');
    if (statusFilter) {
      events = events.filter((e) => e.status === statusFilter);
    }
    const toolFilter = query.get('tool');
    if (toolFilter) {
      events = events.filter((e) => e.tool === toolFilter);
    }
    const projectFilter = query.get('project');
    if (projectFilter) {
      events = events.filter((e) => e.project === projectFilter);
    }

    writeJson(res, 200, { events });
    return;
  }

  // GET /events/:id
  const idMatch = eventIdPattern.exec(path);
  if (method === 'GET' && idMatch) {
    const event = await store.get(idMatch[1]!);
    if (!event) {
      notFound(res);
      return;
    }
    writeJson(res, 200, { event });
    return;
  }

  // POST /events/:id/(ack|snooze|ignore|resolve)
  const actionMatch = eventActionPattern.exec(path);
  if (method === 'POST' && actionMatch) {
    const eventId = actionMatch[1]!;
    const action = actionMatch[2]!;
    const targetStatus = actionToStatus[action];

    if (!targetStatus) {
      badRequest(res, `Unknown action: ${action}`);
      return;
    }

    const event = await store.get(eventId);
    if (!event) {
      notFound(res);
      return;
    }

    const extra: { snoozedUntil?: string } = {};
    if (action === 'snooze') {
      const body = await readBody(req);
      try {
        const parsed = JSON.parse(body) as { until?: string };
        if (parsed.until !== undefined) {
          extra.snoozedUntil = parsed.until;
        }
      } catch {
        // allow empty body for snooze with no until
      }
    }

    const now = new Date().toISOString();
    const updated = transitionEvent(event, targetStatus, now, extra);

    if (!updated) {
      badRequest(res, `Cannot transition from ${event.status} to ${targetStatus}`);
      return;
    }

    await store.update(updated);
    writeJson(res, 200, { event: updated });
    return;
  }

  notFound(res);
}
