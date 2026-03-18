import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadConfig } from '../src/core/config.js';

describe('loadConfig', () => {
  it('loads the default config file', async () => {
    const config = await loadConfig(join(process.cwd(), 'config', 'default-config.json'));

    assert.equal(config.scanIntervalMs, 2000);
    assert.equal(config.captureLines, 100);
    assert.equal(config.notificationCooldownMs, 60000);
    assert.equal(config.eventRetentionDays, 7);
    assert.equal(config.rescanOnUserAction, true);
    assert.equal(config.tmux.enabled, true);
    assert.equal(config.store.stateDir, './state');
  });

  it('rejects missing config file', async () => {
    await assert.rejects(
      () => loadConfig('/nonexistent/path.json'),
      { code: 'ENOENT' }
    );
  });
});
