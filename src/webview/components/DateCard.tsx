import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CALENDARS, clockTime, isoLocal, longDate, timeZoneName, useCalendar, utcOffset } from '../lib/dates';
import { closeOnOutside, createHover, placeCard } from '../lib/hover';
import { act } from '../lib/rpc';
import { cx, timeAgo } from '../lib/util';
import { Icon } from './ui';

export const dateHover = createHover<{ unix: number; label?: string }>(350);

/** Props to spread on any element that should open the date card. */
export function dateHoverProps(unix: number, label?: string) {
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => dateHover.enter(e.currentTarget, { unix, label }, true),
    onMouseLeave: () => dateHover.leave(),
  };
}

export function DateCardHost() {
  const t = dateHover.useTarget();
  if (!t) return null;
  return <DateCard key={`${t.unix}-${t.rect.top}`} unix={t.unix} label={t.label} rect={t.rect} />;
}

function DateCard({ unix, label, rect }: { unix: number; label?: string; rect: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null);
  const cal = useCalendar();
  const [pos, setPos] = useState({ left: -9999, top: -9999 });

  useLayoutEffect(() => {
    if (ref.current) setPos(placeCard(rect, ref.current.getBoundingClientRect()));
  }, [rect, cal]);
  useEffect(() => closeOnOutside(dateHover.close), []);

  const iso = isoLocal(unix);
  const active = CALENDARS.find((c) => c.id === cal)!;

  return (
    <div
      ref={ref}
      className="date-card"
      style={pos}
      role="dialog"
      aria-label="Date details"
      onMouseEnter={dateHover.keep}
      onMouseLeave={dateHover.leave}
    >
      <div className="dc-head">
        <span className="dc-icon">
          <Icon name="calendar" />
        </span>
        <div className="dc-rel">
          <span className="dc-ago">{timeAgo(unix, false)}</span>
          <span className="dc-label">{label ?? 'Authored'}</span>
        </div>
        <div className="segmented dc-seg" role="tablist" aria-label="Calendar">
          {CALENDARS.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={c.id === cal}
              className={cx(c.id === cal && 'on')}
              title={`${c.label} (${c.native})`}
              onClick={() => act('setCalendar', { calendar: c.id })}
            >
              {c.native}
            </button>
          ))}
        </div>
      </div>

      <div className="dc-main" dir={active.locale.startsWith('fa') ? 'rtl' : 'ltr'}>
        <div className="dc-date">{longDate(unix, cal)}</div>
      </div>
      <div className="dc-time">
        <span className="mono">{clockTime(unix)}</span>
        <span className="dc-tz">
          {utcOffset(unix)}
          {timeZoneName() && ` · ${timeZoneName()}`}
        </span>
      </div>

      <ul className="dc-list">
        {CALENDARS.filter((c) => c.id !== cal).map((c) => (
          <li key={c.id}>
            <button title={`Use ${c.label}`} onClick={() => act('setCalendar', { calendar: c.id })}>
              <span className="dc-cal">
                {c.label} <span className="dc-native">{c.native}</span>
              </span>
              <span className="dc-val" dir={c.locale.startsWith('fa') ? 'rtl' : 'ltr'}>
                {longDate(unix, c.id)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="dc-foot">
        <button className="chip mono ghost" title="Copy ISO 8601" onClick={() => act('copy', { text: iso, label: 'ISO date' })}>
          {iso}
          <Icon name="copy" />
        </button>
        <button className="chip mono ghost" title="Copy Unix timestamp" onClick={() => act('copy', { text: String(unix), label: 'timestamp' })}>
          {unix}
          <Icon name="copy" />
        </button>
      </div>
    </div>
  );
}
