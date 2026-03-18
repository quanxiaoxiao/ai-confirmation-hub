import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { mergeEvent } from '../core/event.js';
import type { ConfirmationEvent } from '../core/types.js';

export interface EventStore {
  list(): Promise<ConfirmationEvent[]>;
  get(id: string): Promise<ConfirmationEvent | undefined>;
  upsert(event: ConfirmationEvent): Promise<void>;
  update(event: ConfirmationEvent): Promise<void>;
  saveAll(events: ConfirmationEvent[]): Promise<void>;
}

export class JsonFileEventStore implements EventStore {
  constructor(private readonly filePath: string) {}

  async list(): Promise<ConfirmationEvent[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as ConfirmationEvent[];
    } catch {
      return [];
    }
  }

  async get(id: string): Promise<ConfirmationEvent | undefined> {
    const events = await this.list();
    return events.find((e) => e.id === id);
  }

  async upsert(candidate: ConfirmationEvent): Promise<void> {
    const events = await this.list();
    const existingIdx = events.findIndex((e) => e.fingerprint === candidate.fingerprint);

    if (existingIdx >= 0) {
      const existing = events[existingIdx]!;
      events[existingIdx] = mergeEvent(existing, candidate, candidate.lastSeenAt);
    } else {
      events.push(candidate);
    }

    await this.saveAll(events);
  }

  async update(event: ConfirmationEvent): Promise<void> {
    const events = await this.list();
    const idx = events.findIndex((e) => e.id === event.id);
    if (idx >= 0) {
      events[idx] = event;
      await this.saveAll(events);
    }
  }

  async saveAll(events: ConfirmationEvent[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(events, null, 2), 'utf8');
  }
}

export function defaultStoreFile(stateDir: string): string {
  return join(stateDir, 'active-events.json');
}
