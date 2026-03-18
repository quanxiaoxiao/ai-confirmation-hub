import type { AppConfig } from '../core/config.js';
import type { DetectionRule } from '../core/types.js';
import type { EventStore } from '../server/store.js';
import { listPanes, capturePaneText } from './tmux.js';
import { detectConfirmationEvent } from './detect.js';

export interface ScannerState {
  running: boolean;
  lastScanAt: string | null;
  lastScanPaneCount: number;
  lastScanDetections: number;
  errorCount: number;
  timer: ReturnType<typeof setInterval> | null;
}

export interface Scanner {
  start(): void;
  stop(): void;
  state(): ScannerState;
  scanOnce(): Promise<{ panes: number; detections: number }>;
}

export function createScanner(
  config: AppConfig,
  rules: DetectionRule[],
  store: EventStore
): Scanner {
  const scanState: ScannerState = {
    running: false,
    lastScanAt: null,
    lastScanPaneCount: 0,
    lastScanDetections: 0,
    errorCount: 0,
    timer: null
  };

  async function scanOnce(): Promise<{ panes: number; detections: number }> {
    const now = new Date().toISOString();
    let panes;
    try {
      panes = await listPanes();
    } catch {
      // tmux not running or not available
      scanState.errorCount++;
      return { panes: 0, detections: 0 };
    }

    let detections = 0;

    for (const paneRef of panes) {
      try {
        const text = await capturePaneText(paneRef, config.captureLines);
        const event = detectConfirmationEvent(paneRef, text, rules, now);
        if (event) {
          await store.upsert(event);
          detections++;
        }
      } catch {
        scanState.errorCount++;
      }
    }

    scanState.lastScanAt = now;
    scanState.lastScanPaneCount = panes.length;
    scanState.lastScanDetections = detections;

    return { panes: panes.length, detections };
  }

  function start(): void {
    if (scanState.running) return;
    scanState.running = true;

    // Run first scan immediately
    void scanOnce();

    scanState.timer = setInterval(() => {
      void scanOnce();
    }, config.scanIntervalMs);
  }

  function stop(): void {
    scanState.running = false;
    if (scanState.timer !== null) {
      clearInterval(scanState.timer);
      scanState.timer = null;
    }
  }

  return {
    start,
    stop,
    state: () => ({ ...scanState }),
    scanOnce
  };
}
