import * as path from 'node:path';
import * as vscode from 'vscode';
import { parseBlame, type BlameLine } from './git/parsers';
import type { RepoManager } from './repoManager';

const ZERO = '0000000000000000000000000000000000000000';
const MAX_SIZE = 1_000_000;

/** Faint "author, time • summary" after the current line. */
export class InlineBlame implements vscode.Disposable {
  private readonly deco = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      fontStyle: 'italic',
      margin: '0 0 0 3em',
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
  });
  private cache = new Map<string, { version: number; lines: BlameLine[] }>();
  private timer?: NodeJS.Timeout;
  private disposables: vscode.Disposable[] = [];
  private current?: { uri: string; line: number; blame: BlameLine };

  constructor(private readonly repos: RepoManager) {
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((e) => this.schedule(e.textEditor)),
      vscode.window.onDidChangeActiveTextEditor((e) => (e ? this.schedule(e) : undefined)),
      vscode.workspace.onDidChangeTextDocument((e) => {
        this.cache.delete(e.document.uri.toString());
        const ed = vscode.window.activeTextEditor;
        if (ed?.document === e.document) ed.setDecorations(this.deco, []);
      }),
      vscode.workspace.onDidCloseTextDocument((d) => this.cache.delete(d.uri.toString())),
      repos.onDidChange(() => this.cache.clear()),
      vscode.languages.registerHoverProvider({ scheme: 'file' }, { provideHover: (d, p) => this.hover(d, p) }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('gitWorkspace.inlineBlame')) this.refresh();
      }),
    );
  }

  private get enabled(): boolean {
    return vscode.workspace.getConfiguration('gitWorkspace.inlineBlame').get('enabled', true);
  }

  private refresh(): void {
    const ed = vscode.window.activeTextEditor;
    if (!ed) return;
    if (!this.enabled) ed.setDecorations(this.deco, []);
    else this.schedule(ed);
  }

  private schedule(editor: vscode.TextEditor): void {
    clearTimeout(this.timer);
    if (!this.enabled || editor.document.uri.scheme !== 'file') {
      editor.setDecorations(this.deco, []);
      return;
    }
    const delay = vscode.workspace.getConfiguration('gitWorkspace.inlineBlame').get('delay', 150);
    this.timer = setTimeout(() => void this.update(editor), delay);
  }

  private async update(editor: vscode.TextEditor): Promise<void> {
    if (editor.selections.length !== 1) return editor.setDecorations(this.deco, []);
    const line = editor.selection.active.line;
    const blame = await this.blameFor(editor.document);
    if (vscode.window.activeTextEditor !== editor || editor.selection.active.line !== line) return;
    const b = blame?.[line];
    if (!b) {
      this.current = undefined;
      return editor.setDecorations(this.deco, []);
    }
    this.current = { uri: editor.document.uri.toString(), line, blame: b };
    const text = this.format(b);
    const end = editor.document.lineAt(line).range.end;
    editor.setDecorations(this.deco, [{ range: new vscode.Range(end, end), renderOptions: { after: { contentText: text } } }]);
  }

  private format(b: BlameLine): string {
    if (b.hash === ZERO) return 'You • Uncommitted changes';
    const fmt = vscode.workspace
      .getConfiguration('gitWorkspace.inlineBlame')
      .get<string>('format', '${author}, ${timeAgo} • ${summary}');
    const vars: Record<string, string> = {
      author: b.author,
      timeAgo: timeAgo(b.authorTime),
      summary: b.summary.length > 60 ? `${b.summary.slice(0, 59)}…` : b.summary,
      hash: b.hash.slice(0, 7),
      date: new Date(b.authorTime * 1000).toLocaleDateString(),
    };
    return fmt.replace(/\$\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
  }

  private async blameFor(doc: vscode.TextDocument): Promise<BlameLine[] | undefined> {
    const key = doc.uri.toString();
    const hit = this.cache.get(key);
    if (hit && hit.version === doc.version) return hit.lines;
    const repo = this.repos.all.find((r) => doc.uri.fsPath.startsWith(r.root + path.sep));
    if (!repo) return undefined;
    const text = doc.getText();
    if (text.length > MAX_SIZE || text.includes('\u0000')) return undefined;
    const rel = path.relative(repo.root, doc.uri.fsPath);
    try {
      const args = ['blame', '--porcelain'];
      const out = doc.isDirty
        ? await repo.git.run([...args, '--contents', '-', '--', rel], { stdin: text })
        : await repo.git.run([...args, '--', rel]);
      const lines = parseBlame(out);
      this.cache.set(key, { version: doc.version, lines });
      return lines;
    } catch {
      this.cache.set(key, { version: doc.version, lines: [] });
      return undefined;
    }
  }

  private hover(doc: vscode.TextDocument, pos: vscode.Position): vscode.Hover | undefined {
    const c = this.current;
    if (!c || c.uri !== doc.uri.toString() || c.line !== pos.line) return undefined;
    const lineEnd = doc.lineAt(pos.line).range.end.character;
    if (pos.character < lineEnd) return undefined;
    const b = c.blame;
    if (b.hash === ZERO) return undefined;
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = { enabledCommands: ['gitWorkspace.showCommit'] };
    const args = encodeURIComponent(JSON.stringify([b.hash]));
    md.appendMarkdown(`$(git-commit) **${escapeMd(b.author)}** · ${timeAgo(b.authorTime)} (${new Date(b.authorTime * 1000).toLocaleString()})\n\n`);
    md.appendMarkdown(`${escapeMd(b.summary)}\n\n`);
    md.appendMarkdown(`\`${b.hash.slice(0, 8)}\` · [$(git-merge) Open in Git Graph](command:gitWorkspace.showCommit?${args})`);
    return new vscode.Hover(md);
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.deco.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}

function escapeMd(s: string): string {
  return s.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, '\\$&');
}

function timeAgo(unix: number): string {
  const s = Math.max(0, Date.now() / 1000 - unix);
  const units: [number, string][] = [
    [31536000, 'year'],
    [2592000, 'month'],
    [604800, 'week'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ];
  for (const [sec, name] of units) {
    const n = Math.floor(s / sec);
    if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}
