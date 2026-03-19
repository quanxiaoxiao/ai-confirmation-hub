import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
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

export function createJsonFileEventStore(filePath: string): EventStore {
  // Serialize file access so reads never observe partially-written JSON.
  let accessChain = Promise.resolve();
  const serialized = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = accessChain.then(fn, fn);
    accessChain = next.then(() => undefined, () => undefined);
    return next;
  };

  const readEvents = async (): Promise<ConfirmationEvent[]> => {
    try {
      const raw = await readFile(filePath, 'utf8');
      return JSON.parse(raw) as ConfirmationEvent[];
    } catch {
      return [];
    }
  };

  const writeEvents = async (events: ConfirmationEvent[]): Promise<void> => {
    await mkdir(dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    await writeFile(tempPath, JSON.stringify(events, null, 2), 'utf8');
    await rename(tempPath, filePath);
  };

  const list = (): Promise<ConfirmationEvent[]> => serialized(readEvents);

  const get = (id: string): Promise<ConfirmationEvent | undefined> =>
    serialized(async () => {
      const events = await readEvents();
      return events.find((e) => e.id === id);
    });

  const saveAll = (events: ConfirmationEvent[]): Promise<void> =>
    serialized(async () => {
      await writeEvents(events);
    });

  const upsert = (candidate: ConfirmationEvent): Promise<void> =>
    serialized(async () => {
      const events = await readEvents();
      const existingIdx = events.findIndex((e) => e.fingerprint === candidate.fingerprint);
      const existing = events[existingIdx];

      if (existingIdx >= 0 && existing) {
        events[existingIdx] = mergeEvent(existing, candidate, candidate.lastSeenAt);
      } else {
        events.push(candidate);
      }

      await writeEvents(events);
    });

  const update = (event: ConfirmationEvent): Promise<void> =>
    serialized(async () => {
      const events = await readEvents();
      const idx = events.findIndex((e) => e.id === event.id);
      if (idx >= 0) {
        events[idx] = event;
        await writeEvents(events);
      }
    });

  return { list, get, upsert, update, saveAll };
}

export function defaultStoreFile(stateDir: string): string {
  return join(stateDir, 'active-events.json');
}
