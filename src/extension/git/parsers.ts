// Pure parsers for git CLI output. No VS Code dependency: unit-testable.
import type { Commit, FileChange, FileStatus, Ref, RefType, StatusInfo } from '../../shared/protocol';

export const LOG_FORMAT = '%H%x00%P%x00%an%x00%ae%x00%at%x00%s%x1e';

export function parseLog(out: string): Commit[] {
  const commits: Commit[] = [];
  for (const rec of out.split('\x1e')) {
    const r = rec.replace(/^\n/, '');
    if (!r) continue;
    const [hash, parents, author, email, date, subject] = r.split('\x00');
    if (!hash || hash.length < 7) continue;
    commits.push({
      hash,
      parents: parents ? parents.split(' ').filter(Boolean) : [],
      author: author ?? '',
      email: email ?? '',
      date: Number(date) || 0,
      subject: subject ?? '',
    });
  }
  return commits;
}

export const REF_FORMAT = '%(refname)%00%(objectname)%00%(*objectname)%00%(HEAD)';

export function parseRefs(out: string): Ref[] {
  const refs: Ref[] = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    const [name, obj, peeled, head] = line.split('\x00');
    let type: RefType;
    let short: string;
    if (name.startsWith('refs/heads/')) {
      type = 'head';
      short = name.slice(11);
    } else if (name.startsWith('refs/remotes/')) {
      type = 'remote';
      short = name.slice(13);
      if (short.endsWith('/HEAD')) continue;
    } else if (name.startsWith('refs/tags/')) {
      type = 'tag';
      short = name.slice(10);
    } else if (name === 'refs/stash') {
      type = 'stash';
      short = 'stash';
    } else continue;
    refs.push({ name, short, type, hash: peeled || obj, current: head === '*' });
  }
  return refs;
}

function toStatus(c: string): FileStatus {
  switch (c) {
    case 'A':
    case 'M':
    case 'D':
    case 'R':
    case 'C':
    case 'T':
    case 'U':
      return c;
    default:
      return 'M';
  }
}

/** Parses `git status --porcelain=v2 --branch -z --untracked-files=all`. */
export function parseStatus(out: string): Omit<StatusInfo, 'repoName' | 'repoRoot' | 'operation'> {
  const s: Omit<StatusInfo, 'repoName' | 'repoRoot' | 'operation'> = {
    detached: false,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    conflicts: [],
  };
  const parts = out.split('\x00');
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (!e) continue;
    if (e.startsWith('# ')) {
      const [, key, ...rest] = e.split(' ');
      const val = rest.join(' ');
      if (key === 'branch.oid') s.headHash = val === '(initial)' ? undefined : val;
      else if (key === 'branch.head') {
        if (val === '(detached)') s.detached = true;
        else s.branch = val;
      } else if (key === 'branch.upstream') s.upstream = val;
      else if (key === 'branch.ab') {
        const m = /\+(\d+) -(\d+)/.exec(val);
        if (m) {
          s.ahead = Number(m[1]);
          s.behind = Number(m[2]);
        }
      }
      continue;
    }
    const type = e[0];
    if (type === '1' || type === '2') {
      const nFields = type === '1' ? 8 : 9;
      const f = splitN(e, nFields);
      const xy = f[1];
      const path = f[nFields];
      let oldPath: string | undefined;
      if (type === '2') oldPath = parts[++i];
      const x = xy[0];
      const y = xy[1];
      if (x !== '.') s.staged.push({ path, oldPath: x === 'R' || x === 'C' ? oldPath : undefined, status: toStatus(x) });
      if (y !== '.') s.unstaged.push({ path, status: toStatus(y) });
    } else if (type === 'u') {
      const f = splitN(e, 10);
      s.conflicts.push({ path: f[10], status: 'U' });
    } else if (type === '?') {
      s.unstaged.push({ path: e.slice(2), status: '?' });
    }
  }
  return s;
}

/** Splits on the first n spaces; element n holds the rest (paths may contain spaces). */
function splitN(s: string, n: number): string[] {
  const out: string[] = [];
  let start = 0;
  for (let k = 0; k < n; k++) {
    const idx = s.indexOf(' ', start);
    if (idx < 0) break;
    out.push(s.slice(start, idx));
    start = idx + 1;
  }
  out.push(s.slice(start));
  return out;
}

/** Parses `git diff --name-status -z -M`. */
export function parseNameStatus(out: string): FileChange[] {
  const parts = out.split('\x00');
  const files: FileChange[] = [];
  for (let i = 0; i < parts.length; i++) {
    const code = parts[i];
    if (!code) continue;
    const c = code[0];
    if (c === 'R' || c === 'C') {
      files.push({ status: c, oldPath: parts[i + 1], path: parts[i + 2] });
      i += 2;
    } else {
      files.push({ status: toStatus(c), path: parts[i + 1] });
      i += 1;
    }
  }
  return files;
}

/** Parses `git diff --numstat -z -M` into a map keyed by new path. */
export function parseNumstat(out: string): Map<string, { add: number; del: number; binary: boolean }> {
  const map = new Map<string, { add: number; del: number; binary: boolean }>();
  const parts = out.split('\x00');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    const m = /^(-|\d+)\t(-|\d+)\t(.*)$/s.exec(p);
    if (!m) continue;
    let path = m[3];
    if (path === '') {
      // rename: next two entries are old and new path
      path = parts[i + 2];
      i += 2;
    }
    const binary = m[1] === '-';
    map.set(path, { add: binary ? 0 : Number(m[1]), del: binary ? 0 : Number(m[2]), binary });
  }
  return map;
}

export interface BlameLine {
  hash: string;
  author: string;
  authorTime: number;
  summary: string;
}

/** Parses `git blame --porcelain`. Returns entry per final line (1-based index → array index-1). */
export function parseBlame(out: string): BlameLine[] {
  const lines = out.split('\n');
  const info = new Map<string, { author: string; authorTime: number; summary: string }>();
  const result: BlameLine[] = [];
  let cur: string | undefined;
  let curLine = 0;
  for (const l of lines) {
    if (l.startsWith('\t')) {
      if (cur) {
        const i = info.get(cur)!;
        result[curLine - 1] = { hash: cur, ...i };
      }
      continue;
    }
    const h = /^([0-9a-f]{40}) \d+ (\d+)/.exec(l);
    if (h) {
      cur = h[1];
      curLine = Number(h[2]);
      if (!info.has(cur)) info.set(cur, { author: '', authorTime: 0, summary: '' });
      continue;
    }
    if (!cur) continue;
    const i = info.get(cur)!;
    if (l.startsWith('author ')) i.author = l.slice(7);
    else if (l.startsWith('author-time ')) i.authorTime = Number(l.slice(12));
    else if (l.startsWith('summary ')) i.summary = l.slice(8);
  }
  return result;
}
