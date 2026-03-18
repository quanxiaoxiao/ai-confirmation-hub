import { readFile } from 'node:fs/promises';
import type { DetectionRule } from './types.js';

function includesText(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function ruleMatches(rule: DetectionRule, text: string): boolean {
  if (!rule.enabled) {
    return false;
  }

  const allConditions = rule.match.all ?? [];
  const anyConditions = rule.match.any ?? [];

  const allOk = allConditions.every((condition) => includesText(text, condition.contains));
  const anyOk = anyConditions.length === 0
    ? true
    : anyConditions.some((condition) => includesText(text, condition.contains));

  return allOk && anyOk;
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
