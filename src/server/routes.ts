import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { transitionEvent } from '../core/event.js';
import type { ConfirmationEvent, EventStatus } from '../core/types.js';
import type { EventStore } from './store.js';
import { focusPane, listPanesDetailed } from '../watcher/tmux.js';
import { inferToolFromCommand, inferToolFromPid } from '../watcher/detect.js';
import {
  createEventBodySchema,
  snoozeBodySchema,
  eventsQuerySchema,
  panesQuerySchema,
} from './schemas.js';

export interface HealthProvider {
  watcher: () => { ok: boolean; running: boolean; lastScanAt: string | null; errorCount: number };
}

const actionToStatus: Record<string, EventStatus> = {
  ack: 'acknowledged',
  snooze: 'snoozed',
  ignore: 'ignored',
  resolve: 'resolved',
};

export function createRouter(store: EventStore, health?: HealthProvider): Hono {
  const app = new Hono();

  app.use('*', cors());

  app.get('/health', (c) => {
    const watcherHealth = health?.watcher() ?? { ok: true, running: false, lastScanAt: null, errorCount: 0 };
    return c.json({
      ok: watcherHealth.ok,
      watcher: watcherHealth,
      store: { ok: true },
    });
  });

  app.get('/panes', async (c) => {
    const queryResult = panesQuerySchema.safeParse({
      tool: c.req.query('tool') ?? undefined,
    });
    const toolFilter = queryResult.success ? queryResult.data.tool : undefined;

    try {
      const panes = await listPanesDetailed();
      const results = await Promise.all(
        panes.map(async (pane) => {
          let tool = inferToolFromCommand(pane.command);
          if (tool === 'unknown') {
            tool = await inferToolFromPid(pane.pid);
          }
          return { ...pane, tool };
        }),
      );
      const aiPanes = results.filter((p) => p.tool !== 'unknown');
      const filtered = toolFilter ? aiPanes.filter((p) => p.tool === toolFilter) : aiPanes;
      return c.json({
        total: filtered.length,
        panes: filtered.map((p) => ({
          session: p.session,
          window: p.window,
          windowName: p.windowName,
          pane: p.pane,
          tool: p.tool,
          command: p.command,
        })),
      });
    } catch {
      return c.json({ error: 'tmux_unavailable', message: 'Could not list tmux panes. Is tmux running?' }, 502);
    }
  });

  app.post('/events', async (c) => {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: 'bad_request', message: 'Invalid JSON body' }, 400);
    }

    const result = createEventBodySchema.safeParse(rawBody);
    if (!result.success) {
      return c.json({
        error: 'bad_request',
        message: 'Missing required fields: id, tool, summary, kind, risk, source',
        details: result.error.issues,
      }, 400);
    }

    const parsed = result.data;
    const now = new Date().toISOString();
    const event: ConfirmationEvent = {
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
      lastSeenAt: now,
    };
    await store.upsert(event);
    return c.json({ event }, 201);
  });

  app.get('/events', async (c) => {
    const queryResult = eventsQuerySchema.safeParse({
      status: c.req.query('status') ?? undefined,
      tool: c.req.query('tool') ?? undefined,
      project: c.req.query('project') ?? undefined,
    });
    const filters = queryResult.success ? queryResult.data : {};

    let events = await store.list();

    if (filters.status) {
      events = events.filter((e) => e.status === filters.status);
    }
    if (filters.tool) {
      events = events.filter((e) => e.tool === filters.tool);
    }
    if (filters.project) {
      events = events.filter((e) => e.project === filters.project);
    }

    return c.json({ events });
  });

  app.get('/events/:id', async (c) => {
    const event = await store.get(c.req.param('id'));
    if (!event) {
      return c.json({ error: 'not_found' }, 404);
    }
    return c.json({ event });
  });

  app.post('/events/:id/focus', async (c) => {
    const event = await store.get(c.req.param('id'));
    if (!event) {
      return c.json({ error: 'not_found' }, 404);
    }
    try {
      await focusPane({
        session: event.source.session,
        window: event.source.window,
        pane: event.source.pane,
      });
      return c.json({ ok: true, focused: `${event.source.session}:${event.source.window}.${event.source.pane}` });
    } catch {
      return c.json({ error: 'focus_failed', message: 'Could not switch to tmux pane. Is tmux running?' }, 502);
    }
  });

  app.post('/events/:id/:action', async (c) => {
    const eventId = c.req.param('id');
    const action = c.req.param('action');
    const targetStatus = actionToStatus[action];

    if (!targetStatus) {
      return c.json({ error: 'bad_request', message: `Unknown action: ${action}` }, 400);
    }

    const event = await store.get(eventId);
    if (!event) {
      return c.json({ error: 'not_found' }, 404);
    }

    const extra: { snoozedUntil?: string } = {};
    if (action === 'snooze') {
      try {
        const body = await c.req.json();
        const result = snoozeBodySchema.safeParse(body);
        if (result.success && result.data.until !== undefined) {
          extra.snoozedUntil = result.data.until;
        }
      } catch {
        // allow empty body for snooze with no until
      }
    }

    const now = new Date().toISOString();
    const updated = transitionEvent(event, targetStatus, now, extra);

    if (!updated) {
      return c.json({ error: 'bad_request', message: `Cannot transition from ${event.status} to ${targetStatus}` }, 400);
    }

    await store.update(updated);
    return c.json({ event: updated });
  });

  return app;
}
