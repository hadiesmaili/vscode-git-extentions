// Types shared between the extension host and the webviews.

export type FileStatus = 'A' | 'M' | 'D' | 'R' | 'C' | 'T' | 'U' | '?';

export interface Commit {
  hash: string;
  parents: string[];
  author: string;
  email: string;
  /** Unix seconds. */
  date: number;
  subject: string;
}

export type RefType = 'head' | 'remote' | 'tag' | 'stash';

export interface Ref {
  /** Full ref name, e.g. refs/heads/main. */
  name: string;
  /** Short name, e.g. main, origin/main, v1.0. */
  short: string;
  type: RefType;
  hash: string;
  current: boolean;
}

export interface Edge {
  from: number;
  to: number;
  color: number;
  /** Parent is not loaded yet: the line runs off the bottom of the list. */
  open?: boolean;
}

export interface GraphRow {
  commit: Commit;
  lane: number;
  color: number;
  /** Connections from this row's center to the next row's center. */
  edges: Edge[];
  refs: Ref[];
  isHead: boolean;
  isMerge: boolean;
  /** Synthetic row for uncommitted working tree changes. */
  uncommitted?: boolean;
}

export type GraphScope = 'all' | 'local' | 'remote';

export interface GraphQuery {
  scope: GraphScope;
  /** Restrict to one branch (short name). */
  branch?: string;
  maxCount: number;
}

export interface GraphData {
  rows: GraphRow[];
  refs: Ref[];
  lanes: number;
  hasMore: boolean;
  head?: string;
  repoName: string;
}

export interface FileChange {
  path: string;
  oldPath?: string;
  status: FileStatus;
  additions?: number;
  deletions?: number;
  binary?: boolean;
}

export interface CommitDetail extends Commit {
  body: string;
  committer: string;
  committerDate: number;
  files: FileChange[];
  additions: number;
  deletions: number;
  refs: Ref[];
}

export interface StatusInfo {
  repoName: string;
  repoRoot: string;
  branch?: string;
  detached: boolean;
  headHash?: string;
  upstream?: string;
  ahead: number;
  behind: number;
  staged: FileChange[];
  unstaged: FileChange[];
  conflicts: FileChange[];
  operation?: 'merge' | 'rebase' | 'cherry-pick' | 'revert';
}

export type ResetMode = 'soft' | 'mixed' | 'hard';

/** RPC methods implemented by the extension host. */
export interface HostApi {
  getGraph(q: GraphQuery): GraphData;
  getCommit(p: { hash: string }): CommitDetail;
  getStatus(): StatusInfo | null;

  openCommitFile(p: { hash: string; parent?: string; file: FileChange }): void;
  openChange(p: { file: FileChange; staged: boolean }): void;
  openFile(p: { path: string }): void;

  stage(p: { paths: string[] }): void;
  unstage(p: { paths: string[] }): void;
  discard(p: { files: FileChange[] }): void;
  commit(p: { message: string; amend?: boolean; push?: boolean; stageAll?: boolean }): boolean;
  lastCommitMessage(): string;

  checkout(p: { ref: string; remote?: boolean }): void;
  createBranch(p: { from?: string }): void;
  deleteBranch(p: { ref: Ref }): void;
  renameBranch(p: { ref: Ref }): void;
  merge(p: { ref: string }): void;
  rebase(p: { ref: string }): void;
  cherryPick(p: { hash: string }): void;
  revert(p: { hash: string }): void;
  reset(p: { hash: string; mode: ResetMode }): void;
  createTag(p: { hash: string }): void;
  deleteTag(p: { ref: Ref }): void;
  pushRef(p: { ref: Ref }): void;

  fetch(): void;
  pull(): void;
  push(): void;
  sync(): void;
  stash(): void;
  stashPop(): void;
  initRepo(): void;
  abortOperation(): void;
  continueOperation(): void;

  pickBranch(): void;
  selectRepository(): void;
  openGraph(p: { hash?: string }): void;
  copy(p: { text: string; label?: string }): void;
  getSettings(): Settings;

  /** Avatar URL (data: or https:) per email; emails without one are omitted. */
  getAvatars(p: { emails: string[] }): Record<string, string>;
  getAuthor(p: { name: string; email: string }): AuthorInfo;
  /** Opens a file picker and stores the image as this author's avatar. */
  setAvatar(p: { name: string; email: string }): void;
  removeAvatar(p: { email: string }): void;
  setDensity(p: { density: Density }): void;
  setCalendar(p: { calendar: Calendar }): void;

  getConfig(): Config;
  updateSetting(p: { key: SettingKey; value: unknown }): void;
  /** Opens the VS Code settings UI filtered to this extension. */
  openSettings(): void;
}

export type Density = 'compact' | 'comfortable' | 'spacious';

export type Theme = 'brand' | 'light' | 'auto';

export interface Settings {
  theme: Theme;
  density: Density;
  pageSize: number;
  gravatar: boolean;
  calendar: Calendar;
}

/** Everything the settings modal shows. */
export interface Config extends Settings {
  blameEnabled: boolean;
  blameFormat: string;
  blameDelay: number;
  customAvatars: string[];
  version: string;
  vscodeVersion: string;
  repoName?: string;
}

/** Keys under the gitWorkspace configuration section the webview may write. */
export type SettingKey =
  | 'theme'
  | 'graph.density'
  | 'graph.pageSize'
  | 'calendar'
  | 'avatars.gravatar'
  | 'inlineBlame.enabled'
  | 'inlineBlame.format'
  | 'inlineBlame.delay';

export type Calendar = 'gregory' | 'persian' | 'islamic-umalqura';

export interface AuthorInfo {
  name: string;
  email: string;
  commits: number;
  /** Unix seconds of first and latest commit. */
  first?: number;
  last?: number;
  /** Other names used with the same email. */
  aliases: string[];
  customAvatar: boolean;
  isYou: boolean;
}

/** Host-side implementation: every method may be async. */
export type HostImpl = {
  [K in keyof HostApi]: (...a: Parameters<HostApi[K]>) => ReturnType<HostApi[K]> | Promise<ReturnType<HostApi[K]>>;
};

export type Method = keyof HostApi;
export type Params<M extends Method> = Parameters<HostApi[M]>[0];
export type Result<M extends Method> = ReturnType<HostApi[M]>;

export interface RequestMessage {
  kind: 'request';
  id: number;
  method: Method;
  params?: unknown;
}

export interface ResponseMessage {
  kind: 'response';
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export type HostEvent =
  | { kind: 'event'; name: 'repoChanged' }
  | { kind: 'event'; name: 'settingsChanged'; settings: Settings }
  | { kind: 'event'; name: 'busy'; busy: boolean; label?: string }
  | { kind: 'event'; name: 'selectCommit'; hash: string }
  | { kind: 'event'; name: 'avatarsChanged'; email?: string };

export type HostMessage = ResponseMessage | HostEvent;

export function isRequest(m: unknown): m is RequestMessage {
  if (!m || typeof m !== 'object') return false;
  const r = m as Record<string, unknown>;
  return r.kind === 'request' && typeof r.id === 'number' && typeof r.method === 'string';
}
