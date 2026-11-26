import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

const KEY = 'gitWorkspace.avatars';
const MAX_BYTES = 1024 * 1024;
const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/** Custom avatars (stored per email in global state) plus optional Gravatar. */
export class AvatarStore {
  private readonly _onDidChange = new vscode.EventEmitter<string | undefined>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly state: vscode.Memento) {}

  private get custom(): Record<string, string> {
    return this.state.get<Record<string, string>>(KEY, {});
  }

  list(): string[] {
    return Object.keys(this.custom).sort();
  }

  has(email: string): boolean {
    return !!this.custom[norm(email)];
  }

  resolve(emails: string[], gravatar: boolean): Record<string, string> {
    const custom = this.custom;
    const out: Record<string, string> = {};
    for (const e of emails) {
      const k = norm(e);
      if (!k) continue;
      if (custom[k]) out[e] = custom[k];
      else if (gravatar) out[e] = `https://www.gravatar.com/avatar/${createHash('md5').update(k).digest('hex')}?s=128&d=404`;
    }
    return out;
  }

  async pick(name: string, email: string): Promise<void> {
    const files = await vscode.window.showOpenDialog({
      title: `Avatar for ${name} <${email}>`,
      canSelectMany: false,
      openLabel: 'Use as Avatar',
      filters: { Images: Object.keys(MIME).map((e) => e.slice(1)) },
    });
    const file = files?.[0];
    if (!file) return;
    const mime = MIME[path.extname(file.fsPath).toLowerCase()];
    if (!mime) return void vscode.window.showErrorMessage('Use a PNG, JPEG, GIF or WebP image.');
    if ((await stat(file.fsPath)).size > MAX_BYTES) return void vscode.window.showErrorMessage('Image is larger than 1 MB.');
    const data = `data:${mime};base64,${(await readFile(file.fsPath)).toString('base64')}`;
    await this.state.update(KEY, { ...this.custom, [norm(email)]: data });
    this._onDidChange.fire(email);
  }

  async remove(email: string): Promise<void> {
    const next = { ...this.custom };
    delete next[norm(email)];
    await this.state.update(KEY, next);
    this._onDidChange.fire(email);
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}

function norm(email: string): string {
  return email.trim().toLowerCase();
}
