import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintText } from '../src/core/fingerprint.js';

describe('fingerprintText', () => {
  it('produces a sha256-prefixed hash', () => {
    const result = fingerprintText(['hello', 'world']);
    assert.ok(result.startsWith('sha256:'));
    assert.equal(result.length, 7 + 64); // "sha256:" + 64 hex chars
  });

  it('is deterministic', () => {
    const a = fingerprintText(['a', 'b', 'c']);
    const b = fingerprintText(['a', 'b', 'c']);
    assert.equal(a, b);
  });

  it('produces different hashes for different inputs', () => {
    const a = fingerprintText(['hello']);
    const b = fingerprintText(['world']);
    assert.notEqual(a, b);
  });

  it('is sensitive to ordering', () => {
    const a = fingerprintText(['a', 'b']);
    const b = fingerprintText(['b', 'a']);
    assert.notEqual(a, b);
  });
});
