import type { IncomingMessage, ServerResponse } from 'node:http';
import { transitionEvent } from '../core/event.js';
import type { EventStatus } from '../core/types.js';
import type { EventStore } from './store.js';
import { focusPane, listPanesDetailed } from '../watcher/tmux.js';
import { inferToolFromCommand, inferToolFromPid } from '../watcher/detect.js';

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

const eventActionPattern = /^\/events\/([^/]+)\/(ack|snooze|ignore|resolve|focus)$/;
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

  // GET /panes — list tmux panes running AI tools
  if (method === 'GET' && path === '/panes') {
    try {
      const panes = await listPanesDetailed();
      const results = await Promise.all(
        panes.map(async (pane) => {
          // First try the direct command, then check child processes
          let tool = inferToolFromCommand(pane.command);
          if (tool === 'unknown') {
            tool = await inferToolFromPid(pane.pid);
          }
          return { ...pane, tool };
        })
      );
      const aiPanes = results.filter((p) => p.tool !== 'unknown');
      const toolFilter = query.get('tool');
      const filtered = toolFilter ? aiPanes.filter((p) => p.tool === toolFilter) : aiPanes;
      writeJson(res, 200, {
        total: filtered.length,
        panes: filtered.map((p) => ({
          session: p.session,
          window: p.window,
          windowName: p.windowName,
          pane: p.pane,
          tool: p.tool,
          command: p.command
        }))
      });
    } catch {
      writeJson(res, 502, { error: 'tmux_unavailable', message: 'Could not list tmux panes. Is tmux running?' });
    }
    return;
  }

  // POST /events — create a new event (for testing or external injection)
  if (method === 'POST' && path === '/events') {
    const body = await readBody(req);
    try {
      const parsed = JSON.parse(body) as Partial<import('../core/types.js').ConfirmationEvent>;
      if (!parsed.id || !parsed.tool || !parsed.summary || !parsed.kind || !parsed.risk || !parsed.source) {
        badRequest(res, 'Missing required fields: id, tool, summary, kind, risk, source');
        return;
      }
      const now = new Date().toISOString();
      const event: import('../core/types.js').ConfirmationEvent = {
        id: parsed.id,
        status: 'pending',
        tool: parsed.tool,
        source: parsed.source,
        kind: parsed.kind,
        risk: parsed.risk,
        summary: parsed.summary,
        evidence: parsed.evidence ?? [],
        fingerprint: parsed.fingerprint ?? `manual:${parsed.id}`,
        firstSeenAt: now,
        lastSeenAt: now
      };
      await store.upsert(event);
      writeJson(res, 201, { event });
    } catch {
      badRequest(res, 'Invalid JSON body');
    }
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

    // Focus: switch tmux to the event's pane
    if (action === 'focus') {
      const event = await store.get(eventId);
      if (!event) {
        notFound(res);
        return;
      }
      try {
        await focusPane({
          session: event.source.session,
          window: event.source.window,
          pane: event.source.pane
        });
        writeJson(res, 200, { ok: true, focused: `${event.source.session}:${event.source.window}.${event.source.pane}` });
      } catch {
        writeJson(res, 502, { error: 'focus_failed', message: 'Could not switch to tmux pane. Is tmux running?' });
      }
      return;
    }

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
