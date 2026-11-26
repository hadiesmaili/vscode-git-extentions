import * as vscode from 'vscode';
import { AvatarStore } from './avatars';
import { InlineBlame } from './blame';
import { Controller } from './controller';
import { GitContentProvider, SCHEME } from './providers/contentProvider';
import { RepoManager } from './repoManager';
import { GraphPanel, SidebarProvider } from './webview/views';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const repos = new RepoManager(context.workspaceState);
  let graph: GraphPanel | undefined;
  const avatars = new AvatarStore(context.globalState);
  const version = String((context.extension.packageJSON as { version?: string }).version ?? '');
  const controller = new Controller(repos, (hash) => graph?.show(hash), avatars, version);
  graph = new GraphPanel(context.extensionUri, controller);
  const sidebar = new SidebarProvider(context.extensionUri, controller);

  const broadcast = () => {
    graph?.post({ kind: 'event', name: 'repoChanged' });
    sidebar.post({ kind: 'event', name: 'repoChanged' });
    void sidebar.updateBadge();
  };

  context.subscriptions.push(
    repos,
    avatars,
    avatars.onDidChange((email) => {
      graph?.post({ kind: 'event', name: 'avatarsChanged', email });
      sidebar.post({ kind: 'event', name: 'avatarsChanged', email });
    }),
    new InlineBlame(repos),
    repos.onDidChange(broadcast),
    vscode.window.registerWebviewViewProvider('gitWorkspace.sidebar', sidebar, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, new GitContentProvider(repos)),
    vscode.commands.registerCommand('gitWorkspace.openGraph', () => graph?.show()),
    vscode.commands.registerCommand('gitWorkspace.showCommit', (hash?: string) => graph?.show(hash)),
    vscode.commands.registerCommand('gitWorkspace.refresh', async () => {
      // Reload the HTML too: recovers a webview whose app has died.
      sidebar.reloadHtml();
      await repos.discover();
    }),
    vscode.commands.registerCommand('gitWorkspace.fetch', () => controller.fetch()),
    vscode.commands.registerCommand('gitWorkspace.pull', () => controller.pull()),
    vscode.commands.registerCommand('gitWorkspace.push', () => controller.push()),
    vscode.commands.registerCommand('gitWorkspace.selectRepository', () => repos.pick()),
    vscode.commands.registerCommand('gitWorkspace.toggleInlineBlame', async () => {
      const c = vscode.workspace.getConfiguration('gitWorkspace.inlineBlame');
      await c.update('enabled', !c.get('enabled', true), vscode.ConfigurationTarget.Global);
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('gitWorkspace')) return;
      // Webviews apply theme and other settings live, without a reload.
      const settings = controller.getSettings();
      graph?.post({ kind: 'event', name: 'settingsChanged', settings });
      sidebar.post({ kind: 'event', name: 'settingsChanged', settings });
      if (e.affectsConfiguration('gitWorkspace.avatars')) {
        graph?.post({ kind: 'event', name: 'avatarsChanged' });
        sidebar.post({ kind: 'event', name: 'avatarsChanged' });
      }
    }),
  );

  await repos.discover();
}

export function deactivate(): void {}
