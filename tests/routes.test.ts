import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { handleRequest, type HealthProvider } from '../src/server/routes.js';
import { createPendingEvent } from '../src/core/event.js';
import type { ConfirmationEvent } from '../src/core/types.js';
import type { EventStore } from '../src/server/store.js';

class InMemoryStore implements EventStore {
  private events: ConfirmationEvent[] = [];

  async list(): Promise<ConfirmationEvent[]> {
    return [...this.events];
  }

  async get(id: string): Promise<ConfirmationEvent | undefined> {
    return this.events.find((e) => e.id === id);
  }

  async upsert(event: ConfirmationEvent): Promise<void> {
    const idx = this.events.findIndex((e) => e.fingerprint === event.fingerprint);
    if (idx >= 0) {
      this.events[idx] = event;
    } else {
      this.events.push(event);
    }
  }

  async update(event: ConfirmationEvent): Promise<void> {
    const idx = this.events.findIndex((e) => e.id === event.id);
    if (idx >= 0) {
      this.events[idx] = event;
    }
  }

  async saveAll(events: ConfirmationEvent[]): Promise<void> {
    this.events = [...events];
  }
}

function makeEvent(id: string): ConfirmationEvent {
  return createPendingEvent({
    id,
    tool: 'codex',
    source: { kind: 'tmux', session: 'main', window: '0', pane: '0' },
    fingerprint: `fp_${id}`,
    evidence: ['test evidence'],
    extract: { kind: 'apply_patch', risk: 'medium', summary: 'Test' },
    now: '2026-01-01T00:00:00.000Z'
  });
}

async function request(
  server: Server,
  method: string,
  path: string,
  body?: string
): Promise<{ status: number; body: unknown }> {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server not listening');

  const url = `http://127.0.0.1:${address.port}${path}`;
  const options: RequestInit = { method };
  if (body !== undefined) {
    options.headers = { 'content-type': 'application/json' };
    options.body = body;
  }
  const res = await fetch(url, options);

  const json = await res.json() as unknown;
  return { status: res.status, body: json };
}

const mockHealth: HealthProvider = {
  watcher: () => ({ ok: true, running: true, lastScanAt: '2026-01-01T00:00:00.000Z', errorCount: 0 })
};

describe('HTTP routes', () => {
  let store: InMemoryStore;
  let server: Server;

  beforeEach(async () => {
    store = new InMemoryStore();
    server = createServer((req, res) => {
      void handleRequest(req, res, store, mockHealth);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
  });

  afterEach(() => {
    server.close();
  });

  it('GET /health returns ok with watcher state', async () => {
    const res = await request(server, 'GET', '/health');
    assert.equal(res.status, 200);
    const body = res.body as { ok: boolean; watcher: { running: boolean }; store: { ok: boolean } };
    assert.equal(body.ok, true);
    assert.equal(body.watcher.running, true);
    assert.equal(body.store.ok, true);
  });

  it('GET /events returns empty list', async () => {
    const res = await request(server, 'GET', '/events');
    assert.equal(res.status, 200);
    assert.deepEqual((res.body as { events: unknown[] }).events, []);
  });

  it('GET /events returns stored events', async () => {
    await store.saveAll([makeEvent('evt_1')]);
    const res = await request(server, 'GET', '/events');
    assert.equal(res.status, 200);
    const body = res.body as { events: ConfirmationEvent[] };
    assert.equal(body.events.length, 1);
    assert.equal(body.events[0]!.id, 'evt_1');
  });

  it('GET /events?status=pending filters by status', async () => {
    await store.saveAll([makeEvent('evt_1')]);
    const res = await request(server, 'GET', '/events?status=pending');
    const body = res.body as { events: ConfirmationEvent[] };
    assert.equal(body.events.length, 1);

    const res2 = await request(server, 'GET', '/events?status=resolved');
    const body2 = res2.body as { events: ConfirmationEvent[] };
    assert.equal(body2.events.length, 0);
  });

  it('GET /events?tool=codex filters by tool', async () => {
    await store.saveAll([makeEvent('evt_1')]);
    const res = await request(server, 'GET', '/events?tool=codex');
    const body = res.body as { events: ConfirmationEvent[] };
    assert.equal(body.events.length, 1);

    const res2 = await request(server, 'GET', '/events?tool=claude');
    const body2 = res2.body as { events: ConfirmationEvent[] };
    assert.equal(body2.events.length, 0);
  });

  it('GET /events/:id returns a single event', async () => {
    await store.saveAll([makeEvent('evt_1')]);
    const res = await request(server, 'GET', '/events/evt_1');
    assert.equal(res.status, 200);
    const body = res.body as { event: ConfirmationEvent };
    assert.equal(body.event.id, 'evt_1');
  });

  it('GET /events/:id returns 404 for unknown event', async () => {
    const res = await request(server, 'GET', '/events/evt_missing');
    assert.equal(res.status, 404);
  });

  it('POST /events/:id/ack acknowledges an event', async () => {
    await store.saveAll([makeEvent('evt_1')]);
    const res = await request(server, 'POST', '/events/evt_1/ack');
    assert.equal(res.status, 200);
    const body = res.body as { event: ConfirmationEvent };
    assert.equal(body.event.status, 'acknowledged');
    assert.ok(body.event.acknowledgedAt);
  });

  it('POST /events/:id/resolve resolves an event', async () => {
    await store.saveAll([makeEvent('evt_1')]);
    const res = await request(server, 'POST', '/events/evt_1/resolve');
    assert.equal(res.status, 200);
    const body = res.body as { event: ConfirmationEvent };
    assert.equal(body.event.status, 'resolved');
    assert.ok(body.event.resolvedAt);
  });

  it('POST /events/:id/ignore ignores an event', async () => {
    await store.saveAll([makeEvent('evt_1')]);
    const res = await request(server, 'POST', '/events/evt_1/ignore');
    assert.equal(res.status, 200);
    const body = res.body as { event: ConfirmationEvent };
    assert.equal(body.event.status, 'ignored');
  });

  it('POST /events/:id/snooze snoozes with until', async () => {
    await store.saveAll([makeEvent('evt_1')]);
    const res = await request(server, 'POST', '/events/evt_1/snooze', JSON.stringify({ until: '2026-01-01T01:00:00.000Z' }));
    assert.equal(res.status, 200);
    const body = res.body as { event: ConfirmationEvent };
    assert.equal(body.event.status, 'snoozed');
    assert.equal(body.event.snoozedUntil, '2026-01-01T01:00:00.000Z');
  });

  it('returns 400 for invalid transition', async () => {
    const event = makeEvent('evt_1');
    event.status = 'resolved';
    await store.saveAll([event]);
    const res = await request(server, 'POST', '/events/evt_1/ack');
    assert.equal(res.status, 400);
  });

  it('returns 404 for unknown path', async () => {
    const res = await request(server, 'GET', '/unknown');
    assert.equal(res.status, 404);
  });

  it('GET /panes returns 502 when tmux is not available', async () => {
    const res = await request(server, 'GET', '/panes');
    // In test environment tmux is likely not running, so expect 502
    // If tmux happens to be running, expect 200 with panes array
    assert.ok(res.status === 502 || res.status === 200);
    if (res.status === 200) {
      const body = res.body as { total: number; panes: unknown[] };
      assert.equal(typeof body.total, 'number');
      assert.ok(Array.isArray(body.panes));
    }
  });

  it('OPTIONS returns CORS headers', async () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server not listening');
    const res = await fetch(`http://127.0.0.1:${address.port}/events`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.ok(res.headers.get('access-control-allow-origin'));
  });
});
