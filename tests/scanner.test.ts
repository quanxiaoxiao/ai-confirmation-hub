import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createScanner } from '../src/watcher/scanner.js';
import type { AppConfig } from '../src/core/config.js';
import type { DetectionRule, ConfirmationEvent } from '../src/core/types.js';
import type { EventStore } from '../src/server/store.js';

// In-memory store for testing
class InMemoryStore implements EventStore {
  events: ConfirmationEvent[] = [];

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

const testConfig: AppConfig = {
  scanIntervalMs: 60000, // long interval so it doesn't auto-fire during tests
  captureLines: 100,
  notificationCooldownMs: 60000,
  eventRetentionDays: 7,
  rescanOnUserAction: true,
  tmux: { enabled: true },
  store: { stateDir: './state' }
};

const testRules: DetectionRule[] = [
  {
    id: 'rule_test',
    enabled: true,
    match: { any: [{ contains: 'confirm' }] },
    extract: { kind: 'unknown_confirmation', risk: 'low', summary: 'Test confirmation' }
  }
];

describe('Scanner', () => {
  it('creates a scanner with initial state', () => {
    const store = new InMemoryStore();
    const scanner = createScanner(testConfig, testRules, store);
    const state = scanner.state();

    assert.equal(state.running, false);
    assert.equal(state.lastScanAt, null);
    assert.equal(state.lastScanPaneCount, 0);
    assert.equal(state.lastScanDetections, 0);
    assert.equal(state.errorCount, 0);
  });

  it('scanOnce runs without throwing', async () => {
    const store = new InMemoryStore();
    const scanner = createScanner(testConfig, testRules, store);

    // Should not throw regardless of whether tmux is available
    const result = await scanner.scanOnce();

    assert.ok(result.panes >= 0);
    assert.ok(result.detections >= 0);
    assert.ok(result.detections <= result.panes);
  });

  it('start and stop manage running state', () => {
    const store = new InMemoryStore();
    const scanner = createScanner(testConfig, testRules, store);

    scanner.start();
    assert.equal(scanner.state().running, true);

    scanner.stop();
    assert.equal(scanner.state().running, false);
  });

  it('start is idempotent', () => {
    const store = new InMemoryStore();
    const scanner = createScanner(testConfig, testRules, store);

    scanner.start();
    scanner.start(); // should not create a second interval
    assert.equal(scanner.state().running, true);

    scanner.stop();
    assert.equal(scanner.state().running, false);
  });
});
