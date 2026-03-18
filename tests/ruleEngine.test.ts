import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ruleMatches, findFirstMatchingRule, findAllMatchingRules, loadRulesFromFile } from '../src/core/ruleEngine.js';
import type { DetectionRule } from '../src/core/types.js';

const applyPatchRule: DetectionRule = {
  id: 'rule_apply_patch_basic',
  enabled: true,
  match: {
    all: [
      { contains: 'apply' },
      { contains: 'changes' }
    ],
    any: [
      { contains: 'confirm' },
      { contains: 'press enter' },
      { contains: 'yes/no' }
    ]
  },
  extract: {
    kind: 'apply_patch',
    risk: 'medium',
    summary: 'Waiting for confirmation to apply changes'
  }
};

const overwriteRule: DetectionRule = {
  id: 'rule_overwrite_file_basic',
  enabled: true,
  match: {
    any: [
      { contains: 'overwrite' },
      { contains: 'replace file' },
      { contains: 'already exists' }
    ]
  },
  extract: {
    kind: 'overwrite_file',
    risk: 'high',
    summary: 'Waiting for confirmation to overwrite file'
  }
};

const permissionRule: DetectionRule = {
  id: 'rule_permission_request_basic',
  enabled: true,
  match: {
    any: [
      { contains: 'allow' },
      { contains: 'permission' },
      { contains: 'approve' },
      { contains: 'grant access' }
    ]
  },
  extract: {
    kind: 'permission_request',
    risk: 'medium',
    summary: 'Waiting for permission confirmation'
  }
};

const disabledRule: DetectionRule = {
  id: 'rule_disabled',
  enabled: false,
  match: {
    any: [{ contains: 'anything' }]
  },
  extract: {
    kind: 'unknown_confirmation',
    risk: 'low',
    summary: 'Should not match'
  }
};

const allRules = [applyPatchRule, overwriteRule, permissionRule, disabledRule];

describe('ruleMatches', () => {
  it('matches apply_patch rule with all + any conditions', () => {
    const text = 'Apply these changes?\nPress Enter to continue.';
    assert.equal(ruleMatches(applyPatchRule, text), true);
  });

  it('fails when all conditions are not met', () => {
    const text = 'Apply this?\nPress Enter to continue.';
    assert.equal(ruleMatches(applyPatchRule, text), false);
  });

  it('fails when any conditions are not met', () => {
    const text = 'Apply these changes?\nDone.';
    assert.equal(ruleMatches(applyPatchRule, text), false);
  });

  it('matches overwrite rule with any-only conditions', () => {
    const text = 'File already exists. Continue?';
    assert.equal(ruleMatches(overwriteRule, text), true);
  });

  it('is case insensitive', () => {
    const text = 'OVERWRITE the file now';
    assert.equal(ruleMatches(overwriteRule, text), true);
  });

  it('does not match disabled rules', () => {
    const text = 'anything goes here';
    assert.equal(ruleMatches(disabledRule, text), false);
  });

  it('does not match unrelated text', () => {
    const text = 'Compilation successful. No errors.';
    assert.equal(ruleMatches(applyPatchRule, text), false);
    assert.equal(ruleMatches(overwriteRule, text), false);
    assert.equal(ruleMatches(permissionRule, text), false);
  });
});

describe('findFirstMatchingRule', () => {
  it('returns the first matching rule', () => {
    const text = 'Overwrite existing file?';
    const result = findFirstMatchingRule(allRules, text);
    assert.equal(result?.id, 'rule_overwrite_file_basic');
  });

  it('returns undefined when no rule matches', () => {
    const text = 'No confirmation here';
    const result = findFirstMatchingRule(allRules, text);
    assert.equal(result, undefined);
  });
});

describe('findAllMatchingRules', () => {
  it('returns all matching rules', () => {
    // This text matches both permission (contains "allow") and overwrite (contains "already exists")
    const text = 'File already exists. Allow overwrite?';
    const results = findAllMatchingRules(allRules, text);
    assert.ok(results.length >= 2);
    const ids = results.map((r) => r.id);
    assert.ok(ids.includes('rule_overwrite_file_basic'));
    assert.ok(ids.includes('rule_permission_request_basic'));
  });
});

import { join } from 'node:path';

describe('loadRulesFromFile', () => {
  it('loads rules from the default config file', async () => {
    const rules = await loadRulesFromFile(
      join(process.cwd(), 'config', 'default-rules.json')
    );
    assert.ok(rules.length >= 5);
    assert.equal(rules[0]!.id, 'rule_apply_patch_basic');
  });
});
