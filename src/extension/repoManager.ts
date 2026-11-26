import * as vscode from 'vscode';
import { GitClient } from './git/gitClient';
import { Repository } from './git/repository';

/** Discovers repositories, tracks the active one and emits change events. */
export class RepoManager implements vscode.Disposable {
  private repos: Repository[] = [];
  private current?: Repository;
  private watchers: vscode.Disposable[] = [];
  private disposables: vscode.Disposable[] = [];
  private timer?: NodeJS.Timeout;

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  /** Fires (debounced) when the repository state may have changed. */
  readonly onDidChange = this._onDidChange.event;
  private readonly _onDidChangeRepo = new vscode.EventEmitter<void>();
  /** Fires when the active repository changes. */
  readonly onDidChangeRepo = this._onDidChangeRepo.event;

  constructor(private readonly state: vscode.Memento) {
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.discover()),
      vscode.workspace.onDidSaveTextDocument(() => this.changed()),
    );
  }

  get gitPath(): string {
    const p = vscode.workspace.getConfiguration('git').get<string | string[] | null>('path');
    if (typeof p === 'string' && p) return p;
    if (Array.isArray(p) && p.length) return p[0];
    return 'git';
  }

  get repository(): Repository | undefined {
    return this.current;
  }

  get all(): readonly Repository[] {
    return this.repos;
  }

  async discover(): Promise<void> {
    const found = new Map<string, Repository>();
    for (const f of vscode.workspace.workspaceFolders ?? []) {
      if (f.uri.scheme !== 'file') continue;
      try {
        const top = (await new GitClient(f.uri.fsPath, this.gitPath).run(['rev-parse', '--show-toplevel'])).trim();
        if (top && !found.has(top)) found.set(top, new Repository(top, this.gitPath));
      } catch {
        /* not a repo */
      }
    }
    this.repos = [...found.values()];
    const saved = this.state.get<string>('gitWorkspace.repo');
    const next = this.repos.find((r) => r.root === this.current?.root) ?? this.repos.find((r) => r.root === saved) ?? this.repos[0];
    this.setCurrent(next);
  }

  setCurrent(repo: Repository | undefined): void {
    const changed = repo?.root !== this.current?.root;
    this.current = repo;
    if (repo) void this.state.update('gitWorkspace.repo', repo.root);
    this.watch();
    if (changed) this._onDidChangeRepo.fire();
    this.changed();
  }

  async pick(): Promise<void> {
    if (this.repos.length <= 1) {
      void vscode.window.showInformationMessage(
        this.repos.length ? `Only one repository: ${this.repos[0].name}` : 'No Git repository in this workspace.',
      );
      return;
    }
    const pick = await vscode.window.showQuickPick(
      this.repos.map((r) => ({ label: r.name, description: r.root, repo: r, picked: r === this.current })),
      { placeHolder: 'Select repository' },
    );
    if (pick) this.setCurrent(pick.repo);
  }

  private watch(): void {
    this.watchers.forEach((d) => d.dispose());
    this.watchers = [];
    const repo = this.current;
    if (!repo) return;
    const gitDir = vscode.Uri.file(repo.gitDir);
    const meta = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitDir, '{HEAD,index,ORIG_HEAD,FETCH_HEAD,MERGE_HEAD,packed-refs,refs/**,rebase-merge/**}'),
    );
    const work = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(repo.root, '**/*'));
    const on = (u: vscode.Uri) => {
      if (u.fsPath.includes('/.git/objects') || u.fsPath.endsWith('.lock')) return;
      this.changed();
    };
    for (const w of [meta, work]) {
      w.onDidChange(on);
      w.onDidCreate(on);
      w.onDidDelete(on);
    }
    this.watchers.push(meta, work);
  }

  /** Debounced change notification. */
  changed(delay = 250): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this._onDidChange.fire(), delay);
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.watchers.forEach((d) => d.dispose());
    this.disposables.forEach((d) => d.dispose());
    this._onDidChange.dispose();
    this._onDidChangeRepo.dispose();
  }
}
