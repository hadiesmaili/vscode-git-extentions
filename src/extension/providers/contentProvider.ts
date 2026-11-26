import * as vscode from 'vscode';
import type { RepoManager } from '../repoManager';

export const SCHEME = 'gitws';

interface Query {
  repo: string;
  /** Git revision; ':' prefix-free. Empty string = empty file. 'INDEX' = staged version. */
  ref: string;
  path: string;
}

/** Builds a URI that resolves to the content of `path` at `ref`. */
export function gitUri(repo: string, ref: string, filePath: string): vscode.Uri {
  const q: Query = { repo, ref, path: filePath };
  const short = ref === 'INDEX' ? 'index' : ref ? ref.slice(0, 7) : 'empty';
  return vscode.Uri.from({
    scheme: SCHEME,
    path: `/${filePath}`,
    query: JSON.stringify(q),
    fragment: short,
  });
}

/** Serves file contents from git objects for the built-in diff editor. */
export class GitContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private readonly repos: RepoManager) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    let q: Query;
    try {
      q = JSON.parse(uri.query) as Query;
    } catch {
      return '';
    }
    if (!q.ref) return '';
    const repo = this.repos.all.find((r) => r.root === q.repo) ?? this.repos.repository;
    if (!repo) return '';
    try {
      const buf = await repo.git.runBuffer(['show', q.ref === 'INDEX' ? `:${q.path}` : `${q.ref}:${q.path}`]);
      return buf.toString('utf8');
    } catch {
      return '';
    }
  }
}
