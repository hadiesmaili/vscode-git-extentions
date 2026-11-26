import { useSyncExternalStore } from 'react';

/**
 * Delayed hover controller for one floating card per view.
 * enter() shows after a delay, leave() hides after a grace period,
 * keep() is called when the pointer moves onto the card itself.
 */
export function createHover<T extends object>(showDelay = 380, hideDelay = 200) {
  let target: (T & { rect: DOMRect }) | null = null;
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((l) => l());
  const subscribe = (l: () => void) => {
    subs.add(l);
    return () => subs.delete(l);
  };

  const api = {
    enter(el: HTMLElement, data: T, same = false) {
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      showTimer = setTimeout(
        () => {
          target = { ...data, rect: el.getBoundingClientRect() };
          emit();
        },
        same && target ? 0 : showDelay,
      );
    },
    leave() {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        target = null;
        emit();
      }, hideDelay);
    },
    keep() {
      clearTimeout(hideTimer);
    },
    close() {
      clearTimeout(showTimer);
      target = null;
      emit();
    },
    current: () => target,
    useTarget: () => useSyncExternalStore(subscribe, () => target),
  };
  return api;
}

/** Places a card of size `card` next to `anchor`, flipping above when needed. */
export function placeCard(anchor: DOMRect, card: DOMRect, gap = 8): { left: number; top: number } {
  let left = anchor.right - card.width;
  if (left < 8) left = Math.min(anchor.left, window.innerWidth - card.width - 8);
  let top = anchor.bottom + gap;
  if (top + card.height > window.innerHeight - 8) top = anchor.top - card.height - gap;
  return { left: Math.max(8, left), top: Math.max(8, top) };
}

/** Closes the card on scroll, blur and Escape. */
export function closeOnOutside(close: () => void): () => void {
  const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
  window.addEventListener('scroll', close, true);
  window.addEventListener('keydown', key);
  window.addEventListener('blur', close);
  return () => {
    window.removeEventListener('scroll', close, true);
    window.removeEventListener('keydown', key);
    window.removeEventListener('blur', close);
  };
}
