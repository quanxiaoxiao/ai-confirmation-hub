import { createHash } from 'node:crypto';

export function fingerprintText(parts: string[]): string {
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update(part);
    hash.update('\n');
  }
  return `sha256:${hash.digest('hex')}`;
}
