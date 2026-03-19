import { z } from 'zod';

export const eventStatusSchema = z.enum([
  'pending',
  'acknowledged',
  'snoozed',
  'resolved',
  'ignored',
]);

export const eventKindSchema = z.enum([
  'apply_patch',
  'overwrite_file',
  'run_command',
  'network_access',
  'permission_request',
  'interactive_prompt',
  'menu_selection',
  'warning_continue',
  'task_complete',
  'unknown_confirmation',
]);

export const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const toolSchema = z.enum(['codex', 'claude', 'opencode', 'unknown']);

export const eventSourceSchema = z.object({
  kind: z.literal('tmux'),
  session: z.string(),
  window: z.string(),
  pane: z.string(),
});

export const createEventBodySchema = z.object({
  id: z.string(),
  tool: toolSchema,
  source: eventSourceSchema,
  kind: eventKindSchema,
  risk: riskLevelSchema,
  summary: z.string(),
  evidence: z.array(z.string()).optional(),
  fingerprint: z.string().optional(),
});

export const snoozeBodySchema = z.object({
  until: z.string().optional(),
});

export const eventsQuerySchema = z.object({
  status: eventStatusSchema.optional(),
  tool: toolSchema.optional(),
  project: z.string().optional(),
});

export const panesQuerySchema = z.object({
  tool: toolSchema.optional(),
});
