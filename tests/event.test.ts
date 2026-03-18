import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPendingEvent, canTransition, transitionEvent, mergeEvent } from '../src/core/event.js';
import type { ConfirmationEvent } from '../src/core/types.js';

function makePendingEvent(): ConfirmationEvent {
  return createPendingEvent({
    id: 'evt_test123',
    tool: 'codex',
    source: { kind: 'tmux', session: 'main', window: '0', pane: '0' },
    fingerprint: 'sha256:abc123',
    evidence: ['line 1', 'line 2'],
    extract: { kind: 'apply_patch', risk: 'medium', summary: 'Test event' },
    now: '2026-01-01T00:00:00.000Z'
  });
}

describe('createPendingEvent', () => {
  it('creates an event with pending status', () => {
    const event = makePendingEvent();
    assert.equal(event.status, 'pending');
    assert.equal(event.id, 'evt_test123');
    assert.equal(event.tool, 'codex');
    assert.equal(event.kind, 'apply_patch');
    assert.equal(event.risk, 'medium');
    assert.equal(event.firstSeenAt, '2026-01-01T00:00:00.000Z');
    assert.equal(event.lastSeenAt, '2026-01-01T00:00:00.000Z');
  });
});

describe('canTransition', () => {
  it('allows pending -> acknowledged', () => {
    assert.equal(canTransition('pending', 'acknowledged'), true);
  });

  it('allows pending -> resolved', () => {
    assert.equal(canTransition('pending', 'resolved'), true);
  });

  it('allows pending -> snoozed', () => {
    assert.equal(canTransition('pending', 'snoozed'), true);
  });

  it('allows pending -> ignored', () => {
    assert.equal(canTransition('pending', 'ignored'), true);
  });

  it('disallows resolved -> pending', () => {
    assert.equal(canTransition('resolved', 'pending'), false);
  });

  it('disallows ignored -> pending', () => {
    assert.equal(canTransition('ignored', 'pending'), false);
  });

  it('allows snoozed -> pending (re-trigger)', () => {
    assert.equal(canTransition('snoozed', 'pending'), true);
  });

  it('allows acknowledged -> resolved', () => {
    assert.equal(canTransition('acknowledged', 'resolved'), true);
  });
});

describe('transitionEvent', () => {
  it('transitions pending to acknowledged', () => {
    const event = makePendingEvent();
    const now = '2026-01-01T00:01:00.000Z';
    const result = transitionEvent(event, 'acknowledged', now)!;
    assert.ok(result);
    assert.equal(result.status, 'acknowledged');
    assert.equal(result.acknowledgedAt, now);
    assert.equal(result.lastSeenAt, now);
  });

  it('transitions pending to snoozed with until', () => {
    const event = makePendingEvent();
    const now = '2026-01-01T00:01:00.000Z';
    const result = transitionEvent(event, 'snoozed', now, { snoozedUntil: '2026-01-01T01:00:00.000Z' })!;
    assert.ok(result);
    assert.equal(result.status, 'snoozed');
    assert.equal(result.snoozedUntil, '2026-01-01T01:00:00.000Z');
  });

  it('transitions pending to resolved', () => {
    const event = makePendingEvent();
    const now = '2026-01-01T00:01:00.000Z';
    const result = transitionEvent(event, 'resolved', now)!;
    assert.ok(result);
    assert.equal(result.status, 'resolved');
    assert.equal(result.resolvedAt, now);
  });

  it('returns undefined for invalid transition', () => {
    const event = makePendingEvent();
    const resolved = transitionEvent(event, 'resolved', '2026-01-01T00:01:00.000Z')!;
    assert.ok(resolved);
    const result = transitionEvent(resolved, 'pending', '2026-01-01T00:02:00.000Z');
    assert.equal(result, undefined);
  });
});

describe('mergeEvent', () => {
  it('updates lastSeenAt and evidence', () => {
    const existing = makePendingEvent();
    const candidate = makePendingEvent();
    candidate.evidence = ['new line 1', 'new line 2'];
    candidate.lastSeenAt = '2026-01-01T00:05:00.000Z';

    const merged = mergeEvent(existing, candidate, '2026-01-01T00:05:00.000Z');
    assert.equal(merged.lastSeenAt, '2026-01-01T00:05:00.000Z');
    assert.deepEqual(merged.evidence, ['new line 1', 'new line 2']);
    assert.equal(merged.firstSeenAt, '2026-01-01T00:00:00.000Z');
  });
});
