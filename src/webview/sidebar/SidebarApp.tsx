import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FileChange, StatusInfo } from '../../shared/protocol';
import { Empty, Icon, IconButton, ProgressBar, useMenu, type MenuEntry } from '../components/ui';
import { act, call, onEvent, vscode } from '../lib/rpc';
import { applyTheme } from '../lib/theme';
import { cx, fileIcon, splitPath } from '../lib/util';

interface Persisted {
  message: string;
  collapsed: Record<string, boolean>;
  amend: boolean;
  tree?: boolean;
  collapsedDirs?: Record<string, boolean>;
}

type Section = 'conflicts' | 'staged' | 'unstaged';

const isMac = navigator.platform.toLowerCase().includes('mac');

export function SidebarApp() {
  const saved = vscode.getState<Persisted>();
  const [status, setStatus] = useState<StatusInfo | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState(saved?.message ?? '');
  const [amend, setAmend] = useState(saved?.amend ?? false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(saved?.collapsed ?? {});
  const [active, setActive] = useState<string | null>(null);
  const [tree, setTree] = useState(saved?.tree ?? false);
  const [collapsedDirs, setCollapsedDirs] = useState<Record<string, boolean>>(saved?.collapsedDirs ?? {});
  const menu = useMenu();
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(
    () => {
      vscode.setState<Persisted>({ message, collapsed, amend, tree, collapsedDirs });
    },
    [message, collapsed, amend, tree, collapsedDirs],
  );

  const load = useCallback(() => {
    call('getStatus')
      .then((s) => {
        setStatus(s);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    return onEvent((e) => {
      if (e.name === 'repoChanged') load();
      else if (e.name === 'busy') setBusy(e.busy ? (e.label ?? 'Working') : null);
      else if (e.name === 'settingsChanged') applyTheme(e.settings.theme);
    });
  }, [load]);

  // Auto-grow the commit message box.
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = `${Math.min(160, Math.max(36, ta.scrollHeight))}px`;
  }, [message]);

  const toggleAmend = async () => {
    const next = !amend;
    setAmend(next);
    if (next && !message.trim()) setMessage(await call('lastCommitMessage'));
  };

  if (status === undefined && !error) {
    return (
      <div className="sb">
        <ProgressBar show />
        <Empty icon="loading" title="Reading repository…">
          <button className="btn btn-ghost" onClick={load}>
            <Icon name="refresh" /> Retry
          </button>
        </Empty>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sb">
        <Empty icon="error" title="Git error">
          <p>{error}</p>
          <button className="btn btn-ghost" onClick={load}>
            <Icon name="refresh" /> Retry
          </button>
        </Empty>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="sb">
        <Empty icon="source-control" title="No repository">
          <p>This workspace is not a Git repository yet.</p>
          <button className="btn btn-primary" onClick={() => act('initRepo')}>
            <Icon name="add" /> Initialize Repository
          </button>
        </Empty>
      </div>
    );
  }

  const s = status;
  const total = s.staged.length + s.unstaged.length + s.conflicts.length;
  const stagedCount = s.staged.length;
  const canCommit = !!message.trim() &&(stagedCount > 0 || s.unstaged.length > 0 || amend) && s.conflicts.length === 0;
  const stageAll = stagedCount === 0 && !amend;

  const doCommit = async (push = false) => {
    if (!canCommit) {
      if (!message.trim()) taRef.current?.focus();
      return;
    }
    const ok = await call('commit', { message, amend, push, stageAll }).catch(() => false);
    if (ok) {
      setMessage('');
      setAmend(false);
    }
  };

  const commitMenu = (el: HTMLElement) => {
    const items: MenuEntry[] = [
      { label: 'Commit', icon: 'check', hint: isMac ? '⌘↵' : 'Ctrl+↵', disabled: !canCommit, run: () => doCommit() },
      { label: 'Commit & Push', icon: 'cloud-upload', disabled: !canCommit, run: () => doCommit(true) },
      { separator: true },
      { label: amend ? 'Stop amending' : 'Amend last commit', icon: amend ? 'close' : 'edit', run: toggleAmend },
    ];
    menu.openAt(el, items, 'right');
  };

  const moreMenu = (el: HTMLElement) => {
    const items: MenuEntry[] = [
      { label: 'Fetch', icon: 'repo-fetch', run: () => act('fetch') },
      { label: 'Pull', icon: 'arrow-down', run: () => act('pull') },
      { label: 'Push', icon: 'arrow-up', run: () => act('push') },
      { separator: true },
      { label: 'Stash changes', icon: 'archive', disabled: total === 0, run: () => act('stash') },
      { label: 'Pop latest stash', icon: 'unarchive', run: () => act('stashPop') },
      { separator: true },
      { label: 'Open Git Graph', icon: 'git-merge', run: () => act('openGraph', {}) },
      { label: 'Select repository…', icon: 'repo', run: () => act('selectRepository') },
    ];
    menu.openAt(el, items, 'right');
  };

  const fileMenu = (f: FileChange, section: Section): MenuEntry[] => [
    { label: 'Open changes', icon: 'diff', run: () => act('openChange', { file: f, staged: section === 'staged' }) },
    { label: 'Open file', icon: 'go-to-file', disabled: f.status === 'D', run: () => act('openFile', { path: f.path }) },
    { separator: true },
    section === 'staged'
      ? { label: 'Unstage', icon: 'remove', run: () => act('unstage', { paths: [f.path] }) }
      : { label: section === 'conflicts' ? 'Mark resolved (stage)' : 'Stage', icon: 'add', run: () => act('stage', { paths: [f.path] }) },
    ...(section === 'unstaged'
      ? ([{ separator: true }, { label: 'Discard changes', icon: 'discard', danger: true, run: () => act('discard', { files: [f] }) }] as MenuEntry[])
      : []),
    { separator: true },
    { label: 'Copy path', icon: 'copy', run: () => act('copy', { text: f.path }) },
  ];

  const toggle = (k: Section) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));
  const toggleDir = (k: string) => setCollapsedDirs((c) => ({ ...c, [k]: !c[k] }));
  const paths = (fs: FileChange[]) => fs.map((f) => f.path);

  const dirMenu = (section: Section) => (e: React.MouseEvent, fs: FileChange[], dir: string) =>
    menu.open(e, [
      { header: `${dir}/ · ${fs.length} ${fs.length === 1 ? 'file' : 'files'}` },
      section === 'staged'
        ? { label: 'Unstage folder', icon: 'remove', run: () => act('unstage', { paths: paths(fs) }) }
        : { label: 'Stage folder', icon: 'add', run: () => act('stage', { paths: paths(fs) }) },
      ...(section === 'unstaged'
        ? ([{ separator: true }, { label: 'Discard folder changes…', icon: 'discard', danger: true, run: () => act('discard', { files: fs }) }] as MenuEntry[])
        : []),
      { separator: true },
      { label: 'Copy folder path', icon: 'copy', run: () => act('copy', { text: dir }) },
    ]);

  const common = { active, setActive, tree, collapsedDirs, toggleDir };
  const branchName = s.branch ?? (s.headHash ? s.headHash.slice(0, 7) : 'No commits');

  return (
    <div className="sb">
      <ProgressBar show={!!busy} />

      {/* Branch row */}
      <div className="sb-top">
        <button className="branch-pill" onClick={() => act('pickBranch')} title="Switch branch">
          <Icon name={s.detached ? 'debug-disconnect' : 'git-branch'} />
          <span className="branch-name">{branchName}</span>
          <Icon name="chevron-down" className="chev" />
        </button>
        <div className="grow" />
        <IconButton
          icon={tree ? 'list-flat' : 'list-tree'}
          title={tree ? 'View as list' : 'View as tree'}
          onClick={() => setTree((t) => !t)}
        />
        <IconButton icon="refresh" title="Refresh" onClick={load} spin={busy === 'Fetch'} />
        <IconButton icon="add" title="New branch" onClick={() => act('createBranch', {})} />
        <IconButton icon="ellipsis" title="More actions" onClick={(e) => moreMenu(e.currentTarget as HTMLElement)} />
      </div>

      {/* Sync strip */}
      {s.branch && (
        <div className="sync">
          {s.upstream ? (
            <>
              <Icon name="cloud" />
              <span className="mono upstream" title="Upstream">
                {s.upstream}
              </span>
              <div className="grow" />
              <span className={cx('ab mono', s.behind > 0 && 'on')} title={`${s.behind} to pull`}>
                <Icon name="arrow-down" />
                {s.behind}
              </span>
              <span className={cx('ab mono', s.ahead > 0 && 'on')} title={`${s.ahead} to push`}>
                <Icon name="arrow-up" />
                {s.ahead}
              </span>
              <button className="btn btn-ghost sync-btn" onClick={() => act('sync')} disabled={!!busy}>
                <Icon name="sync" className={busy && /Pull|Push|Fetch/.test(busy) ? 'spin' : undefined} />
                {s.behind || s.ahead ? 'Sync' : 'Fetch'}
              </button>
            </>
          ) : (
            <>
              <Icon name="cloud" />
              <span className="muted">Not published</span>
              <div className="grow" />
              <button className="btn btn-ghost sync-btn" onClick={() => act('push')} disabled={!!busy}>
                <Icon name="cloud-upload" /> Publish
              </button>
            </>
          )}
        </div>
      )}

      {/* Operation banner */}
      {s.operation && (
        <div className="op-banner">
          <Icon name="warning" />
          <div className="op-text">
            <strong>{s.operation[0].toUpperCase() + s.operation.slice(1)} in progress</strong>
            <span>{s.conflicts.length ? `${s.conflicts.length} conflict(s) to resolve` : 'Ready to continue'}</span>
          </div>
          <button className="btn btn-ghost" onClick={() => act('abortOperation')}>
            Abort
          </button>
          <button className="btn btn-primary" disabled={s.conflicts.length > 0} onClick={() => act('continueOperation')}>
            Continue
          </button>
        </div>
      )}

      {/* Working tree card */}
      <button className={cx('wt-card', total === 0 && 'clean')} onClick={() => act('openGraph', {})} title="Open Git Graph">
        <span className="wt-icon">
          <Icon name={total === 0 ? 'check' : 'circle-filled'} />
        </span>
        <span className="wt-text">
          <span className="wt-title">Working Tree</span>
          <span className="wt-sub mono">
            {total === 0 ? 'clean' : `${total} ${total === 1 ? 'change' : 'changes'}`}
            {stagedCount > 0 && ` • ${stagedCount} staged`}
          </span>
        </span>
        <span className="wt-go">
          <Icon name="chevron-right" />
        </span>
      </button>

      {/* File sections */}
      <div className="sb-scroll">
        {s.conflicts.length > 0 && (
          <FileSection
            id="conflicts"
            title="Merge Conflicts"
            files={s.conflicts}
            collapsed={!!collapsed.conflicts}
            onToggle={() => toggle('conflicts')}
            {...common}
            dirActions={(fs) => [{ icon: 'add', title: 'Mark folder resolved', run: () => act('stage', { paths: paths(fs) }) }]}
            dirMenu={dirMenu('conflicts')}
            menu={(e, f) => menu.open(e, fileMenu(f, 'conflicts'))}
            actions={[{ icon: 'add', title: 'Stage all (mark resolved)', run: () => act('stage', { paths: s.conflicts.map((f) => f.path) }) }]}
            rowActions={(f) => [
              { icon: 'go-to-file', title: 'Open file', run: () => act('openFile', { path: f.path }) },
              { icon: 'add', title: 'Mark resolved', run: () => act('stage', { paths: [f.path] }) },
            ]}
            onOpen={(f) => act('openFile', { path: f.path })}
          />
        )}

        <FileSection
          id="unstaged"
          title="Changes"
          files={s.unstaged}
          collapsed={!!collapsed.unstaged}
          onToggle={() => toggle('unstaged')}
          {...common}
          menu={(e, f) => menu.open(e, fileMenu(f, 'unstaged'))}
          actions={[{ icon: 'add', title: 'Stage all changes', run: () => act('stage', { paths: paths(s.unstaged) }) }]}
          more={(el) =>
            menu.openAt(
              el,
              [
                { label: 'Stage all changes', icon: 'add', run: () => act('stage', { paths: paths(s.unstaged) }) },
                { separator: true },
                { label: 'Discard all changes…', icon: 'discard', danger: true, run: () => act('discard', { files: s.unstaged }) },
              ],
              'right',
            )
          }
          dirActions={(fs) => [{ icon: 'add', title: 'Stage folder', run: () => act('stage', { paths: paths(fs) }) }]}
          dirMenu={dirMenu('unstaged')}
          rowActions={(f) => [
            { icon: 'go-to-file', title: 'Open file', run: () => act('openFile', { path: f.path }), hide: f.status === 'D' },
            { icon: 'discard', title: 'Discard changes', run: () => act('discard', { files: [f] }) },
            { icon: 'add', title: 'Stage', run: () => act('stage', { paths: [f.path] }) },
          ]}
          onOpen={(f) => act('openChange', { file: f, staged: false })}
          emptyText={total === 0 ? 'Nothing changed. Your working tree is clean.' : 'Nothing here. All changes are staged.'}
        />

        <FileSection
          id="staged"
          title="Staged Changes"
          files={s.staged}
          collapsed={!!collapsed.staged}
          onToggle={() => toggle('staged')}
          {...common}
          dirActions={(fs) => [{ icon: 'remove', title: 'Unstage folder', run: () => act('unstage', { paths: paths(fs) }) }]}
          dirMenu={dirMenu('staged')}
          menu={(e, f) => menu.open(e, fileMenu(f, 'staged'))}
          actions={[{ icon: 'remove', title: 'Unstage all', run: () => act('unstage', { paths: s.staged.map((f) => f.path) }) }]}
          rowActions={(f) => [
            { icon: 'go-to-file', title: 'Open file', run: () => act('openFile', { path: f.path }), hide: f.status === 'D' },
            { icon: 'remove', title: 'Unstage', run: () => act('unstage', { paths: [f.path] }) },
          ]}
          onOpen={(f) => act('openChange', { file: f, staged: true })}
          emptyText="Nothing staged. Use + on a file to stage it."
        />
      </div>

      {/* Commit box */}
      <div className="commit-box">
        {amend && (
          <div className="amend-note">
            <Icon name="edit" /> Amending last commit
            <button className="link" onClick={toggleAmend}>
              Cancel
            </button>
          </div>
        )}
        <div className="msg">
          <Icon name="sparkle" className="msg-icon" />
          <textarea
            ref={taRef}
            value={message}
            rows={1}
            placeholder={stageAll && total > 0 ? 'Message (commits all changes)…' : 'Write a commit message…'}
            spellCheck
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void doCommit();
              }
            }}
          />
        </div>
        <div className="commit-actions">
          <button className="btn btn-primary commit-btn" disabled={!canCommit || !!busy} onClick={() => doCommit()}>
            <Icon name="check" />
            <span>{amend ? 'Amend Commit' : stageAll && total > 0 ? 'Commit All' : 'Commit'}</span>
            <span className="kbd">{isMac ? '⌘↵' : 'Ctrl ↵'}</span>
          </button>
          <button className="btn btn-primary commit-more" title="More commit actions" onClick={(e) => commitMenu(e.currentTarget)}>
            <Icon name="chevron-down" />
          </button>
        </div>
      </div>

      {menu.node}
    </div>
  );
}

interface RowAction {
  icon: string;
  title: string;
  run: () => void;
  hide?: boolean;
}

interface DirNode {
  /** Display name; single-child folder chains are compressed ("src/lib"). */
  name: string;
  path: string;
  dirs: DirNode[];
  files: FileChange[];
}

/** Builds a folder tree from file paths, compressing single-child folder chains like VS Code. */
function buildTree(files: FileChange[]): DirNode {
  type Raw = { dirs: Map<string, Raw>; files: FileChange[] };
  const root: Raw = { dirs: new Map(), files: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    let n = root;
    for (const part of parts.slice(0, -1)) {
      let next = n.dirs.get(part);
      if (!next) n.dirs.set(part, (next = { dirs: new Map(), files: [] }));
      n = next;
    }
    n.files.push(f);
  }
  const convert = (name: string, path: string, r: Raw): DirNode => {
    while (r.dirs.size === 1 && r.files.length === 0 && name) {
      const [childName, child] = [...r.dirs][0];
      name = `${name}/${childName}`;
      path = `${path}/${childName}`;
      r = child;
    }
    const dirs = [...r.dirs]
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([n, c]) => convert(n, path ? `${path}/${n}` : n, c));
    const fs = [...r.files].sort((x, y) => x.path.localeCompare(y.path));
    return { name, path, dirs, files: fs };
  };
  return convert('', '', root);
}

function allFiles(d: DirNode): FileChange[] {
  return [...d.files, ...d.dirs.flatMap(allFiles)];
}

function FileSection(props: {
  id: Section;
  title: string;
  files: FileChange[];
  collapsed: boolean;
  onToggle: () => void;
  active: string | null;
  setActive: (k: string) => void;
  menu: (e: React.MouseEvent, f: FileChange) => void;
  /** Safe one-click actions shown on the header. */
  actions: RowAction[];
  /** Further actions (including destructive ones) behind a "…" button. */
  more?: (el: HTMLElement) => void;
  rowActions: (f: FileChange) => RowAction[];
  dirActions: (files: FileChange[]) => RowAction[];
  dirMenu: (e: React.MouseEvent, files: FileChange[], path: string) => void;
  onOpen: (f: FileChange) => void;
  tree: boolean;
  collapsedDirs: Record<string, boolean>;
  toggleDir: (key: string) => void;
  emptyText?: string;
}) {
  const { files } = props;

  const fileRow = (f: FileChange, depth: number) => {
    const key = `${props.id}:${f.path}`;
    const { dir, name } = splitPath(f.path);
    const fi = fileIcon(f.path);
    return (
      <li
        key={key}
        className={cx('file', props.active === key && 'active', f.status === 'D' && 'deleted')}
        style={{ ['--depth' as string]: depth }}
        tabIndex={0}
        title={f.oldPath ? `${f.oldPath} → ${f.path}` : f.path}
        onClick={() => {
          props.setActive(key);
          props.onOpen(f);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            props.setActive(key);
            props.onOpen(f);
          }
        }}
        onContextMenu={(e) => {
          props.setActive(key);
          props.menu(e, f);
        }}
      >
        <Icon name={fi.icon} className={`tone-${fi.tone}`} />
        <span className="fname">{name}</span>
        {!props.tree && <span className="fdir">{dir}</span>}
        <span className="grow" />
        <span className="row-actions">
          {props
            .rowActions(f)
            .filter((a) => !a.hide)
            .map((a) => (
              <IconButton key={a.icon} icon={a.icon} title={a.title} className="sm" onClick={a.run} />
            ))}
        </span>
        <span className={cx('status-letter', `st-${f.status}`)} title={statusName(f.status)}>
          {f.status === '?' ? 'U' : f.status}
        </span>
      </li>
    );
  };

  const dirRows = (d: DirNode, depth: number): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    for (const sub of d.dirs) {
      const key = `${props.id}:${sub.path}`;
      const closed = !!props.collapsedDirs[key];
      const under = allFiles(sub);
      out.push(
        <li
          key={`d:${key}`}
          className="file dir"
          style={{ ['--depth' as string]: depth }}
          tabIndex={0}
          title={sub.path}
          aria-expanded={!closed}
          onClick={() => props.toggleDir(key)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), props.toggleDir(key))}
          onContextMenu={(e) => props.dirMenu(e, under, sub.path)}
        >
          <Icon name={closed ? 'chevron-right' : 'chevron-down'} className="dir-chev" />
          <Icon name={closed ? 'folder' : 'folder-opened'} className="dir-icon" />
          <span className="fname">{sub.name}</span>
          <span className="grow" />
          <span className="row-actions">
            {props.dirActions(under).map((a) => (
              <IconButton key={a.icon} icon={a.icon} title={a.title} className="sm" onClick={a.run} />
            ))}
          </span>
          <span className="dir-count">{under.length}</span>
        </li>,
      );
      if (!closed) out.push(...dirRows(sub, depth + 1));
    }
    for (const f of d.files) out.push(fileRow(f, depth));
    return out;
  };

  return (
    <section className={cx('section', props.id)}>
      <div className="section-head">
        <button className="section-toggle" aria-expanded={!props.collapsed} onClick={props.onToggle}>
          <Icon name={props.collapsed ? 'chevron-right' : 'chevron-down'} className="chev" />
          <span className="section-title">{props.title}</span>
        </button>
        {files.length > 0 && (
          <span className="section-actions">
            {props.actions.map((a) => (
              <IconButton key={a.icon} icon={a.icon} title={a.title} className="sm" onClick={a.run} />
            ))}
            {props.more && <IconButton icon="ellipsis" title="More actions" className="sm" onClick={(e) => props.more!(e.currentTarget as HTMLElement)} />}
          </span>
        )}
        <span className="count">{files.length}</span>
      </div>
      {!props.collapsed && (
        <ul className={cx('files', props.tree && 'tree')} role="list">
          {props.tree ? dirRows(buildTree(files), 0) : files.map((f) => fileRow(f, 0))}
          {files.length === 0 && props.emptyText && <li className="files-empty">{props.emptyText}</li>}
        </ul>
      )}
    </section>
  );
}

function statusName(s: FileChange['status']): string {
  return (
    {
      A: 'Added',
      M: 'Modified',
      D: 'Deleted',
      R: 'Renamed',
      C: 'Copied',
      T: 'Type changed',
      U: 'Conflict',
      '?': 'Untracked',
    } as const
  )[s];
}
