export function timeAgo(unix: number, short = true): string {
  const s = Math.max(0, Date.now() / 1000 - unix);
  const units: [number, string, string][] = [
    [31536000, 'y', 'year'],
    [2592000, 'mo', 'month'],
    [604800, 'w', 'week'],
    [86400, 'd', 'day'],
    [3600, 'h', 'hour'],
    [60, 'm', 'minute'],
  ];
  for (const [sec, sh, long] of units) {
    const n = Math.floor(s / sec);
    if (n >= 1) return short ? `${n}${sh} ago` : `${n} ${long}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export function fullDate(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Stable hue from a string, for avatars. */
export function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function splitPath(p: string): { dir: string; name: string } {
  const i = p.lastIndexOf('/');
  return i < 0 ? { dir: '', name: p } : { dir: p.slice(0, i), name: p.slice(i + 1) };
}

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

const ICONS: Record<string, string> = {
  ts: 'symbol-class',
  tsx: 'symbol-class',
  js: 'symbol-method',
  jsx: 'symbol-method',
  json: 'json',
  md: 'markdown',
  css: 'symbol-color',
  scss: 'symbol-color',
  html: 'code',
  svg: 'file-media',
  png: 'file-media',
  jpg: 'file-media',
  gif: 'file-media',
  lock: 'lock',
  yml: 'settings',
  yaml: 'settings',
  toml: 'settings',
  sh: 'terminal',
};

const KIND_COLORS: Record<string, string> = {
  ts: 'blue',
  tsx: 'blue',
  js: 'yellow',
  jsx: 'yellow',
  json: 'orange',
  md: 'sky',
  css: 'pink',
  scss: 'pink',
  html: 'orange',
};

export function fileIcon(p: string): { icon: string; tone: string } {
  const ext = p.slice(p.lastIndexOf('.') + 1).toLowerCase();
  return { icon: ICONS[ext] ?? 'file', tone: KIND_COLORS[ext] ?? 'muted' };
}
