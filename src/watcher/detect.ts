import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createPendingEvent } from '../core/event.js';
import { fingerprintText } from '../core/fingerprint.js';
import { findFirstMatchingRule } from '../core/ruleEngine.js';
import type { ConfirmationEvent, DetectionRule } from '../core/types.js';
import type { TmuxPaneRef } from './tmux.js';

const execFileAsync = promisify(execFile);

const TOOL_KEYWORDS: { name: ConfirmationEvent['tool']; pattern: RegExp }[] = [
  { name: 'opencode', pattern: /opencode/i },
  { name: 'codex', pattern: /codex/i },
  { name: 'claude', pattern: /claude/i },
];

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

export function inferToolFromCommand(command: string): ConfirmationEvent['tool'] {
  for (const { name, pattern } of TOOL_KEYWORDS) {
    if (pattern.test(command)) return name;
  }
  return 'unknown';
}

export async function inferToolFromPid(pid: string): Promise<ConfirmationEvent['tool']> {
  // Recursively search child processes (up to 3 levels deep)
  const visited = new Set<string>();
  const queue = [pid];
  let depth = 0;
  const maxDepth = 3;

  while (queue.length > 0 && depth < maxDepth) {
    const nextQueue: string[] = [];
    for (const currentPid of queue) {
      if (visited.has(currentPid)) continue;
      visited.add(currentPid);
      try {
        const { stdout } = await execFileAsync('pgrep', ['-P', currentPid]);
        const childPids = stdout.trim().split('\n').filter(Boolean);
        for (const cpid of childPids) {
          try {
            const { stdout: cmdline } = await execFileAsync('ps', ['-p', cpid, '-o', 'command=']);
            const tool = inferToolFromCommand(cmdline);
            if (tool !== 'unknown') return tool;
            nextQueue.push(cpid);
          } catch { /* process may have exited */ }
        }
      } catch { /* no children or pgrep failed */ }
    }
    queue.length = 0;
    queue.push(...nextQueue);
    depth++;
  }
  return 'unknown';
}

const MATCH_TAIL_LINES = 5;

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
