import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AuthorInfo } from '../../shared/protocol';
import { dateTime, shortDate } from '../lib/dates';
import { closeOnOutside, createHover, placeCard } from '../lib/hover';
import { act, call } from '../lib/rpc';
import { timeAgo } from '../lib/util';
import { Avatar, Icon } from './ui';

interface Target {
  name: string;
  email: string;
  rect: DOMRect;
}

export const authorHover = createHover<{ name: string; email: string }>(380);

// ---------- card ----------

/** Render once per view. `onShowCommits` filters the list by author (graph only). */
export function AuthorCardHost({ onShowCommits }: { onShowCommits?: (a: { name: string; email: string }) => void }) {
  const t = authorHover.useTarget();
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
    if (ref.current) setPos(placeCard(t.rect, ref.current.getBoundingClientRect()));
  }, [t, info]);

  useEffect(() => closeOnOutside(authorHover.close), []);

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
        <div className="ac-stat" title={info?.last ? dateTime(info.last) : undefined}>
          <span className="ac-num">{info?.last ? timeAgo(info.last) : '—'}</span>
          <span className="ac-label">last commit</span>
        </div>
        <div className="ac-stat" title={info?.first ? dateTime(info.first) : undefined}>
          <span className="ac-num">{info?.first ? shortDate(info.first) : '—'}</span>
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
