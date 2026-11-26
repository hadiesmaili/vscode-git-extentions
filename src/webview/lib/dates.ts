import { useSyncExternalStore } from 'react';
import type { Calendar } from '../../shared/protocol';

export const CALENDARS: { id: Calendar; label: string; native: string; locale: string }[] = [
  { id: 'gregory', label: 'Gregorian', native: 'میلادی', locale: 'en-US' },
  { id: 'persian', label: 'Solar Hijri', native: 'شمسی', locale: 'fa-IR' },
  { id: 'islamic-umalqura', label: 'Lunar Hijri', native: 'قمری', locale: 'fa-IR' },
];

let current: Calendar = 'gregory';
const subs = new Set<() => void>();

export function setCalendar(c: Calendar) {
  if (c === current) return;
  current = c;
  subs.forEach((l) => l());
}

export function useCalendar(): Calendar {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => current,
  );
}

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(cal: Calendar, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = cal + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    const locale = CALENDARS.find((c) => c.id === cal)?.locale ?? 'en-US';
    f = new Intl.DateTimeFormat(`${locale}-u-ca-${cal}`, opts);
    cache.set(key, f);
  }
  return f;
}

/** "Thursday, 26 November 2026" in the given calendar. */
export function longDate(unix: number, cal: Calendar = current): string {
  return fmt(cal, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(unix * 1000);
}

export function shortDate(unix: number, cal: Calendar = current): string {
  return fmt(cal, { year: 'numeric', month: 'short', day: 'numeric' }).format(unix * 1000);
}

export function dateTime(unix: number, cal: Calendar = current): string {
  return fmt(cal, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(unix * 1000);
}

export function clockTime(unix: number): string {
  return fmt('gregory', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(unix * 1000);
}

export function utcOffset(unix: number): string {
  const m = -new Date(unix * 1000).getTimezoneOffset();
  const sign = m >= 0 ? '+' : '−';
  const a = Math.abs(m);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

export function timeZoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return '';
  }
}

/** ISO 8601 in local time with offset, e.g. 2026-11-26T11:13:10+03:30. */
export function isoLocal(unix: number): string {
  const d = new Date(unix * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const s = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(Math.floor(a / 60))}:${p(a % 60)}`;
}
