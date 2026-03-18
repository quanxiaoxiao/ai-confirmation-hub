import { readFile } from 'node:fs/promises';
import type { DetectionRule } from './types.js';

const PROXIMITY_WINDOW = 5;

function includesText(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function windowMatchesRule(windowText: string, allConditions: DetectionRule['match']['all'], anyConditions: DetectionRule['match']['any']): boolean {
  const allOk = (allConditions ?? []).every((c) => includesText(windowText, c.contains));
  const anyOk = (anyConditions ?? []).length === 0
    ? true
    : (anyConditions ?? []).some((c) => includesText(windowText, c.contains));
  return allOk && anyOk;
}

export function ruleMatches(rule: DetectionRule, text: string): boolean {
  if (!rule.enabled) {
    return false;
  }

  const allConditions = rule.match.all ?? [];
  const anyConditions = rule.match.any ?? [];

  // If only `any` conditions (no `all`), a single-line match suffices
  if (allConditions.length === 0) {
    return windowMatchesRule(text, allConditions, anyConditions);
  }

  // When `all` conditions exist, require all keywords to appear
  // within a sliding window of PROXIMITY_WINDOW consecutive lines.
  // This prevents scattered keywords across unrelated output from matching.
  const lines = text.split('\n');
  if (lines.length <= PROXIMITY_WINDOW) {
    return windowMatchesRule(text, allConditions, anyConditions);
  }

  for (let i = 0; i <= lines.length - PROXIMITY_WINDOW; i++) {
    const windowText = lines.slice(i, i + PROXIMITY_WINDOW).join('\n');
    if (windowMatchesRule(windowText, allConditions, anyConditions)) {
      return true;
    }
  }

  return false;
}

export function findFirstMatchingRule(
  rules: DetectionRule[],
  text: string
): DetectionRule | undefined {
  return rules.find((rule) => ruleMatches(rule, text));
}

export function findAllMatchingRules(
  rules: DetectionRule[],
  text: string
): DetectionRule[] {
  return rules.filter((rule) => ruleMatches(rule, text));
}

export async function loadRulesFromFile(filePath: string): Promise<DetectionRule[]> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as DetectionRule[];
}
