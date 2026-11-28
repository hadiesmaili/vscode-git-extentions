import { useEffect, useState } from 'react';
import type { CommitDetail, FileChange } from '../../shared/protocol';
import { Avatar, Icon, IconButton, RefBadge } from '../components/ui';
import { act, call } from '../lib/rpc';
import { allFiles, buildTree, cx, fileIcon, splitPath, timeAgo, type DirNode } from '../lib/util';
import { dateHoverProps } from '../components/DateCard';

const UNCOMMITTED = '*';
const TREE_KEY = 'gitGraph.detailsTree';

function loadTree(): boolean {
  try {
    return localStorage.getItem(TREE_KEY) === '1';
  } catch {
    return false;
  }
}

export function CommitDetails({
  hash,
  version,
  onClose,
  onSelect,
  laneColor,
}: {
  hash: string;
  /** Bumps when the repository changes, to refetch. */
  version: number;
  onClose: () => void;
  onSelect: (hash: string) => void;
  laneColor: number;
}) {
  const [detail, setDetail] = useState<CommitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [tree, setTree] = useState(loadTree);
  const [collapsedDirs, setCollapsedDirs] = useState<Record<string, boolean>>({});

  const toggleTree = () =>
    setTree((t) => {
      try {
        localStorage.setItem(TREE_KEY, t ? '0' : '1');
      } catch {
        /* storage unavailable */
      }
      return !t;
    });
  const toggleDir = (path: string) => setCollapsedDirs((c) => ({ ...c, [path]: !c[path] }));

  useEffect(() => {
    let live = true;
    setError(null);
    call('getCommit', { hash })
      .then((d) => live && setDetail(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [hash, hash === UNCOMMITTED ? version : 0]);

  useEffect(() => {
    setActiveFile(null);
    setCollapsedDirs({});
  }, [hash]);

  const d = detail && detail.hash === hash ? detail : null;
  const uncommitted = hash === UNCOMMITTED;

  const openFile = (f: FileChange) => {
    setActiveFile(f.path);
    act('openCommitFile', { hash, parent: d?.parents[0], file: f });
  };

  const fileRow = (f: FileChange, depth: number) => {
    const { dir, name } = splitPath(f.path);
    const fi = fileIcon(f.path);
    return (
      <li key={f.path} style={{ ['--depth' as string]: depth }}>
        <button
          className={cx('file-row', activeFile === f.path && 'active')}
          onClick={() => openFile(f)}
          title={f.oldPath ? `${f.oldPath} → ${f.path}` : f.path}
        >
          <Icon name={fi.icon} className={`tone-${fi.tone}`} />
          <span className="file-name">{name}</span>
          {(!tree || f.oldPath) && <span className="file-dir">{f.oldPath ? `${f.oldPath} →` : dir}</span>}
          <span className="grow" />
          {f.binary ? (
            <span className="file-bin">bin</span>
          ) : (
            <span className="file-stats">
              {!!f.additions && <span className="add">+{f.additions}</span>}
              {!!f.deletions && <span className="del">−{f.deletions}</span>}
            </span>
          )}
          <span className={cx('status-letter', `st-${f.status}`)}>{f.status}</span>
        </button>
      </li>
    );
  };

  const dirRows = (node: DirNode, depth: number): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    for (const sub of node.dirs) {
      const closed = !!collapsedDirs[sub.path];
      out.push(
        <li key={`d:${sub.path}`} style={{ ['--depth' as string]: depth }}>
          <button className="file-row dir-row" aria-expanded={!closed} title={sub.path} onClick={() => toggleDir(sub.path)}>
            <Icon name={closed ? 'chevron-right' : 'chevron-down'} className="dir-chev" />
            <Icon name={closed ? 'folder' : 'folder-opened'} className="dir-icon" />
            <span className="file-name">{sub.name}</span>
            <span className="grow" />
            <span className="dir-count">{allFiles(sub).length}</span>
          </button>
        </li>,
      );
      if (!closed) out.push(...dirRows(sub, depth + 1));
    }
    for (const f of node.files) out.push(fileRow(f, depth));
    return out;
  };

  return (
    <section className="details" aria-label="Commit details">
      <header className="details-head">
        <span className="details-badge" style={{ ['--c' as string]: `var(--lane-${laneColor})` }}>
          <Icon name={uncommitted ? 'diff' : 'git-commit'} />
        </span>
        <h2>{uncommitted ? 'Working Tree' : 'Commit Details'}</h2>
        <div className="grow" />
        {!uncommitted && d && (
          <IconButton icon="copy" title="Copy commit hash" onClick={() => act('copy', { text: d.hash, label: d.hash.slice(0, 7) })} />
        )}
        <IconButton icon="close" title="Close details (Esc)" onClick={onClose} />
      </header>

      {error && <div className="details-error">{error}</div>}
      {!d && !error && <div className="details-loading"><Icon name="loading" className="spin" /> Loading…</div>}

      {d && (
        <div className="details-body">
          <div className="details-meta">
            {uncommitted ? (
              <>
                <div className="details-title">
                  <span className="uncommitted-dot" />
                  <div>
                    <h3>Uncommitted changes</h3>
                    <p className="muted">Changes in your working tree that are not committed yet.</p>
                  </div>
                </div>
                <div className="details-actions">
                  <button className="btn btn-ghost" onClick={() => act('stash')}>
                    <Icon name="archive" /> Stash changes
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="details-title">
                  <Avatar name={d.author} email={d.email} size={40} />
                  <div className="details-title-text">
                    <h3 title={d.subject}>{d.subject}</h3>
                    <p className="muted">
                      <span title={d.email}>{d.author}</span>
                      <span className="dot">•</span>
                      <span className="date-hover" {...dateHoverProps(d.date)}>{timeAgo(d.date, false)}</span>
                      {d.committer && d.committer !== d.author && (
                        <>
                          <span className="dot">•</span>
                          <span>committed by {d.committer}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="chips">
                  <button className="chip mono" title="Copy full hash" onClick={() => act('copy', { text: d.hash, label: d.hash.slice(0, 7) })}>
                    {d.hash.slice(0, 8)}
                    <Icon name="copy" />
                  </button>
                  {d.parents.map((p) => (
                    <button key={p} className="chip mono ghost" title="Go to parent" onClick={() => onSelect(p)}>
                      <Icon name="arrow-down" />
                      {p.slice(0, 7)}
                    </button>
                  ))}
                  {d.refs.map((r) => (
                    <RefBadge key={r.name} r={r} color={laneColor} />
                  ))}
                </div>
                {d.body && <pre className="details-message">{d.body}</pre>}
              </>
            )}
          </div>

          <div className="details-files">
            <div className="files-head">
              <Icon name="files" />
              <span>
                {d.files.length} {d.files.length === 1 ? 'file' : 'files'} changed
              </span>
              <div className="grow" />
              <span className="stat-add">+{d.additions}</span>
              <span className="stat-del">−{d.deletions}</span>
              <IconButton
                icon={tree ? 'list-flat' : 'list-tree'}
                title={tree ? 'View as list' : 'View as tree'}
                className="sm"
                onClick={toggleTree}
              />
            </div>
            <ul className={cx('files-list', tree && 'tree')} role="list">
              {tree ? dirRows(buildTree(d.files), 0) : d.files.map((f) => fileRow(f, 0))}
              {d.files.length === 0 && <li className="muted files-empty">No file changes (empty or merge commit).</li>}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
