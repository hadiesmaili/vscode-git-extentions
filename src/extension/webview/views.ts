import * as vscode from 'vscode';
import type { HostEvent } from '../../shared/protocol';
import type { Controller } from '../controller';
import { bindWebview, getHtml } from './host';

type Binding = ReturnType<typeof bindWebview>;

function theme(): string {
  return vscode.workspace.getConfiguration('gitWorkspace').get<string>('theme', 'brand');
}

/** Full-size Git Graph editor panel (singleton). */
export class GraphPanel {
  private panel?: vscode.WebviewPanel;
  private binding?: Binding;

  constructor(
    private readonly extUri: vscode.Uri,
    private readonly controller: Controller,
  ) {}

  show(hash?: string): void {
    if (this.panel) {
      this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.One);
      if (hash) this.post({ kind: 'event', name: 'selectCommit', hash });
      return;
    }
    const panel = vscode.window.createWebviewPanel('gitWorkspace.graph', 'Git Graph', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extUri, 'dist')],
    });
    panel.iconPath = {
      light: vscode.Uri.joinPath(this.extUri, 'media', 'graph-light.svg'),
      dark: vscode.Uri.joinPath(this.extUri, 'media', 'graph-dark.svg'),
    };
    panel.webview.html = getHtml(panel.webview, this.extUri, 'graph', theme());
    this.binding = bindWebview(panel.webview, this.controller);
    panel.onDidDispose(() => {
      this.binding?.dispose();
      this.binding = undefined;
      this.panel = undefined;
    });
    this.panel = panel;
    if (hash) setTimeout(() => this.post({ kind: 'event', name: 'selectCommit', hash }), 600);
  }

  post(e: HostEvent): void {
    this.binding?.post(e);
  }
}

/** Sidebar webview in the activity bar. */
export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private binding?: Binding;

  constructor(
    private readonly extUri: vscode.Uri,
    private readonly controller: Controller,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extUri, 'dist')] };
    view.webview.html = getHtml(view.webview, this.extUri, 'sidebar', theme());
    this.binding = bindWebview(view.webview, this.controller);
    view.onDidChangeVisibility(() => {
      if (view.visible) this.post({ kind: 'event', name: 'repoChanged' });
    });
    view.onDidDispose(() => {
      this.binding?.dispose();
      this.binding = undefined;
      this.view = undefined;
    });
    void this.updateBadge();
  }

  post(e: HostEvent): void {
    this.binding?.post(e);
  }

  async updateBadge(): Promise<void> {
    if (!this.view) return;
    try {
      const st = await this.controller.getStatus();
      const n = st ? st.staged.length + st.unstaged.length + st.conflicts.length : 0;
      this.view.badge = n ? { value: n, tooltip: `${n} changes` } : undefined;
      this.view.description = st ? (st.branch ?? st.headHash?.slice(0, 7)) : undefined;
    } catch {
      /* repo busy */
    }
  }

  reloadHtml(): void {
    if (this.view) this.view.webview.html = getHtml(this.view.webview, this.extUri, 'sidebar', theme());
  }
}
