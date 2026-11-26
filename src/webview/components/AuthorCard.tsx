import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { AuthorInfo } from '../../shared/protocol';
import { act, call } from '../lib/rpc';
import { fullDate, timeAgo } from '../lib/util';
import { Avatar, Icon } from './ui';

// ---------- hover controller (one card for the whole view) ----------

interface Target {
  name: string;
  email: string;
  rect: DOMRect;
}

let target: Target | null = null;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
const subs = new Set<() => void>();
const emit = () => subs.forEach((l) => l());

export const authorHover = {
  enter(el: HTMLElement, name: string, email: string) {
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    const same = target && target.email === email && target.name === name;
    showTimer = setTimeout(
      () => {
        target = { name, email, rect: el.getBoundingClientRect() };
        emit();
      },
      same ? 0 : 380,
    );
  },
  leave() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      target = null;
      emit();
    }, 200);
  },
  keep() {
    clearTimeout(hideTimer);
  },
  close() {
    clearTimeout(showTimer);
    target = null;
    emit();
  },
};

const subscribe = (l: () => void) => {
  subs.add(l);
  return () => subs.delete(l);
};

// ---------- card ----------

/** Render once per view. `onShowCommits` filters the list by author (graph only). */
export function AuthorCardHost({ onShowCommits }: { onShowCommits?: (a: { name: string; email: string }) => void }) {
  const t = useSyncExternalStore(subscribe, () => target);
  if (!t) return null;
  return <AuthorCard key={`${t.name}<${t.email}>`} t={t} onShowCommits={onShowCommits} />;
}

function AuthorCard({ t, onShowCommits }: { t: Target; onShowCommits?: (a: { name: string; email: string }) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<AuthorInfo | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 });

  useEffect(() => {
    let live = true;
    call('getAuthor', { name: t.name, email: t.email })
      .then((i) => live && setInfo(i))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [t.name, t.email]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    let left = t.rect.right - r.width;
    if (left < 8) left = Math.min(t.rect.left, window.innerWidth - r.width - 8);
    let top = t.rect.bottom + gap;
    if (top + r.height > window.innerHeight - 8) top = t.rect.top - r.height - gap;
    setPos({ left: Math.max(8, left), top: Math.max(8, top) });
  }, [t, info]);

  useEffect(() => {
    const close = () => authorHover.close();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', close);
    };
  }, []);

  const run = (fn: () => void) => () => {
    authorHover.close();
    fn();
  };

  return (
    <div
      ref={ref}
      className="author-card"
      style={pos}
      role="dialog"
      aria-label={`Author ${t.name}`}
      onMouseEnter={authorHover.keep}
      onMouseLeave={authorHover.leave}
    >
      <div className="ac-head">
        <div className="ac-avatar">
          <Avatar name={t.name} email={t.email} size={56} card={false} />
          <button className="ac-edit" title="Change avatar…" onClick={run(() => act('setAvatar', { name: t.name, email: t.email }))}>
            <Icon name="device-camera" />
          </button>
        </div>
        <div className="ac-id">
          <div className="ac-name">
            <span title={t.name}>{t.name}</span>
            {info?.isYou && <span className="ac-you">You</span>}
          </div>
          {t.email && (
            <button className="ac-email mono" title="Copy email" onClick={run(() => act('copy', { text: t.email, label: t.email }))}>
              {t.email}
              <Icon name="copy" />
            </button>
          )}
          {info && info.aliases.length > 0 && <div className="ac-alias">also as {info.aliases.join(', ')}</div>}
        </div>
      </div>

      <div className="ac-stats">
        <div className="ac-stat">
          <span className="ac-num mono">{info ? info.commits.toLocaleString() : '…'}</span>
          <span className="ac-label">commits</span>
        </div>
        <div className="ac-stat" title={info?.last ? fullDate(info.last) : undefined}>
          <span className="ac-num">{info?.last ? timeAgo(info.last) : '—'}</span>
          <span className="ac-label">last commit</span>
        </div>
        <div className="ac-stat" title={info?.first ? fullDate(info.first) : undefined}>
          <span className="ac-num">{info?.first ? new Date(info.first * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : '—'}</span>
          <span className="ac-label">first commit</span>
        </div>
      </div>

      <div className="ac-actions">
        {onShowCommits && (
          <button className="btn btn-ghost" onClick={run(() => onShowCommits({ name: t.name, email: t.email }))}>
            <Icon name="filter" /> Show commits
          </button>
        )}
        <button className="btn btn-ghost" onClick={run(() => act('setAvatar', { name: t.name, email: t.email }))}>
          <Icon name="device-camera" /> {info?.customAvatar ? 'Change avatar' : 'Set avatar'}
        </button>
        {info?.customAvatar && (
          <button className="icon-btn" title="Remove custom avatar" onClick={run(() => act('removeAvatar', { email: t.email }))}>
            <Icon name="trash" />
          </button>
        )}
      </div>
    </div>
  );
}
