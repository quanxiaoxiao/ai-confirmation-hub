import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRouter, type HealthProvider } from '../src/server/routes.js';
import { createPendingEvent } from '../src/core/event.js';
import type { ConfirmationEvent } from '../src/core/types.js';
import type { EventStore } from '../src/server/store.js';

function createInMemoryStore(): EventStore & { seedAll(events: ConfirmationEvent[]): void } {
  let events: ConfirmationEvent[] = [];

  return {
    async list(): Promise<ConfirmationEvent[]> {
      return [...events];
    },
    async get(id: string): Promise<ConfirmationEvent | undefined> {
      return events.find((e) => e.id === id);
    },
    async upsert(event: ConfirmationEvent): Promise<void> {
      const idx = events.findIndex((e) => e.fingerprint === event.fingerprint);
      if (idx >= 0) {
        events[idx] = event;
      } else {
        events.push(event);
      }
    },
    async update(event: ConfirmationEvent): Promise<void> {
      const idx = events.findIndex((e) => e.id === event.id);
      if (idx >= 0) {
        events[idx] = event;
      }
    },
    async saveAll(newEvents: ConfirmationEvent[]): Promise<void> {
      events = [...newEvents];
    },
    seedAll(newEvents: ConfirmationEvent[]): void {
      events = [...newEvents];
    },
  };
}

function makeEvent(id: string): ConfirmationEvent {
  return createPendingEvent({
    id,
    tool: 'codex',
    source: { kind: 'tmux', session: 'main', window: '0', pane: '0' },
    fingerprint: `fp_${id}`,
    evidence: ['test evidence'],
    extract: { kind: 'apply_patch', risk: 'medium', summary: 'Test' },
    now: '2026-01-01T00:00:00.000Z',
  });
}

const mockHealth: HealthProvider = {
  watcher: () => ({ ok: true, running: true, lastScanAt: '2026-01-01T00:00:00.000Z', errorCount: 0 }),
};

describe('HTTP routes', () => {
  let store: ReturnType<typeof createInMemoryStore>;
  let app: ReturnType<typeof createRouter>;

  beforeEach(() => {
    store = createInMemoryStore();
    app = createRouter(store, mockHealth);
  });

  const req = (method: string, path: string, body?: string): Request => {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.headers = { 'content-type': 'application/json' };
      init.body = body;
    }
    return new Request(`http://localhost${path}`, init);
  };

  const json = async (res: Response): Promise<unknown> => res.json();

  it('GET /health returns ok with watcher state', async () => {
    const res = await app.fetch(req('GET', '/health'));
    assert.equal(res.status, 200);
    const body = await json(res) as { ok: boolean; watcher: { running: boolean }; store: { ok: boolean } };
    assert.equal(body.ok, true);
    assert.equal(body.watcher.running, true);
    assert.equal(body.store.ok, true);
  });

  it('GET /events returns empty list', async () => {
    const res = await app.fetch(req('GET', '/events'));
    assert.equal(res.status, 200);
    assert.deepEqual((await json(res) as { events: unknown[] }).events, []);
  });

  it('GET /events returns stored events', async () => {
    store.seedAll([makeEvent('evt_1')]);
    const res = await app.fetch(req('GET', '/events'));
    assert.equal(res.status, 200);
    const body = await json(res) as { events: ConfirmationEvent[] };
    assert.equal(body.events.length, 1);
    assert.equal(body.events[0]!.id, 'evt_1');
  });

  it('GET /events?status=pending filters by status', async () => {
    store.seedAll([makeEvent('evt_1')]);
    const res = await app.fetch(req('GET', '/events?status=pending'));
    const body = await json(res) as { events: ConfirmationEvent[] };
    assert.equal(body.events.length, 1);

    const res2 = await app.fetch(req('GET', '/events?status=resolved'));
    const body2 = await json(res2) as { events: ConfirmationEvent[] };
    assert.equal(body2.events.length, 0);
  });

  it('GET /events?tool=codex filters by tool', async () => {
    store.seedAll([makeEvent('evt_1')]);
    const res = await app.fetch(req('GET', '/events?tool=codex'));
    const body = await json(res) as { events: ConfirmationEvent[] };
    assert.equal(body.events.length, 1);

    const res2 = await app.fetch(req('GET', '/events?tool=claude'));
    const body2 = await json(res2) as { events: ConfirmationEvent[] };
    assert.equal(body2.events.length, 0);
  });

  it('GET /events/:id returns a single event', async () => {
    store.seedAll([makeEvent('evt_1')]);
    const res = await app.fetch(req('GET', '/events/evt_1'));
    assert.equal(res.status, 200);
    const body = await json(res) as { event: ConfirmationEvent };
    assert.equal(body.event.id, 'evt_1');
  });

  it('GET /events/:id returns 404 for unknown event', async () => {
    const res = await app.fetch(req('GET', '/events/evt_missing'));
    assert.equal(res.status, 404);
  });

  it('POST /events/:id/ack acknowledges an event', async () => {
    store.seedAll([makeEvent('evt_1')]);
    const res = await app.fetch(req('POST', '/events/evt_1/ack'));
    assert.equal(res.status, 200);
    const body = await json(res) as { event: ConfirmationEvent };
    assert.equal(body.event.status, 'acknowledged');
    assert.ok(body.event.acknowledgedAt);
  });

  it('POST /events/:id/resolve resolves an event', async () => {
    store.seedAll([makeEvent('evt_1')]);
    const res = await app.fetch(req('POST', '/events/evt_1/resolve'));
    assert.equal(res.status, 200);
    const body = await json(res) as { event: ConfirmationEvent };
    assert.equal(body.event.status, 'resolved');
    assert.ok(body.event.resolvedAt);
  });

  it('POST /events/:id/ignore ignores an event', async () => {
    store.seedAll([makeEvent('evt_1')]);
    const res = await app.fetch(req('POST', '/events/evt_1/ignore'));
    assert.equal(res.status, 200);
    const body = await json(res) as { event: ConfirmationEvent };
    assert.equal(body.event.status, 'ignored');
  });

  it('POST /events/:id/snooze snoozes with until', async () => {
    store.seedAll([makeEvent('evt_1')]);
    const res = await app.fetch(req('POST', '/events/evt_1/snooze', JSON.stringify({ until: '2026-01-01T01:00:00.000Z' })));
    assert.equal(res.status, 200);
    const body = await json(res) as { event: ConfirmationEvent };
    assert.equal(body.event.status, 'snoozed');
    assert.equal(body.event.snoozedUntil, '2026-01-01T01:00:00.000Z');
  });

  it('returns 400 for invalid transition', async () => {
    const event = makeEvent('evt_1');
    event.status = 'resolved';
    store.seedAll([event]);
    const res = await app.fetch(req('POST', '/events/evt_1/ack'));
    assert.equal(res.status, 400);
  });

  it('returns 404 for unknown path', async () => {
    const res = await app.fetch(req('GET', '/unknown'));
    assert.equal(res.status, 404);
  });

  it('GET /panes returns 502 when tmux is not available', async () => {
    const res = await app.fetch(req('GET', '/panes'));
    assert.ok(res.status === 502 || res.status === 200);
    if (res.status === 200) {
      const body = await json(res) as { total: number; panes: unknown[] };
      assert.equal(typeof body.total, 'number');
      assert.ok(Array.isArray(body.panes));
    }
  });

  it('OPTIONS returns CORS headers', async () => {
    const res = await app.fetch(req('OPTIONS', '/events'));
    assert.ok(res.status === 204 || res.status === 200);
    assert.ok(res.headers.get('access-control-allow-origin'));
  });

  it('POST /events with valid body creates event', async () => {
    const body = JSON.stringify({
      id: 'evt_new',
      tool: 'codex',
      source: { kind: 'tmux', session: 'main', window: '0', pane: '0' },
      kind: 'apply_patch',
      risk: 'medium',
      summary: 'Test create',
    });
    const res = await app.fetch(req('POST', '/events', body));
    assert.equal(res.status, 201);
    const data = await json(res) as { event: ConfirmationEvent };
    assert.equal(data.event.id, 'evt_new');
    assert.equal(data.event.status, 'pending');
  });

  it('POST /events with invalid body returns 400', async () => {
    const res = await app.fetch(req('POST', '/events', JSON.stringify({ id: 'x' })));
    assert.equal(res.status, 400);
  });
});
