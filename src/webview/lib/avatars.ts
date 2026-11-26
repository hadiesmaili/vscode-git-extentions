import { useSyncExternalStore } from 'react';
import { call, onEvent } from './rpc';

/** email → URL, or null when the author has no image (show initials). */
const cache = new Map<string, string | null>();
const queue = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;
let scheduled = false;

const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

function flush() {
  scheduled = false;
  const emails = [...queue];
  queue.clear();
  if (!emails.length) return;
  call('getAvatars', { emails })
    .then((map) => {
      for (const e of emails) cache.set(e, map[e] ?? null);
      notify();
    })
    .catch(() => emails.forEach((e) => cache.set(e, null)));
}

function request(email: string) {
  if (cache.has(email) || queue.has(email)) return;
  queue.add(email);
  if (!scheduled) {
    scheduled = true;
    setTimeout(flush, 30);
  }
}

/** Marks an image URL as broken (e.g. Gravatar 404) so initials show. */
export function markBroken(email: string) {
  if (cache.get(email) === null) return;
  cache.set(email, null);
  notify();
}

onEvent((e) => {
  if (e.name !== 'avatarsChanged') return;
  if (e.email) cache.delete(e.email);
  else cache.clear();
  notify();
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAvatarUrl(email?: string): string | null {
  useSyncExternalStore(subscribe, () => version);
  if (!email) return null;
  if (!cache.has(email)) {
    request(email);
    return null;
  }
  return cache.get(email) ?? null;
}
