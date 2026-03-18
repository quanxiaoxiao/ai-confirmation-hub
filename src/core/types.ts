export type EventStatus =
  | 'pending'
  | 'acknowledged'
  | 'snoozed'
  | 'resolved'
  | 'ignored';

export type EventKind =
  | 'apply_patch'
  | 'overwrite_file'
  | 'run_command'
  | 'network_access'
  | 'permission_request'
  | 'interactive_prompt'
  | 'menu_selection'
  | 'warning_continue'
  | 'task_complete'
  | 'unknown_confirmation';

export type RiskLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface EventSource {
  kind: 'tmux';
  session: string;
  window: string;
  pane: string;
}

export interface ConfirmationEvent {
  id: string;
  status: EventStatus;
  tool: 'codex' | 'claude' | 'opencode' | 'unknown';
  source: EventSource;
  project?: string;
  taskTitle?: string;
  kind: EventKind;
  risk: RiskLevel;
  summary: string;
  evidence: string[];
  fingerprint: string;
  firstSeenAt: string;
  lastSeenAt: string;
  snoozedUntil?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface MatchCondition {
  contains: string;
}

export interface RuleMatch {
  all?: MatchCondition[];
  any?: MatchCondition[];
}

export interface RuleExtract {
  kind: EventKind;
  risk: RiskLevel;
  summary: string;
}

export interface DetectionRule {
  id: string;
  enabled: boolean;
  match: RuleMatch;
  extract: RuleExtract;
}
