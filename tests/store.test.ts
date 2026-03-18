import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonFileEventStore } from '../src/server/store.js';
import { createPendingEvent } from '../src/core/event.js';
import type { ConfirmationEvent } from '../src/core/types.js';

function makeEvent(id: string, fingerprint: string): ConfirmationEvent {
  return createPendingEvent({
    id,
    tool: 'codex',
    source: { kind: 'tmux', session: 'main', window: '0', pane: '0' },
    fingerprint,
    evidence: ['test evidence'],
    extract: { kind: 'apply_patch', risk: 'medium', summary: 'Test' },
    now: '2026-01-01T00:00:00.000Z'
  });
}

describe('JsonFileEventStore', () => {
  let storePath: string;
  let store: JsonFileEventStore;

  beforeEach(async () => {
    storePath = join(tmpdir(), `ach-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    store = new JsonFileEventStore(storePath);
    try { await rm(storePath); } catch { /* ignore */ }
  });

  it('returns empty list when file does not exist', async () => {
    const events = await store.list();
    assert.deepEqual(events, []);
  });

  it('saves and lists events', async () => {
    const event = makeEvent('evt_1', 'fp_1');
    await store.saveAll([event]);

    const events = await store.list();
    assert.equal(events.length, 1);
    assert.equal(events[0]!.id, 'evt_1');
  });

  it('gets a single event by id', async () => {
    const event = makeEvent('evt_1', 'fp_1');
    await store.saveAll([event]);

    const found = await store.get('evt_1');
    assert.ok(found !== undefined);
    assert.equal(found.id, 'evt_1');

    const notFound = await store.get('evt_missing');
    assert.equal(notFound, undefined);
  });

  it('upserts new events', async () => {
    const event = makeEvent('evt_1', 'fp_1');
    await store.upsert(event);

    const events = await store.list();
    assert.equal(events.length, 1);
  });

  it('merges existing events on upsert by fingerprint', async () => {
    const event1 = makeEvent('evt_1', 'fp_1');
    await store.upsert(event1);

    const event2 = makeEvent('evt_1', 'fp_1');
    event2.evidence = ['updated evidence'];
    event2.lastSeenAt = '2026-01-01T00:05:00.000Z';
    await store.upsert(event2);

    const events = await store.list();
    assert.equal(events.length, 1);
    assert.equal(events[0]!.lastSeenAt, '2026-01-01T00:05:00.000Z');
    assert.deepEqual(events[0]!.evidence, ['updated evidence']);
  });

  it('updates an existing event', async () => {
    const event = makeEvent('evt_1', 'fp_1');
    await store.saveAll([event]);

    const updated = { ...event, status: 'acknowledged' as const, acknowledgedAt: '2026-01-01T00:01:00.000Z' };
    await store.update(updated);

    const events = await store.list();
    assert.equal(events[0]!.status, 'acknowledged');
  });

  it('persists to disk as JSON', async () => {
    const event = makeEvent('evt_1', 'fp_1');
    await store.saveAll([event]);

    const raw = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw) as ConfirmationEvent[];
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]!.id, 'evt_1');
  });
});
