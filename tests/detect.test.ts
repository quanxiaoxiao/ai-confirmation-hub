import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detectConfirmationEvent } from '../src/watcher/detect.js';
import type { DetectionRule } from '../src/core/types.js';
import type { TmuxPaneRef } from '../src/watcher/tmux.js';

import { join } from 'node:path';

const fixturesDir = join(process.cwd(), 'tests', 'fixtures');

async function loadFixture(name: string): Promise<string> {
  return readFile(join(fixturesDir, name), 'utf8');
}

async function loadDefaultRules(): Promise<DetectionRule[]> {
  const raw = await readFile(join(process.cwd(), 'config', 'default-rules.json'), 'utf8');
  return JSON.parse(raw) as DetectionRule[];
}

const paneRef: TmuxPaneRef = { session: 'main', window: '0', pane: '1' };
const now = '2026-01-01T00:00:00.000Z';

describe('detectConfirmationEvent with fixtures', () => {
  it('detects codex apply-patch confirmation', async () => {
    const text = await loadFixture('codex-apply-patch.txt');
    const rules = await loadDefaultRules();
    const event = detectConfirmationEvent(paneRef, text, rules, now)!;

    assert.ok(event, 'Expected event to be detected');
    assert.equal(event.kind, 'apply_patch');
    assert.equal(event.risk, 'medium');
    assert.equal(event.tool, 'codex');
    assert.equal(event.status, 'pending');
    assert.ok(event.evidence.length > 0);
    assert.ok(event.fingerprint.startsWith('sha256:'));
    assert.ok(event.id.startsWith('evt_'));
  });

  it('detects claude overwrite confirmation', async () => {
    const text = await loadFixture('claude-overwrite.txt');
    const rules = await loadDefaultRules();
    const event = detectConfirmationEvent(paneRef, text, rules, now)!;

    assert.ok(event, 'Expected event to be detected');
    assert.equal(event.kind, 'overwrite_file');
    assert.equal(event.risk, 'high');
    assert.equal(event.tool, 'claude');
  });

  it('detects opencode permission confirmation', async () => {
    const text = await loadFixture('opencode-permission.txt');
    const rules = await loadDefaultRules();
    const event = detectConfirmationEvent(paneRef, text, rules, now)!;

    assert.ok(event, 'Expected event to be detected');
    assert.equal(event.kind, 'permission_request');
    assert.equal(event.risk, 'medium');
    assert.equal(event.tool, 'opencode');
  });

  it('returns undefined for non-confirmation text', async () => {
    const text = await loadFixture('no-confirmation.txt');
    const rules = await loadDefaultRules();
    const event = detectConfirmationEvent(paneRef, text, rules, now);

    assert.equal(event, undefined);
  });

  it('returns undefined for ambiguous text with no keywords', async () => {
    const text = await loadFixture('ambiguous-text.txt');
    const rules = await loadDefaultRules();
    const event = detectConfirmationEvent(paneRef, text, rules, now);

    assert.equal(event, undefined);
  });

  it('generates stable fingerprints for the same input', async () => {
    const text = await loadFixture('codex-apply-patch.txt');
    const rules = await loadDefaultRules();
    const event1 = detectConfirmationEvent(paneRef, text, rules, now)!;
    const event2 = detectConfirmationEvent(paneRef, text, rules, now)!;

    assert.ok(event1);
    assert.ok(event2);
    assert.equal(event1.fingerprint, event2.fingerprint);
    assert.equal(event1.id, event2.id);
  });

  it('generates different fingerprints for different panes', async () => {
    const text = await loadFixture('codex-apply-patch.txt');
    const rules = await loadDefaultRules();
    const pane2: TmuxPaneRef = { session: 'main', window: '0', pane: '2' };
    const event1 = detectConfirmationEvent(paneRef, text, rules, now)!;
    const event2 = detectConfirmationEvent(pane2, text, rules, now)!;

    assert.ok(event1);
    assert.ok(event2);
    assert.notEqual(event1.fingerprint, event2.fingerprint);
  });

  it('detects codex run-command confirmation', async () => {
    const text = await loadFixture('codex-run-command.txt');
    const rules = await loadDefaultRules();
    const event = detectConfirmationEvent(paneRef, text, rules, now)!;

    assert.ok(event, 'Expected event to be detected');
    assert.equal(event.kind, 'run_command');
    assert.equal(event.risk, 'high');
    assert.equal(event.tool, 'codex');
  });

  it('detects multiline claude permission/overwrite', async () => {
    const text = await loadFixture('multiline-claude-permission.txt');
    const rules = await loadDefaultRules();
    const event = detectConfirmationEvent(paneRef, text, rules, now)!;

    assert.ok(event, 'Expected event to be detected');
    // Should match overwrite rule (contains "overwrite") or permission (contains "allow")
    assert.ok(
      event.kind === 'overwrite_file' || event.kind === 'permission_request',
      `Expected overwrite_file or permission_request, got ${event.kind}`
    );
    assert.equal(event.tool, 'claude');
  });

  it('returns undefined for normal log output (false positive check)', async () => {
    const text = await loadFixture('false-positive-log.txt');
    const rules = await loadDefaultRules();
    const event = detectConfirmationEvent(paneRef, text, rules, now);

    assert.equal(event, undefined);
  });

  it('returns undefined for git status output (false positive check)', async () => {
    const text = await loadFixture('false-positive-git.txt');
    const rules = await loadDefaultRules();
    const event = detectConfirmationEvent(paneRef, text, rules, now);

    assert.equal(event, undefined);
  });
});
