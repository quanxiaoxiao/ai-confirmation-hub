import { readFile } from 'node:fs/promises';

export interface AppConfig {
  scanIntervalMs: number;
  captureLines: number;
  notificationCooldownMs: number;
  eventRetentionDays: number;
  rescanOnUserAction: boolean;
  tmux: {
    enabled: boolean;
  };
  store: {
    stateDir: string;
  };
}

export async function loadConfig(filePath: string): Promise<AppConfig> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as AppConfig;
}
