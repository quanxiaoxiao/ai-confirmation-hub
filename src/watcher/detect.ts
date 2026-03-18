import { createPendingEvent } from '../core/event.js';
import { fingerprintText } from '../core/fingerprint.js';
import { findFirstMatchingRule } from '../core/ruleEngine.js';
import type { ConfirmationEvent, DetectionRule } from '../core/types.js';
import type { TmuxPaneRef } from './tmux.js';

function inferTool(text: string): ConfirmationEvent['tool'] {
  const lower = text.toLowerCase();
  if (lower.includes('codex')) return 'codex';
  if (lower.includes('claude')) return 'claude';
  if (lower.includes('opencode')) return 'opencode';
  return 'unknown';
}

function pickEvidence(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-5);
}

function buildEventId(fingerprint: string): string {
  return `evt_${fingerprint.slice(7, 19)}`;
}

export function detectConfirmationEvent(
  paneRef: TmuxPaneRef,
  text: string,
  rules: DetectionRule[],
  now: string
): ConfirmationEvent | undefined {
  const rule = findFirstMatchingRule(rules, text);
  if (!rule) {
    return undefined;
  }

  const evidence = pickEvidence(text);
  const fingerprint = fingerprintText([
    paneRef.session,
    paneRef.window,
    paneRef.pane,
    rule.id,
    ...evidence
  ]);

  return createPendingEvent({
    id: buildEventId(fingerprint),
    tool: inferTool(text),
    source: {
      kind: 'tmux',
      session: paneRef.session,
      window: paneRef.window,
      pane: paneRef.pane
    },
    fingerprint,
    evidence,
    extract: rule.extract,
    now
  });
}
