import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GraphData, GraphRow, GraphScope, Ref, Settings } from '../../shared/protocol';
import { Avatar, Empty, Icon, IconButton, ProgressBar, RefBadge, useMenu, type MenuEntry } from '../components/ui';
import { act, call, onEvent, vscode } from '../lib/rpc';
import { cx, timeAgo } from '../lib/util';
import { setCalendar as applyCalendar } from '../lib/dates';
import { applyTheme } from '../lib/theme';
import { DateCardHost, dateHoverProps } from '../components/DateCard';
import { AuthorCardHost } from '../components/AuthorCard';
import { SettingsModal } from '../components/SettingsModal';
import '../components/settings.css';
import { CommitDetails } from './CommitDetails';
import { GraphCanvas, type Geometry } from './GraphCanvas';

interface Persisted {
  scope: GraphScope;
  branch?: string;
  selected?: string;
  detailsH: number;
  showDetails: boolean;
}

const MAX_LANES_SHOWN = 16;
const OVERSCAN = 8;

export function GraphApp() {
  const saved = vscode.getState<Persisted>();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [scope, setScope] = useState<GraphScope>(saved?.scope ?? 'all');
  const [branch, setBranch] = useState<string | undefined>(saved?.branch);
  const [maxCount, setMaxCount] = useState(0);
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | undefined>(saved?.selected);
  const [showDetails, setShowDetails] = useState(saved?.showDetails ?? false);
  const [detailsH, setDetailsH] = useState(saved?.detailsH ?? 280);
  const [search, setSearch] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);
  const [version, setVersion] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const menu = useMenu();

  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);

  useEffect(() => {
    vscode.setState<Persisted>({ scope, branch, selected, detailsH, showDetails });
  }, [scope, branch, selected, detailsH, showDetails]);

  useEffect(() => {
    call('getSettings').then((s) => {
      setSettings(s);
      setMaxCount(s.pageSize);
    });
  }, []);

  const load = useCallback(() => {
    if (!maxCount) return;
    setLoading(true);
    call('getGraph', { scope, branch, maxCount })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [scope, branch, maxCount]);

  useEffect(load, [load]);

  useEffect(
    () =>
      onEvent((e) => {
        if (e.name === 'repoChanged') {
          load();
          setVersion((v) => v + 1);
        } else if (e.name === 'busy') setBusy(e.busy ? (e.label ?? 'Working') : null);
        else if (e.name === 'settingsChanged') setSettings(e.settings);
        else if (e.name === 'selectCommit') {
          setSelected(e.hash);
          setShowDetails(true);
          pendingScroll.current = e.hash;
        }
      }),
    [load],
  );

  useEffect(() => {
    if (settings) applyCalendar(settings.calendar);
  }, [settings?.calendar]);

  useEffect(() => {
    if (settings) applyTheme(settings.theme);
  }, [settings?.theme]);

  const g: Geometry = useMemo(() => {
    const d = settings?.density;
    if (d === 'spacious') return { rowH: 54, laneW: 26, padX: 16, spacious: true };
    const compact = d === 'compact';
    return { rowH: compact ? 28 : 36, laneW: compact ? 14 : 18, padX: 12 };
  }, [settings?.density]);

  const rows = data?.rows ?? [];
  const lanes = Math.min(data?.lanes ?? 1, MAX_LANES_SHOWN);
  const graphW = g.padX * 2 + lanes * g.laneW;
  // Spacious: 3 badges + "+N" fill two wrapped lines of two.
  const maxRefs = 3;

  // ---------- search ----------
  const q = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [] as number[];
    const out: number[] = [];
    rows.forEach((r, i) => {
      const c = r.commit;
      if (
        c.subject.toLowerCase().includes(q) ||
        c.author.toLowerCase().includes(q) ||
        c.email.toLowerCase() === q ||
        c.hash.startsWith(q) ||
        r.refs.some((x) => x.short.toLowerCase().includes(q))
      )
        out.push(i);
    });
    return out;
  }, [rows, q]);
  const matchSet = useMemo(() => new Set(matches), [matches]);

  // ---------- virtualization ----------
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    setViewH(el.clientHeight);
    return () => ro.disconnect();
  }, [data !== null]);

  const start = Math.max(0, Math.floor(scrollTop / g.rowH) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewH) / g.rowH) + OVERSCAN);

  const scrollToIndex = useCallback(
    (i: number, center = false) => {
      const el = listRef.current;
      if (!el) return;
      const top = i * g.rowH;
      if (center) el.scrollTop = top - el.clientHeight / 2 + g.rowH / 2;
      else if (top < el.scrollTop) el.scrollTop = top;
      else if (top + g.rowH > el.scrollTop + el.clientHeight) el.scrollTop = top + g.rowH - el.clientHeight;
    },
    [g.rowH],
  );

  const pendingScroll = useRef<string | undefined>(saved?.selected);
  useEffect(() => {
    const h = pendingScroll.current;
    if (!h || !rows.length) return;
    const i = rows.findIndex((r) => r.commit.hash === h);
    if (i >= 0) {
      pendingScroll.current = undefined;
      requestAnimationFrame(() => scrollToIndex(i, true));
    } else if (data?.hasMore && maxCount < 20000) {
      setMaxCount((m) => m + (settings?.pageSize ?? 500));
    } else pendingScroll.current = undefined;
  }, [rows, data?.hasMore, scrollToIndex]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setScrollTop(el.scrollTop);
    if (data?.hasMore && !loading && el.scrollTop + el.clientHeight > el.scrollHeight - g.rowH * 20) {
      setMaxCount((m) => m + (settings?.pageSize ?? 500));
    }
  };

  const selIndex = rows.findIndex((r) => r.commit.hash === selected);
  const select = (i: number, open?: boolean) => {
    const r = rows[i];
    if (!r) return;
    setSelected(r.commit.hash);
    if (open !== undefined) setShowDetails(open);
    scrollToIndex(i);
  };

  const selectHash = (hash: string) => {
    const i = rows.findIndex((r) => r.commit.hash === hash);
    if (i >= 0) {
      setSelected(hash);
      scrollToIndex(i, true);
    } else {
      pendingScroll.current = hash;
      setSelected(hash);
      if (data?.hasMore) setMaxCount((m) => m + (settings?.pageSize ?? 500));
    }
  };

  const jumpMatch = (dir: 1 | -1) => {
    if (!matches.length) return;
    const next = (matchIdx + dir + matches.length) % matches.length;
    setMatchIdx(next);
    setSelected(rows[matches[next]].commit.hash);
    scrollToIndex(matches[next], true);
  };

  useEffect(() => {
    setMatchIdx(0);
    if (matches.length) scrollToIndex(matches[0], true);
  }, [q]);

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onListKey = (e: React.KeyboardEvent) => {
    const page = Math.max(1, Math.floor(viewH / g.rowH) - 1);
    const cur = selIndex < 0 ? -1 : selIndex;
    const keys: Record<string, () => void> = {
      ArrowDown: () => select(Math.min(rows.length - 1, cur + 1)),
      ArrowUp: () => select(Math.max(0, cur - 1)),
      PageDown: () => select(Math.min(rows.length - 1, cur + page)),
      PageUp: () => select(Math.max(0, cur - page)),
      Home: () => select(0),
      End: () => select(rows.length - 1),
      Enter: () => cur >= 0 && setShowDetails((s) => !s),
      ' ': () => cur >= 0 && setShowDetails((s) => !s),
      Escape: () => setShowDetails(false),
      '/': () => searchRef.current?.focus(),
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  // ---------- menus ----------
  const commitMenu = (row: GraphRow): MenuEntry[] => {
    const c = row.commit;
    const short = c.hash.slice(0, 7);
    if (row.uncommitted) {
      return [
        { label: 'Show changes', icon: 'diff', run: () => openDetails(row) },
        { label: 'Stash all changes', icon: 'archive', run: () => act('stash') },
      ];
    }
    return [
      { header: `${short} · ${c.subject.slice(0, 40)}` },
      { label: 'Copy commit hash', icon: 'copy', hint: short, run: () => act('copy', { text: c.hash, label: short }) },
      { label: 'Copy commit message', icon: 'quote', run: () => act('copy', { text: c.subject, label: 'message' }) },
      { separator: true },
      { label: 'Checkout (detached)', icon: 'debug-disconnect', disabled: row.isHead, run: () => act('checkout', { ref: c.hash }) },
      { label: 'Create branch here…', icon: 'git-branch-create', run: () => act('createBranch', { from: c.hash }) },
      { label: 'Create tag here…', icon: 'tag', run: () => act('createTag', { hash: c.hash }) },
      { separator: true },
      { label: 'Cherry-pick', icon: 'git-pull-request-go-to-changes', disabled: row.isHead, run: () => act('cherryPick', { hash: c.hash }) },
      { label: 'Revert commit', icon: 'discard', run: () => act('revert', { hash: c.hash }) },
      { separator: true },
      { header: 'Reset current branch to here' },
      { label: 'Soft: keep changes staged', icon: 'debug-step-back', run: () => act('reset', { hash: c.hash, mode: 'soft' }) },
      { label: 'Mixed: keep changes unstaged', icon: 'debug-step-back', run: () => act('reset', { hash: c.hash, mode: 'mixed' }) },
      { label: 'Hard: discard all changes', icon: 'warning', danger: true, run: () => act('reset', { hash: c.hash, mode: 'hard' }) },
    ];
  };

  const refMenu = (r: Ref): MenuEntry[] => {
    if (r.type === 'tag') {
      return [
        { header: `Tag ${r.short}` },
        { label: 'Checkout tag', icon: 'check', run: () => act('checkout', { ref: r.short }) },
        { label: 'Push tag', icon: 'cloud-upload', run: () => act('pushRef', { ref: r }) },
        { label: 'Copy name', icon: 'copy', run: () => act('copy', { text: r.short }) },
        { separator: true },
        { label: 'Delete tag', icon: 'trash', danger: true, run: () => act('deleteTag', { ref: r }) },
      ];
    }
    const remote = r.type === 'remote';
    return [
      { header: `${remote ? 'Remote branch' : 'Branch'} ${r.short}` },
      {
        label: remote ? 'Checkout as local branch' : 'Checkout',
        icon: 'check',
        disabled: r.current,
        run: () => act('checkout', { ref: r.short, remote }),
      },
      { label: 'Create branch from here…', icon: 'git-branch-create', run: () => act('createBranch', { from: r.short }) },
      { separator: true },
      { label: 'Merge into current branch', icon: 'git-merge', disabled: r.current, run: () => act('merge', { ref: r.short }) },
      { label: 'Rebase current branch onto this', icon: 'git-pull-request', disabled: r.current, run: () => act('rebase', { ref: r.short }) },
      ...(!remote
        ? ([
            { separator: true },
            { label: 'Push', icon: 'cloud-upload', run: () => act('pushRef', { ref: r }) },
            { label: 'Rename…', icon: 'edit', run: () => act('renameBranch', { ref: r }) },
          ] as MenuEntry[])
        : []),
      { label: 'Copy name', icon: 'copy', run: () => act('copy', { text: r.short }) },
      { separator: true },
      { label: remote ? 'Delete remote branch' : 'Delete branch', icon: 'trash', danger: true, disabled: r.current, run: () => act('deleteBranch', { ref: r }) },
    ];
  };

  const openDetails = (row: GraphRow) => {
    setSelected(row.commit.hash);
    setShowDetails(true);
  };

  const branchMenu = (el: HTMLElement) => {
    const refs = data?.refs ?? [];
    const items: MenuEntry[] = [
      { label: 'All branches', icon: branch ? 'blank' : 'check', run: () => setBranch(undefined) },
      { separator: true },
      { header: 'Local' },
      ...refs
        .filter((r) => r.type === 'head')
        .map((r) => ({ label: r.short, icon: branch === r.short ? 'check' : 'git-branch', hint: r.current ? 'HEAD' : undefined, run: () => setBranch(r.short) })),
    ];
    const remotes = refs.filter((r) => r.type === 'remote');
    if (remotes.length) {
      items.push({ header: 'Remote' }, ...remotes.map((r) => ({ label: r.short, icon: branch === r.short ? 'check' : 'cloud', run: () => setBranch(r.short) })));
    }
    menu.openAt(el, items);
  };

  const viewMenu = (el: HTMLElement) => {
    const d = settings?.density ?? 'comfortable';
    menu.openAt(
      el,
      [
        { header: 'Row density' },
        { label: 'Comfortable', icon: d === 'comfortable' ? 'check' : 'blank', run: () => act('setDensity', { density: 'comfortable' }) },
        { label: 'Compact', icon: d === 'compact' ? 'check' : 'blank', run: () => act('setDensity', { density: 'compact' }) },
        { label: 'Spacious', icon: d === 'spacious' ? 'check' : 'blank', run: () => act('setDensity', { density: 'spacious' }) },
        { separator: true },
        { label: 'Refresh', icon: 'refresh', run: load },
        { label: 'Select repository…', icon: 'repo', run: () => act('selectRepository') },
      ],
      'right',
    );
  };

  // ---------- resize details ----------
  const onDragStart = (e: React.PointerEvent) => {
    const startY = e.clientY;
    const startH = detailsH;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const h = Math.min(window.innerHeight - 160, Math.max(150, startH + (startY - ev.clientY)));
      setDetailsH(h);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const selectedRow = selIndex >= 0 ? rows[selIndex] : undefined;
  const totalH = rows.length * g.rowH + (data?.hasMore ? g.rowH * 2 : 0);

  return (
    <div className={cx('graph-app', settings?.density === 'compact' && 'compact', g.spacious && 'spacious')}>
      <ProgressBar show={loading || !!busy} />

      <header className="toolbar">
        <button className="select-btn" onClick={(e) => branchMenu(e.currentTarget)} title="Filter by branch">
          <Icon name={branch ? 'git-branch' : 'git-merge'} />
          <span className="select-label">{branch ?? 'All Branches'}</span>
          <Icon name="chevron-down" className="chev" />
        </button>

        <div className="segmented" role="tablist" aria-label="Scope">
          {(['all', 'local', 'remote'] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={scope === s && !branch}
              className={cx(scope === s && !branch && 'on')}
              onClick={() => {
                setBranch(undefined);
                setScope(s);
              }}
            >
              {s === 'all' ? 'All' : s === 'local' ? 'Local' : 'Remote'}
            </button>
          ))}
        </div>

        <div className="grow" />

        <div className={cx('search', q && 'has-value')}>
          <Icon name="search" />
          <input
            ref={searchRef}
            value={search}
            placeholder="Search commits…"
            spellCheck={false}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                jumpMatch(e.shiftKey ? -1 : 1);
              } else if (e.key === 'Escape') {
                setSearch('');
                listRef.current?.focus();
              }
            }}
          />
          {q ? (
            <>
              <span className="search-count mono">{matches.length ? `${matchIdx + 1}/${matches.length}` : '0'}</span>
              <IconButton icon="arrow-up" className="sm" title="Previous (Shift+Enter)" onClick={() => jumpMatch(-1)} disabled={!matches.length} />
              <IconButton icon="arrow-down" className="sm" title="Next (Enter)" onClick={() => jumpMatch(1)} disabled={!matches.length} />
              <IconButton icon="close" className="sm" title="Clear" onClick={() => setSearch('')} />
            </>
          ) : (
            <span className="kbd search-kbd">/</span>
          )}
        </div>

        <IconButton icon="list-flat" title="View options" onClick={(e) => viewMenu(e.currentTarget as HTMLElement)} />
        <IconButton icon="repo-fetch" title="Fetch from all remotes" className="accent" spin={busy === 'Fetch'} onClick={() => act('fetch')} />
        <IconButton icon="settings-gear" title="Settings" className={cx(showSettings && 'active')} onClick={() => setShowSettings(true)} />
      </header>

      <div className="graph-main">
        {error ? (
          <Empty icon="error" title="Could not load history">
            <p>{error}</p>
            <button className="btn btn-ghost" onClick={load}>
              <Icon name="refresh" /> Retry
            </button>
          </Empty>
        ) : data && !data.repoName ? (
          <Empty icon="source-control" title="No Git repository">
            <p>Open a folder that contains a Git repository.</p>
          </Empty>
        ) : data && rows.length === 0 ? (
          <Empty icon="git-commit" title="No commits yet">
            <p>Make your first commit from the Git sidebar.</p>
          </Empty>
        ) : (
          <div
            ref={listRef}
            className="graph-list"
            tabIndex={0}
            onScroll={onScroll}
            onKeyDown={onListKey}
            role="listbox"
            aria-label="Commits"
            aria-activedescendant={selected ? `row-${selIndex}` : undefined}
          >
            <div className="graph-inner" style={{ height: totalH, ['--graph-w' as string]: `${graphW}px`, ['--row-h' as string]: `${g.rowH}px` }}>
              {rows.slice(start, end).map((row, k) => {
                const i = start + k;
                const c = row.commit;
                const isSel = c.hash === selected;
                const dim = q && !matchSet.has(i);
                return (
                  <div
                    key={c.hash}
                    id={`row-${i}`}
                    role="option"
                    aria-selected={isSel}
                    className={cx('row', isSel && 'selected', dim && 'dim', row.isHead && 'head', row.uncommitted && 'uncommitted')}
                    style={{ top: i * g.rowH, ['--c' as string]: `var(--lane-${row.color})` }}
                    onClick={() => {
                      if (isSel) setShowDetails((s) => !s);
                      else openDetails(row);
                      listRef.current?.focus();
                    }}
                    onContextMenu={(e) => {
                      setSelected(c.hash);
                      menu.open(e, commitMenu(row));
                    }}
                  >
                    <div className="col-graph" />
                    <div className="col-subject">
                      {g.spacious && row.refs.length === 0 && <span className="refs" />}
                      {row.refs.length > 0 && (
                        <span className="refs">
                          {row.refs.slice(0, maxRefs).map((r) => (
                            <span
                              key={r.name}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (r.type !== 'tag' && !r.current) act('checkout', { ref: r.short, remote: r.type === 'remote' });
                              }}
                            >
                              <RefBadge
                                r={r}
                                color={row.color}
                                onContextMenu={(e) => {
                                  e.stopPropagation();
                                  menu.open(e, refMenu(r));
                                }}
                              />
                            </span>
                          ))}
                          {row.refs.length > maxRefs && (
                            <span className="ref more" title={row.refs.slice(maxRefs).map((r) => r.short).join('\n')}>
                              +{row.refs.length - maxRefs}
                            </span>
                          )}
                        </span>
                      )}
                      <span className={cx('subject', row.uncommitted && 'italic')} title={c.subject}>
                        {row.uncommitted ? 'Uncommitted changes' : c.subject}
                      </span>
                    </div>
                    {!row.uncommitted && (
                      <>
                        <div className="col-hash mono">{c.hash.slice(0, 7)}</div>
                        <div className="col-date mono" {...dateHoverProps(c.date)}>
                          {timeAgo(c.date)}
                        </div>
                        <div className="col-avatar">
                          <Avatar name={c.author} email={c.email} size={g.spacious ? 30 : g.rowH > 30 ? 24 : 20} />
                        </div>
                      </>
                    )}
                    {row.uncommitted && (
                      <div className="col-wip">
                        <span className="wip-pill">
                          <Icon name="edit" /> WIP
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              <GraphCanvas rows={rows} start={start} end={end} g={g} width={graphW} selected={selected} />
              {data?.hasMore && (
                <div className="load-more" style={{ top: rows.length * g.rowH }}>
                  <Icon name="loading" className="spin" /> Loading more commits…
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showDetails && selected && (
        <>
          <div className="splitter" onPointerDown={onDragStart} role="separator" aria-orientation="horizontal" title="Drag to resize" />
          <div className="details-wrap" style={{ height: detailsH }}>
            <CommitDetails
              hash={selected}
              version={version}
              laneColor={selectedRow?.color ?? 0}
              onClose={() => {
                setShowDetails(false);
                listRef.current?.focus();
              }}
              onSelect={selectHash}
            />
          </div>
        </>
      )}

      {busy && (
        <div className="toast" role="status">
          <Icon name="loading" className="spin" /> {busy}…
        </div>
      )}
      {menu.node}
      {showSettings && (
        <SettingsModal
          onClose={() => {
            setShowSettings(false);
            listRef.current?.focus();
          }}
        />
      )}
      <DateCardHost />
      <AuthorCardHost onShowCommits={(a) => setSearch(a.email || a.name)} />
    </div>
  );
}
