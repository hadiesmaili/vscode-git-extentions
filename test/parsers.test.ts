import { describe, expect, it } from 'vitest';
import { parseBlame, parseLog, parseNameStatus, parseNumstat, parseRefs, parseStatus } from '../src/extension/git/parsers';

describe('parsers', () => {
  it('parseLog', () => {
    const out = 'aaaaaaaa\x00bbbbbbbb cccccccc\x00Jane Doe\x00j@x.io\x001700000000\x00Merge branch x\x1e\nbbbbbbbb\x00\x00Jo\x00\x001\x00init\x1e\n';
    const commits = parseLog(out);
    expect(commits).toHaveLength(2);
    expect(commits[0].parents).toEqual(['bbbbbbbb', 'cccccccc']);
    expect(commits[1].parents).toEqual([]);
    expect(commits[0].subject).toBe('Merge branch x');
  });

  it('parseRefs', () => {
    const out = [
      'refs/heads/main\x00aaa\x00\x00*',
      'refs/remotes/origin/HEAD\x00aaa\x00\x00 ',
      'refs/remotes/origin/main\x00aaa\x00\x00 ',
      'refs/tags/v1\x00tagobj\x00ccc\x00 ',
    ].join('\n');
    const refs = parseRefs(out);
    expect(refs.map((r) => r.short)).toEqual(['main', 'origin/main', 'v1']);
    expect(refs[0].current).toBe(true);
    expect(refs[2].hash).toBe('ccc');
  });

  it('parseStatus with spaces, renames, untracked, conflicts', () => {
    const out = [
      '# branch.oid 1234567890',
      '# branch.head feature/x',
      '# branch.upstream origin/feature/x',
      '# branch.ab +2 -1',
      '1 .M N... 100644 100644 100644 aaa aaa src/my file.ts',
      '1 A. N... 000000 100644 100644 000 bbb new.ts',
      '2 R. N... 100644 100644 100644 aaa aaa R100 renamed.ts',
      'old.ts',
      'u UU N... 100644 100644 100644 100644 a b c conflict.ts',
      '? untracked dir/file.txt',
      '',
    ].join('\x00');
    const s = parseStatus(out);
    expect(s.branch).toBe('feature/x');
    expect(s.ahead).toBe(2);
    expect(s.behind).toBe(1);
    expect(s.unstaged).toEqual([
      { path: 'src/my file.ts', status: 'M' },
      { path: 'untracked dir/file.txt', status: '?' },
    ]);
    expect(s.staged).toEqual([
      { path: 'new.ts', status: 'A', oldPath: undefined },
      { path: 'renamed.ts', status: 'R', oldPath: 'old.ts' },
    ]);
    expect(s.conflicts).toEqual([{ path: 'conflict.ts', status: 'U' }]);
  });

  it('parseNameStatus and parseNumstat', () => {
    expect(parseNameStatus('M\x00a.ts\x00R090\x00old.ts\x00new.ts\x00A\x00b.png\x00')).toEqual([
      { status: 'M', path: 'a.ts' },
      { status: 'R', oldPath: 'old.ts', path: 'new.ts' },
      { status: 'A', path: 'b.png' },
    ]);
    const ns = parseNumstat('3\t1\ta.ts\x002\t0\t\x00old.ts\x00new.ts\x00-\t-\tb.png\x00');
    expect(ns.get('a.ts')).toEqual({ add: 3, del: 1, binary: false });
    expect(ns.get('new.ts')).toEqual({ add: 2, del: 0, binary: false });
    expect(ns.get('b.png')?.binary).toBe(true);
  });

  it('parseBlame', () => {
    const h = 'a'.repeat(40);
    const out = [`${h} 1 1 2`, 'author Jane', 'author-time 1700000000', 'summary fix it', 'filename x', '\tline1', `${h} 2 2`, '\tline2', ''].join('\n');
    const b = parseBlame(out);
    expect(b).toHaveLength(2);
    expect(b[1]).toEqual({ hash: h, author: 'Jane', authorTime: 1700000000, summary: 'fix it' });
  });
});
