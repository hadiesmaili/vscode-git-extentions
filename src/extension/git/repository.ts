import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  CommitDetail,
  FileChange,
  GraphData,
  GraphQuery,
  GraphRow,
  Ref,
  ResetMode,
  StatusInfo,
} from '../../shared/protocol';
import { computeLayout } from '../graph/layout';
import { GitClient } from './gitClient';
import { LOG_FORMAT, REF_FORMAT, parseLog, parseNameStatus, parseNumstat, parseRefs, parseStatus } from './parsers';

export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
export const UNCOMMITTED = '*';

/** All git reads and writes for one repository, via the CLI. */
export class Repository {
  readonly git: GitClient;
  readonly name: string;

  constructor(
    readonly root: string,
    gitPath: string,
  ) {
    this.git = new GitClient(root, gitPath);
    this.name = path.basename(root);
  }

  get gitDir(): string {
    const p = path.join(this.root, '.git');
    try {
      if (fs.statSync(p).isFile()) {
        const m = /gitdir: (.*)/.exec(fs.readFileSync(p, 'utf8'));
        if (m) return path.resolve(this.root, m[1].trim());
      }
    } catch {
      /* ignore */
    }
    return p;
  }

  // ---------- reads ----------

  async refs(): Promise<Ref[]> {
    const out = await this.git.run(['for-each-ref', `--format=${REF_FORMAT}`]);
    return parseRefs(out);
  }

  async headHash(): Promise<string | undefined> {
    try {
      return (await this.git.run(['rev-parse', 'HEAD'])).trim();
    } catch {
      return undefined;
    }
  }

  async graph(q: GraphQuery, withUncommitted: boolean): Promise<GraphData> {
    const refs = await this.refs();
    const head = await this.headHash();
    if (!head && refs.length === 0) {
      return { rows: [], refs, lanes: 1, hasMore: false, repoName: this.name };
    }

    const args = ['log', '--date-order', `--format=${LOG_FORMAT}`, `--max-count=${q.maxCount + 1}`];
    if (q.branch) args.push(q.branch);
    else if (q.scope === 'all') args.push('--branches', '--remotes', '--tags', 'HEAD');
    else if (q.scope === 'local') args.push('--branches', 'HEAD');
    else args.push('--remotes');
    args.push('--');

    let commits = parseLog(await this.git.run(args));
    const hasMore = commits.length > q.maxCount;
    if (hasMore) commits = commits.slice(0, q.maxCount);

    let uncommitted = false;
    if (withUncommitted && head && commits.some((c) => c.hash === head)) {
      const st = await this.git.run(['status', '--porcelain', '--untracked-files=all']);
      if (st.trim()) {
        uncommitted = true;
        commits = [
          {
            hash: UNCOMMITTED,
            parents: [head],
            author: '',
            email: '',
            date: Math.floor(Date.now() / 1000),
            subject: 'Uncommitted changes',
          },
          ...commits,
        ];
      }
    }

    const layout = computeLayout(commits);
    const byHash = new Map<string, Ref[]>();
    for (const r of refs) {
      if (r.type === 'stash') continue;
      const list = byHash.get(r.hash) ?? [];
      list.push(r);
      byHash.set(r.hash, list);
    }
    const order: Record<string, number> = { head: 0, remote: 1, tag: 2, stash: 3 };
    for (const list of byHash.values()) {
      list.sort((a, b) => Number(b.current) - Number(a.current) || order[a.type] - order[b.type]);
    }

    const rows: GraphRow[] = commits.map((c, i) => ({
      commit: c,
      lane: layout.rows[i].lane,
      color: layout.rows[i].color,
      edges: layout.rows[i].edges,
      refs: byHash.get(c.hash) ?? [],
      isHead: c.hash === head,
      isMerge: c.parents.length > 1,
      uncommitted: uncommitted && i === 0 ? true : undefined,
    }));

    return { rows, refs, lanes: layout.lanes, hasMore, head, repoName: this.name };
  }

  async commitDetail(hash: string): Promise<CommitDetail> {
    const fmt = '%H%x00%P%x00%an%x00%ae%x00%at%x00%cn%x00%ct%x00%s%x00%b';
    const out = await this.git.run(['show', '-s', `--format=${fmt}`, hash]);
    const [h, parents, author, email, at, cn, ct, subject, body] = out.split('\x00');
    const parentList = parents ? parents.split(' ').filter(Boolean) : [];
    const base = parentList[0] ?? EMPTY_TREE;
    const [ns, num] = await Promise.all([
      this.git.run(['diff', '--name-status', '-z', '-M', base, h]),
      this.git.run(['diff', '--numstat', '-z', '-M', base, h]),
    ]);
    const files = parseNameStatus(ns);
    const stats = parseNumstat(num);
    let additions = 0;
    let deletions = 0;
    for (const f of files) {
      const s = stats.get(f.path);
      if (s) {
        f.additions = s.add;
        f.deletions = s.del;
        f.binary = s.binary;
        additions += s.add;
        deletions += s.del;
      }
    }
    const refs = (await this.refs()).filter((r) => r.hash === h && r.type !== 'stash');
    return {
      hash: h,
      parents: parentList,
      author,
      email,
      date: Number(at),
      committer: cn,
      committerDate: Number(ct),
      subject,
      body: (body ?? '').trim(),
      files,
      additions,
      deletions,
      refs,
    };
  }

  async uncommittedDetail(): Promise<CommitDetail> {
    const st = await this.status();
    const head = st.headHash ?? EMPTY_TREE;
    const map = new Map<string, FileChange>();
    for (const f of [...st.conflicts, ...st.staged, ...st.unstaged]) {
      if (!map.has(f.path)) map.set(f.path, { ...f, status: f.status === '?' ? 'A' : f.status });
    }
    let additions = 0;
    let deletions = 0;
    try {
      const stats = parseNumstat(await this.git.run(['diff', '--numstat', '-z', '-M', head]));
      for (const [p, s] of stats) {
        const f = map.get(p);
        if (f) {
          f.additions = s.add;
          f.deletions = s.del;
          f.binary = s.binary;
        }
        additions += s.add;
        deletions += s.del;
      }
    } catch {
      /* initial commit */
    }
    return {
      hash: UNCOMMITTED,
      parents: st.headHash ? [st.headHash] : [],
      author: '',
      email: '',
      date: Math.floor(Date.now() / 1000),
      committer: '',
      committerDate: 0,
      subject: 'Uncommitted changes',
      body: '',
      files: [...map.values()],
      additions,
      deletions,
      refs: [],
    };
  }

  async status(): Promise<StatusInfo> {
    const out = await this.git.run(['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'], { timeout: 30_000 });
    const s = parseStatus(out);
    return { ...s, repoName: this.name, repoRoot: this.root, operation: this.operation() };
  }

  operation(): StatusInfo['operation'] {
    const d = this.gitDir;
    const has = (f: string) => fs.existsSync(path.join(d, f));
    if (has('rebase-merge') || has('rebase-apply')) return 'rebase';
    if (has('MERGE_HEAD')) return 'merge';
    if (has('CHERRY_PICK_HEAD')) return 'cherry-pick';
    if (has('REVERT_HEAD')) return 'revert';
    return undefined;
  }

  async lastCommitMessage(): Promise<string> {
    try {
      return (await this.git.run(['log', '-1', '--format=%B'])).trim();
    } catch {
      return '';
    }
  }

  // ---------- writes ----------

  stage(paths: string[]) {
    return this.git.run(['add', '-A', '--', ...paths]);
  }

  unstage(paths: string[], hasHead: boolean) {
    if (!hasHead) return this.git.run(['rm', '--cached', '-r', '-q', '--', ...paths]);
    return this.git.run(['reset', '-q', 'HEAD', '--', ...paths]);
  }

  async discard(files: FileChange[]) {
    const untracked = files.filter((f) => f.status === '?' || f.status === 'A').map((f) => f.path);
    const tracked = files.filter((f) => f.status !== '?' && f.status !== 'A').map((f) => f.path);
    if (tracked.length) await this.git.run(['checkout', '--', ...tracked]);
    if (untracked.length) await this.git.run(['clean', '-f', '-q', '--', ...untracked]);
  }

  commit(message: string, amend: boolean, all: boolean) {
    const args = ['commit', '--cleanup=strip', '-F', '-'];
    if (amend) args.push('--amend');
    if (all) args.push('--all');
    return this.git.run(args, { stdin: message });
  }

  checkout(ref: string) {
    return this.git.run(['checkout', ref]);
  }

  checkoutRemote(remoteRef: string) {
    const local = remoteRef.replace(/^[^/]+\//, '');
    return this.git.run(['checkout', '-b', local, '--track', remoteRef]);
  }

  createBranch(name: string, from?: string, checkout = true) {
    if (checkout) return this.git.run(['checkout', '-b', name, ...(from ? [from] : [])]);
    return this.git.run(['branch', name, ...(from ? [from] : [])]);
  }

  deleteBranch(name: string, force: boolean) {
    return this.git.run(['branch', force ? '-D' : '-d', name]);
  }

  deleteRemoteBranch(remoteRef: string) {
    const [remote, ...rest] = remoteRef.split('/');
    return this.git.run(['push', remote, '--delete', rest.join('/')]);
  }

  renameBranch(oldName: string, newName: string) {
    return this.git.run(['branch', '-m', oldName, newName]);
  }

  merge(ref: string) {
    return this.git.run(['merge', '--no-edit', ref]);
  }

  rebase(ref: string) {
    return this.git.run(['rebase', ref]);
  }

  /** Files that differ between a commit and the working tree. */
  async diffWithWorkingTree(hash: string): Promise<FileChange[]> {
    return parseNameStatus(await this.git.run(['diff', '--name-status', '-z', '-M', hash]));
  }

  cherryPick(hash: string) {
    return this.git.run(['cherry-pick', hash]);
  }

  revert(hash: string, isMerge: boolean) {
    return this.git.run(['revert', '--no-edit', ...(isMerge ? ['-m', '1'] : []), hash]);
  }

  reset(hash: string, mode: ResetMode) {
    return this.git.run(['reset', `--${mode}`, hash]);
  }

  tag(name: string, hash: string, message?: string) {
    if (message) return this.git.run(['tag', '-a', name, '-m', message, hash]);
    return this.git.run(['tag', name, hash]);
  }

  deleteTag(name: string) {
    return this.git.run(['tag', '-d', name]);
  }

  stash() {
    return this.git.run(['stash', 'push', '--include-untracked']);
  }

  stashPop() {
    return this.git.run(['stash', 'pop']);
  }

  abort(op: NonNullable<StatusInfo['operation']>) {
    return this.git.run([op, '--abort']);
  }

  continueOp(op: NonNullable<StatusInfo['operation']>) {
    return this.git.run(['-c', 'core.editor=true', op, '--continue']);
  }

  fetch() {
    return this.git.run(['fetch', '--all', '--prune']);
  }

  pull() {
    return this.git.run(['pull', '--ff-only']);
  }

  push(setUpstream?: { remote: string; branch: string }) {
    if (setUpstream) return this.git.run(['push', '-u', setUpstream.remote, setUpstream.branch]);
    return this.git.run(['push']);
  }

  pushRef(remote: string, name: string, isTag: boolean) {
    return this.git.run(['push', remote, isTag ? `refs/tags/${name}` : name]);
  }

  async remotes(): Promise<string[]> {
    return (await this.git.run(['remote'])).split('\n').filter(Boolean);
  }
}
