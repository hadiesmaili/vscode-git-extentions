import * as path from 'node:path';
import * as vscode from 'vscode';
import type { AuthorInfo, Calendar, CommitDetail, Config, DateFormat, Palette, SettingKey, Theme, Density, FileChange, GraphData, GraphQuery, HostImpl, Ref, ResetMode, Settings, StatusInfo } from '../shared/protocol';
import type { AvatarStore } from './avatars';
import { GitError } from './git/gitClient';
import { EMPTY_TREE, Repository, UNCOMMITTED } from './git/repository';
import { gitUri } from './providers/contentProvider';
import type { RepoManager } from './repoManager';

type Busy = (busy: boolean, label?: string) => void;

/** Implements every RPC method the webviews can call. */
export class Controller implements HostImpl {
  private busyListeners = new Set<Busy>();

  constructor(
    private readonly repos: RepoManager,
    private readonly openGraphPanel: (hash?: string) => void,
    private readonly avatars: AvatarStore,
    private readonly version: string,
  ) {}

  onBusy(l: Busy): vscode.Disposable {
    this.busyListeners.add(l);
    return new vscode.Disposable(() => this.busyListeners.delete(l));
  }

  private get repo(): Repository {
    const r = this.repos.repository;
    if (!r) throw new Error('No Git repository is open.');
    return r;
  }

  /** Runs a write operation with progress, error reporting and refresh. */
  private async op<T>(label: string, fn: () => Promise<T>, opts: { notify?: boolean } = {}): Promise<T | undefined> {
    this.busyListeners.forEach((l) => l(true, label));
    try {
      const run = () => fn();
      if (opts.notify) {
        return await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: label, cancellable: false },
          run,
        );
      }
      return await vscode.window.withProgress({ location: { viewId: 'gitWorkspace.sidebar' } }, run);
    } catch (e) {
      const msg = e instanceof GitError || e instanceof Error ? e.message : String(e);
      if (/conflict/i.test(msg)) {
        void vscode.window
          .showWarningMessage(`${label}: conflicts detected. Resolve them, then continue.`, 'Show Changes')
          .then((a) => a && vscode.commands.executeCommand('gitWorkspace.sidebar.focus'));
      } else {
        void vscode.window.showErrorMessage(`${label} failed: ${msg}`);
      }
      return undefined;
    } finally {
      this.busyListeners.forEach((l) => l(false));
      this.repos.changed(50);
    }
  }

  private async confirm(message: string, detail: string, action: string): Promise<boolean> {
    const r = await vscode.window.showWarningMessage(message, { modal: true, detail }, action);
    return r === action;
  }

  // ---------- reads ----------

  getGraph(q: GraphQuery): Promise<GraphData> {
    const repo = this.repos.repository;
    if (!repo) return Promise.resolve({ rows: [], refs: [], lanes: 1, hasMore: false, repoName: '' });
    return repo.graph(q, !q.branch && q.scope !== 'remote');
  }

  getCommit(p: { hash: string }): Promise<CommitDetail> {
    return p.hash === UNCOMMITTED ? this.repo.uncommittedDetail() : this.repo.commitDetail(p.hash);
  }

  async getStatus(): Promise<StatusInfo | null> {
    const repo = this.repos.repository;
    if (!repo) return null;
    return repo.status();
  }

  getSettings(): Settings {
    const c = vscode.workspace.getConfiguration('gitWorkspace');
    return {
      theme: c.get<Theme>('theme', 'brand'),
      density: c.get<Density>('graph.density', 'comfortable'),
      pageSize: c.get<number>('graph.pageSize', 500),
      gravatar: c.get<boolean>('avatars.gravatar', false),
      calendar: c.get<Calendar>('calendar', 'gregory'),
      palette: c.get<Palette>('graph.palette', 'vivid'),
      dateFormat: c.get<DateFormat>('dateFormat', 'relative'),
    };
  }

  async setDensity(p: { density: Density }): Promise<void> {
    await vscode.workspace.getConfiguration('gitWorkspace').update('graph.density', p.density, vscode.ConfigurationTarget.Global);
  }

  async setCalendar(p: { calendar: Calendar }): Promise<void> {
    await vscode.workspace.getConfiguration('gitWorkspace').update('calendar', p.calendar, vscode.ConfigurationTarget.Global);
  }

  getConfig(): Config {
    const c = vscode.workspace.getConfiguration('gitWorkspace');
    return {
      ...this.getSettings(),
      blameEnabled: c.get<boolean>('inlineBlame.enabled', true),
      blameFormat: c.get<string>('inlineBlame.format', '${author}, ${timeAgo} • ${summary}'),
      blameDelay: c.get<number>('inlineBlame.delay', 150),
      customAvatars: this.avatars.list(),
      version: this.version,
      vscodeVersion: vscode.version,
      repoName: this.repos.repository?.name,
    };
  }

  async updateSetting(p: { key: SettingKey; value: unknown }): Promise<void> {
    const check = SETTING_RULES[p.key];
    if (!check || !check(p.value)) throw new Error(`Invalid value for ${p.key}`);
    await vscode.workspace.getConfiguration('gitWorkspace').update(p.key, p.value, vscode.ConfigurationTarget.Global);
  }

  async openSettings(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:HadiEsmaeili.git-workspace-graph');
  }

  lastCommitMessage(): Promise<string> {
    return this.repo.lastCommitMessage();
  }

  // ---------- open / diff ----------

  async openCommitFile(p: { hash: string; parent?: string; file: FileChange }): Promise<void> {
    const repo = this.repo;
    const f = p.file;
    const name = path.basename(f.path);
    if (p.hash === UNCOMMITTED) {
      const left = gitUri(repo.root, f.status === 'A' ? '' : 'HEAD', f.oldPath ?? f.path);
      const right = vscode.Uri.file(path.join(repo.root, f.path));
      if (f.status === 'D') {
        await vscode.commands.executeCommand('vscode.diff', left, gitUri(repo.root, '', f.path), `${name} (Deleted)`, preview(true));
      } else {
        await vscode.commands.executeCommand('vscode.diff', left, right, `${name} (Working Tree)`, preview(true));
      }
      return;
    }
    const parent = p.parent ?? EMPTY_TREE;
    const short = p.hash.slice(0, 7);
    const left = f.status === 'A' || parent === EMPTY_TREE ? gitUri(repo.root, '', f.path) : gitUri(repo.root, parent, f.oldPath ?? f.path);
    const right = f.status === 'D' ? gitUri(repo.root, '', f.path) : gitUri(repo.root, p.hash, f.path);
    await vscode.commands.executeCommand('vscode.diff', left, right, `${name} (${short})`, preview(true));
  }

  async compareWithWorkingTree(p: { hash: string }): Promise<void> {
    const repo = this.repo;
    const short = p.hash.slice(0, 7);
    const files = await repo.diffWithWorkingTree(p.hash);
    if (!files.length) return void vscode.window.showInformationMessage(`Working tree matches ${short}.`);
    const empty = (f: string) => gitUri(repo.root, '', f);
    const resources = files.map((f) => {
      const work = vscode.Uri.file(path.join(repo.root, f.path));
      const left = f.status === 'A' ? empty(f.path) : gitUri(repo.root, p.hash, f.oldPath ?? f.path);
      const right = f.status === 'D' ? empty(f.path) : work;
      return [work, left, right];
    });
    await vscode.commands.executeCommand('vscode.changes', `${short} ↔ Working Tree`, resources);
  }

  async openChange(p: { file: FileChange; staged: boolean }): Promise<void> {
    const repo = this.repo;
    const f = p.file;
    const name = path.basename(f.path);
    const fileUri = vscode.Uri.file(path.join(repo.root, f.path));
    if (f.status === '?' || (f.status === 'A' && !p.staged)) {
      await vscode.commands.executeCommand('vscode.open', fileUri, preview());
      return;
    }
    if (f.status === 'U') {
      await vscode.commands.executeCommand('vscode.open', fileUri, preview());
      return;
    }
    if (p.staged) {
      const left = f.status === 'A' ? gitUri(repo.root, '', f.path) : gitUri(repo.root, 'HEAD', f.oldPath ?? f.path);
      const right = f.status === 'D' ? gitUri(repo.root, '', f.path) : gitUri(repo.root, 'INDEX', f.path);
      await vscode.commands.executeCommand('vscode.diff', left, right, `${name} (Index)`, preview());
    } else {
      const left = gitUri(repo.root, 'INDEX', f.path);
      const right = f.status === 'D' ? gitUri(repo.root, '', f.path) : fileUri;
      await vscode.commands.executeCommand('vscode.diff', left, right, `${name} (Working Tree)`, preview());
    }
  }

  async openFile(p: { path: string }): Promise<void> {
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path.join(this.repo.root, p.path)));
  }

  // ---------- working tree ----------

  async stage(p: { paths: string[] }): Promise<void> {
    await this.op('Stage', () => this.repo.stage(p.paths));
  }

  async unstage(p: { paths: string[] }): Promise<void> {
    const hasHead = !!(await this.repo.headHash());
    await this.op('Unstage', () => this.repo.unstage(p.paths, hasHead));
  }

  async discard(p: { files: FileChange[] }): Promise<void> {
    const n = p.files.length;
    const what = n === 1 ? `'${path.basename(p.files[0].path)}'` : `${n} files`;
    const untracked = p.files.some((f) => f.status === '?');
    const ok = await this.confirm(
      `Discard changes in ${what}?`,
      untracked ? 'Untracked files will be DELETED. This cannot be undone.' : 'Your changes will be lost. This cannot be undone.',
      untracked ? 'Delete' : 'Discard',
    );
    if (ok) await this.op('Discard', () => this.repo.discard(p.files));
  }

  async commit(p: { message: string; amend?: boolean; push?: boolean; stageAll?: boolean }): Promise<boolean> {
    const message = p.message.trim();
    if (!message) {
      void vscode.window.showWarningMessage('Write a commit message first.');
      return false;
    }
    const ok = await this.op(p.amend ? 'Amend commit' : 'Commit', async () => {
      await this.repo.commit(message, !!p.amend, !!p.stageAll);
      return true;
    });
    if (ok && p.push) await this.push();
    return !!ok;
  }

  // ---------- branches & history ----------

  async checkout(p: { ref: string; remote?: boolean }): Promise<void> {
    if (p.remote) {
      const local = p.ref.replace(/^[^/]+\//, '');
      const exists = (await this.repo.refs()).some((r) => r.type === 'head' && r.short === local);
      await this.op(`Checkout ${local}`, () => (exists ? this.repo.checkout(local) : this.repo.checkoutRemote(p.ref)));
      return;
    }
    await this.op(`Checkout ${shortRef(p.ref)}`, () => this.repo.checkout(p.ref));
  }

  async createBranch(p: { from?: string }): Promise<void> {
    const name = await vscode.window.showInputBox({
      title: p.from ? `New branch from ${shortRef(p.from)}` : 'New branch',
      placeHolder: 'feature/my-branch',
      validateInput: validRefName,
    });
    if (!name) return;
    await this.op(`Create branch ${name}`, () => this.repo.createBranch(name.trim(), p.from));
  }

  async deleteBranch(p: { ref: Ref }): Promise<void> {
    const r = p.ref;
    if (r.type === 'remote') {
      if (!(await this.confirm(`Delete remote branch '${r.short}'?`, 'The branch will be removed from the remote for everyone.', 'Delete')))
        return;
      await this.op(`Delete ${r.short}`, () => this.repo.deleteRemoteBranch(r.short), { notify: true });
      return;
    }
    if (!(await this.confirm(`Delete branch '${r.short}'?`, 'The local branch will be deleted.', 'Delete'))) return;
    try {
      await this.repo.deleteBranch(r.short, false);
      this.repos.changed(50);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/not fully merged/.test(msg)) {
        const force = await this.confirm(`'${r.short}' is not fully merged.`, 'Its unmerged commits may be lost. Force delete?', 'Force Delete');
        if (force) await this.op(`Delete ${r.short}`, () => this.repo.deleteBranch(r.short, true));
      } else void vscode.window.showErrorMessage(`Delete branch failed: ${msg}`);
    }
  }

  async renameBranch(p: { ref: Ref }): Promise<void> {
    const name = await vscode.window.showInputBox({ title: `Rename ${p.ref.short}`, value: p.ref.short, validateInput: validRefName });
    if (!name || name === p.ref.short) return;
    await this.op('Rename branch', () => this.repo.renameBranch(p.ref.short, name.trim()));
  }

  async merge(p: { ref: string }): Promise<void> {
    const st = await this.repo.status();
    if (!(await this.confirm(`Merge '${shortRef(p.ref)}' into '${st.branch ?? 'HEAD'}'?`, 'A merge commit is created if needed.', 'Merge')))
      return;
    await this.op(`Merge ${shortRef(p.ref)}`, () => this.repo.merge(p.ref));
  }

  async rebase(p: { ref: string }): Promise<void> {
    const st = await this.repo.status();
    if (
      !(await this.confirm(
        `Rebase '${st.branch ?? 'HEAD'}' onto '${shortRef(p.ref)}'?`,
        'Commits of the current branch are rewritten. Do not rebase commits that others already pulled.',
        'Rebase',
      ))
    )
      return;
    await this.op(`Rebase onto ${shortRef(p.ref)}`, () => this.repo.rebase(p.ref));
  }

  async cherryPick(p: { hash: string }): Promise<void> {
    await this.op(`Cherry-pick ${p.hash.slice(0, 7)}`, () => this.repo.cherryPick(p.hash));
  }

  async revert(p: { hash: string }): Promise<void> {
    const d = await this.repo.commitDetail(p.hash);
    if (!(await this.confirm(`Revert ${p.hash.slice(0, 7)}?`, `A new commit will undo:\n${d.subject}`, 'Revert'))) return;
    await this.op(`Revert ${p.hash.slice(0, 7)}`, () => this.repo.revert(p.hash, d.parents.length > 1));
  }

  async reset(p: { hash: string; mode: ResetMode }): Promise<void> {
    const short = p.hash.slice(0, 7);
    const detail: Record<ResetMode, string> = {
      soft: 'Keep all changes staged.',
      mixed: 'Keep changes in the working tree, unstaged.',
      hard: 'ALL uncommitted changes and later commits on this branch will be LOST.',
    };
    if (!(await this.confirm(`Reset current branch to ${short} (${p.mode})?`, detail[p.mode], p.mode === 'hard' ? 'Reset Hard' : 'Reset')))
      return;
    await this.op(`Reset ${p.mode}`, () => this.repo.reset(p.hash, p.mode));
  }

  async createTag(p: { hash: string }): Promise<void> {
    const name = await vscode.window.showInputBox({ title: `Tag ${p.hash.slice(0, 7)}`, placeHolder: 'v1.0.0', validateInput: validRefName });
    if (!name) return;
    const message = await vscode.window.showInputBox({ title: 'Tag message (optional: empty = lightweight tag)' });
    if (message === undefined) return;
    await this.op(`Tag ${name}`, () => this.repo.tag(name.trim(), p.hash, message || undefined));
  }

  async deleteTag(p: { ref: Ref }): Promise<void> {
    if (!(await this.confirm(`Delete tag '${p.ref.short}'?`, 'Only the local tag is deleted.', 'Delete'))) return;
    await this.op('Delete tag', () => this.repo.deleteTag(p.ref.short));
  }

  async pushRef(p: { ref: Ref }): Promise<void> {
    const remotes = await this.repo.remotes();
    if (!remotes.length) return void vscode.window.showWarningMessage('No remote configured.');
    const remote = remotes.length === 1 ? remotes[0] : await vscode.window.showQuickPick(remotes, { placeHolder: 'Push to remote' });
    if (!remote) return;
    await this.op(`Push ${p.ref.short}`, () => this.repo.pushRef(remote, p.ref.short, p.ref.type === 'tag'), { notify: true });
  }

  // ---------- sync ----------

  /** Built-in Git extension repository, used for network ops because it handles authentication. */
  private async builtin(): Promise<any | undefined> {
    try {
      const ext = vscode.extensions.getExtension('vscode.git');
      if (!ext) return undefined;
      const exp = ext.isActive ? ext.exports : await ext.activate();
      const api = exp.getAPI(1);
      return api.getRepository(vscode.Uri.file(this.repo.root)) ?? undefined;
    } catch {
      return undefined;
    }
  }

  async fetch(): Promise<void> {
    await this.op(
      'Fetch',
      async () => {
        const b = await this.builtin();
        return b ? b.fetch({ all: true, prune: true }) : this.repo.fetch();
      },
      { notify: true },
    );
  }

  async pull(): Promise<void> {
    await this.op(
      'Pull',
      async () => {
        const b = await this.builtin();
        return b ? b.pull() : this.repo.pull();
      },
      { notify: true },
    );
  }

  async push(): Promise<void> {
    const st = await this.repo.status();
    if (!st.branch) return void vscode.window.showWarningMessage('Cannot push a detached HEAD.');
    let setUpstream: { remote: string; branch: string } | undefined;
    if (!st.upstream) {
      const remotes = await this.repo.remotes();
      if (!remotes.length) return void vscode.window.showWarningMessage('No remote configured.');
      const remote =
        remotes.length === 1
          ? remotes[0]
          : await vscode.window.showQuickPick(remotes, { placeHolder: `Publish '${st.branch}' to remote` });
      if (!remote) return;
      setUpstream = { remote, branch: st.branch };
    }
    await this.op(
      setUpstream ? `Publish ${st.branch}` : 'Push',
      async () => {
        const b = await this.builtin();
        if (b) return setUpstream ? b.push(setUpstream.remote, setUpstream.branch, true) : b.push();
        return this.repo.push(setUpstream);
      },
      { notify: true },
    );
  }

  async sync(): Promise<void> {
    const st = await this.repo.status();
    if (st.behind > 0) await this.pull();
    if (st.ahead > 0 || !st.upstream) await this.push();
    if (st.behind === 0 && st.ahead === 0 && st.upstream) await this.fetch();
  }

  async stash(): Promise<void> {
    await this.op('Stash', () => this.repo.stash());
  }

  async stashPop(): Promise<void> {
    await this.op('Stash pop', () => this.repo.stashPop());
  }

  async initRepo(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return void vscode.window.showWarningMessage('Open a folder first.');
    const { GitClient } = await import('./git/gitClient');
    await this.op('Initialize repository', () => new GitClient(folder.uri.fsPath, this.repos.gitPath).run(['init']));
    await this.repos.discover();
  }

  async abortOperation(): Promise<void> {
    const op = this.repo.operation();
    if (!op) return;
    if (!(await this.confirm(`Abort ${op}?`, 'The repository returns to its state before the operation.', 'Abort'))) return;
    await this.op(`Abort ${op}`, () => this.repo.abort(op));
  }

  async continueOperation(): Promise<void> {
    const op = this.repo.operation();
    if (!op) return;
    await this.op(`Continue ${op}`, () => this.repo.continueOp(op));
  }

  // ---------- ui helpers ----------

  async pickBranch(): Promise<void> {
    const refs = await this.repo.refs();
    type Item = vscode.QuickPickItem & { ref?: Ref; action?: 'new' | 'newFrom' };
    const items: Item[] = [
      { label: '$(plus) Create new branch…', action: 'new', alwaysShow: true },
      { label: '$(git-branch) Create new branch from…', action: 'newFrom', alwaysShow: true },
      { label: 'Branches', kind: vscode.QuickPickItemKind.Separator },
      ...refs
        .filter((r) => r.type === 'head')
        .map((r) => ({ label: `${r.current ? '$(check)' : '$(git-branch)'} ${r.short}`, description: r.hash.slice(0, 7), ref: r })),
      { label: 'Remote branches', kind: vscode.QuickPickItemKind.Separator },
      ...refs.filter((r) => r.type === 'remote').map((r) => ({ label: `$(cloud) ${r.short}`, description: r.hash.slice(0, 7), ref: r })),
      { label: 'Tags', kind: vscode.QuickPickItemKind.Separator },
      ...refs.filter((r) => r.type === 'tag').map((r) => ({ label: `$(tag) ${r.short}`, description: r.hash.slice(0, 7), ref: r })),
    ];
    const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Select a branch or tag to checkout', matchOnDescription: true });
    if (!pick) return;
    if (pick.action === 'new') return this.createBranch({});
    if (pick.action === 'newFrom') {
      const from = await vscode.window.showQuickPick(
        refs.filter((r) => r.type !== 'stash').map((r) => ({ label: r.short, description: r.type, ref: r })),
        { placeHolder: 'Create branch from' },
      );
      if (from) return this.createBranch({ from: from.ref.short });
      return;
    }
    if (pick.ref && !pick.ref.current) await this.checkout({ ref: pick.ref.short, remote: pick.ref.type === 'remote' });
  }

  selectRepository(): Promise<void> {
    return this.repos.pick();
  }

  openGraph(p: { hash?: string }): void {
    this.openGraphPanel(p?.hash);
  }

  async copy(p: { text: string; label?: string }): Promise<void> {
    await vscode.env.clipboard.writeText(p.text);
    vscode.window.setStatusBarMessage(`$(check) Copied ${p.label ?? p.text}`, 2000);
  }

  // ---------- authors & avatars ----------

  getAvatars(p: { emails: string[] }): Record<string, string> {
    return this.avatars.resolve(p.emails.slice(0, 2000), this.getSettings().gravatar);
  }

  async getAuthor(p: { name: string; email: string }): Promise<AuthorInfo> {
    const info: AuthorInfo = { name: p.name, email: p.email, commits: 0, aliases: [], customAvatar: this.avatars.has(p.email), isYou: false };
    const repo = this.repos.repository;
    if (!repo || !p.email) return info;
    // Exact email match: --author takes a regex.
    const pattern = `<${p.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>`;
    const [log, me] = await Promise.all([
      repo.git.run(['log', '--all', `--author=${pattern}`, '--format=%at%x00%an']).catch(() => ''),
      repo.git.run(['config', 'user.email']).catch(() => ''),
    ]);
    const names = new Set<string>();
    for (const line of log.split('\n')) {
      if (!line) continue;
      const [t, n] = line.split('\x00');
      const at = Number(t);
      info.commits++;
      if (!info.last || at > info.last) info.last = at;
      if (!info.first || at < info.first) info.first = at;
      if (n && n !== p.name) names.add(n);
    }
    info.aliases = [...names].slice(0, 5);
    info.isYou = me.trim().toLowerCase() === p.email.toLowerCase();
    return info;
  }

  setAvatar(p: { name: string; email: string }): Promise<void> {
    return this.avatars.pick(p.name, p.email);
  }

  async removeAvatar(p: { email: string }): Promise<void> {
    const ok = await this.confirm(`Remove custom avatar for ${p.email}?`, 'Initials (or Gravatar, if enabled) are shown again.', 'Remove');
    if (ok) await this.avatars.remove(p.email);
  }
}

const oneOf = (...v: unknown[]) => (x: unknown) => v.includes(x);
const intIn = (min: number, max: number) => (x: unknown) => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;

/** Validation for every setting the webview may write. */
const SETTING_RULES: Record<SettingKey, (v: unknown) => boolean> = {
  theme: oneOf('brand', 'light', 'auto'),
  'graph.density': oneOf('compact', 'comfortable', 'spacious'),
  'graph.pageSize': intIn(50, 5000),
  'graph.palette': oneOf('vivid', 'pastel', 'neon', 'ocean', 'sunset', 'graphite'),
  calendar: oneOf('gregory', 'persian', 'islamic-umalqura'),
  dateFormat: oneOf('relative', 'absolute'),
  'avatars.gravatar': (v) => typeof v === 'boolean',
  'inlineBlame.enabled': (v) => typeof v === 'boolean',
  'inlineBlame.format': (v) => typeof v === 'string' && v.length <= 200,
  'inlineBlame.delay': intIn(0, 2000),
};

/** Diffs opened from the graph go beside it so the graph stays visible. */
function preview(beside = false) {
  return { preview: true, viewColumn: beside ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active };
}

function shortRef(r: string): string {
  return /^[0-9a-f]{40}$/.test(r) ? r.slice(0, 7) : r;
}

function validRefName(v: string): string | undefined {
  const s = v.trim();
  if (!s) return 'Name is required.';
  if (/[\s~^:?*[\\]|\.\.|@\{|^[-/.]|[/.]$|\.lock$|\/\//.test(s)) return 'Not a valid Git ref name.';
  return undefined;
}
