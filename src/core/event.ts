import type { ConfirmationEvent, EventSource, EventStatus, RuleExtract } from './types.js';

export interface CreateEventInput {
  id: string;
  tool: ConfirmationEvent['tool'];
  source: EventSource;
  fingerprint: string;
  evidence: string[];
  extract: RuleExtract;
  project?: string;
  taskTitle?: string;
  now: string;
}

export function createPendingEvent(input: CreateEventInput): ConfirmationEvent {
  const event: ConfirmationEvent = {
    id: input.id,
    status: 'pending',
    tool: input.tool,
    source: input.source,
    kind: input.extract.kind,
    risk: input.extract.risk,
    summary: input.extract.summary,
    evidence: input.evidence,
    fingerprint: input.fingerprint,
    firstSeenAt: input.now,
    lastSeenAt: input.now
  };
  if (input.project !== undefined) event.project = input.project;
  if (input.taskTitle !== undefined) event.taskTitle = input.taskTitle;
  return event;
}

const validTransitions: Record<EventStatus, EventStatus[]> = {
  pending: ['acknowledged', 'snoozed', 'resolved', 'ignored'],
  acknowledged: ['resolved', 'ignored'],
  snoozed: ['pending', 'acknowledged', 'resolved', 'ignored'],
  resolved: [],
  ignored: []
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return validTransitions[from].includes(to);
}

export function transitionEvent(
  event: ConfirmationEvent,
  to: EventStatus,
  now: string,
  extra?: { snoozedUntil?: string }
): ConfirmationEvent | undefined {
  if (!canTransition(event.status, to)) {
    return undefined;
  }

  const updated: ConfirmationEvent = { ...event, status: to, lastSeenAt: now };

  if (to === 'acknowledged') {
    updated.acknowledgedAt = now;
  }
  if (to === 'resolved') {
    updated.resolvedAt = now;
  }
  if (to === 'snoozed' && extra?.snoozedUntil) {
    updated.snoozedUntil = extra.snoozedUntil;
  }

  return updated;
}

export function mergeEvent(
  existing: ConfirmationEvent,
  candidate: ConfirmationEvent,
  now: string
): ConfirmationEvent {
  return {
    ...existing,
    lastSeenAt: now,
    evidence: candidate.evidence
  };
}
