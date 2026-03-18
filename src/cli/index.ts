import { join } from 'node:path';
import { loadConfig } from '../core/config.js';
import { loadRulesFromFile } from '../core/ruleEngine.js';
import { startServer } from '../server/app.js';
import { JsonFileEventStore, defaultStoreFile } from '../server/store.js';
import { createScanner } from '../watcher/scanner.js';

const PORT = 47321;

async function main(): Promise<void> {
  const configPath = join(process.cwd(), 'config', 'default-config.json');
  const rulesPath = join(process.cwd(), 'config', 'default-rules.json');

  const config = await loadConfig(configPath);
  const rules = await loadRulesFromFile(rulesPath);

  console.log(`[init] loaded ${rules.length} detection rules`);

  const store = new JsonFileEventStore(defaultStoreFile(config.store.stateDir));
  const scanner = createScanner(config, rules, store);

  const health = {
    watcher: () => {
      const s = scanner.state();
      return {
        ok: s.errorCount < 10,
        running: s.running,
        lastScanAt: s.lastScanAt,
        errorCount: s.errorCount
      };
    }
  };

  const server = startServer(PORT, store, health);

  if (config.tmux.enabled) {
    scanner.start();
    console.log(`[watcher] scanning every ${config.scanIntervalMs}ms (${config.captureLines} lines per pane)`);
  } else {
    console.log('[watcher] tmux watcher disabled by config');
  }

  // Graceful shutdown
  function shutdown(): void {
    console.log('\n[shutdown] stopping...');
    scanner.stop();
    server.close(() => {
      console.log('[shutdown] done');
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
