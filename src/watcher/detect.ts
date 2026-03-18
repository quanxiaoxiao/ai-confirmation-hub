import { createPendingEvent } from '../core/event.js';
import { fingerprintText } from '../core/fingerprint.js';
import { findFirstMatchingRule } from '../core/ruleEngine.js';
import type { ConfirmationEvent, DetectionRule } from '../core/types.js';
import type { TmuxPaneRef } from './tmux.js';

export function inferTool(text: string): ConfirmationEvent['tool'] {
  const lower = text.toLowerCase();
  const tools: { name: ConfirmationEvent['tool']; pos: number }[] = [
    { name: 'codex', pos: lower.lastIndexOf('codex') },
    { name: 'claude', pos: lower.lastIndexOf('claude') },
    { name: 'opencode', pos: lower.lastIndexOf('opencode') },
  ];
  const best = tools.filter((t) => t.pos >= 0).sort((a, b) => b.pos - a.pos)[0];
  return best ? best.name : 'unknown';
}

const MATCH_TAIL_LINES = 20;

function tailLines(text: string, n: number): string {
  const lines = text.split('\n');
  return lines.slice(-n).join('\n');
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
  // Only match rules against the last N lines to avoid false positives
  // from conversation history or scrollback content
  const recentText = tailLines(text, MATCH_TAIL_LINES);
  const rule = findFirstMatchingRule(rules, recentText);
  if (!rule) {
    return undefined;
  }

  const evidence = pickEvidence(recentText);
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
