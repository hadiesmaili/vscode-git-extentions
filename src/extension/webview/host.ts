import * as vscode from 'vscode';
import { isRequest, type HostEvent, type Method, type ResponseMessage } from '../../shared/protocol';
import type { Controller } from '../controller';

export function getHtml(webview: vscode.Webview, extUri: vscode.Uri, entry: 'graph' | 'sidebar', theme: string): string {
  const nonce = Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('');
  const uri = (...p: string[]) => webview.asWebviewUri(vscode.Uri.joinPath(extUri, 'dist', ...p));
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    `img-src ${webview.cspSource} data: https://www.gravatar.com`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${uri('media', 'codicon.css')}">
<link rel="stylesheet" href="${uri('webview', `${entry}.css`)}">
<title>Git Workspace</title>
</head>
<body data-theme="${theme}" data-view="${entry}">
<div id="root"></div>
<script nonce="${nonce}" src="${uri('webview', `${entry}.js`)}"></script>
</body>
</html>`;
}

/** Every HostApi method; the compiler checks the list is complete and exact. */
const METHODS: { [K in Method]: true } = {
  getGraph: true, getCommit: true, getStatus: true,
  openCommitFile: true, openChange: true, openFile: true,
  stage: true, unstage: true, discard: true, commit: true, lastCommitMessage: true,
  checkout: true, createBranch: true, deleteBranch: true, renameBranch: true, merge: true, rebase: true,
  cherryPick: true, revert: true, reset: true, createTag: true, deleteTag: true, pushRef: true,
  fetch: true, pull: true, push: true, sync: true, stash: true, stashPop: true, initRepo: true,
  abortOperation: true, continueOperation: true,
  pickBranch: true, selectRepository: true, openGraph: true, copy: true, getSettings: true, setDensity: true, setCalendar: true,
  getConfig: true, updateSetting: true, openSettings: true,
  getAvatars: true, getAuthor: true, setAvatar: true, removeAvatar: true,
};
const ALLOWED = new Set<string>(Object.keys(METHODS));

/** Routes RPC requests from a webview to the controller and pushes events back. */
export function bindWebview(webview: vscode.Webview, controller: Controller): vscode.Disposable & { post(e: HostEvent): void } {
  const sub = webview.onDidReceiveMessage(async (m: unknown) => {
    if (!isRequest(m)) return;
    const fn = ALLOWED.has(m.method) ? (controller as unknown as Record<string, unknown>)[m.method] : undefined;
    let res: ResponseMessage;
    if (typeof fn !== 'function') {
      res = { kind: 'response', id: m.id, ok: false, error: `Unknown method ${m.method}` };
    } else {
      try {
        const result = await (fn as (p: unknown) => unknown).call(controller, m.params ?? {});
        res = { kind: 'response', id: m.id, ok: true, result };
      } catch (e) {
        res = { kind: 'response', id: m.id, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
    void webview.postMessage(res);
  });
  const busy = controller.onBusy((b, label) => void webview.postMessage({ kind: 'event', name: 'busy', busy: b, label } satisfies HostEvent));
  return {
    post: (e: HostEvent) => void webview.postMessage(e),
    dispose: () => {
      sub.dispose();
      busy.dispose();
    },
  };
}
