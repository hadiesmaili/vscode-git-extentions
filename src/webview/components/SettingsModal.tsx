import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Config, SettingKey } from '../../shared/protocol';
import { CALENDARS, compactDateTime, longDate } from '../lib/dates';
import type { SettingsTab } from '../lib/settingsBus';
import { PALETTES } from '../lib/palette';
import { act, call, onEvent } from '../lib/rpc';
import { cx, timeAgo } from '../lib/util';
import { Avatar, Icon, IconButton } from './ui';

type Tab = SettingsTab;

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'appearance', label: 'Appearance', icon: 'symbol-color' },
  { id: 'graph', label: 'Graph & Dates', icon: 'git-merge' },
  { id: 'avatars', label: 'Avatars', icon: 'account' },
  { id: 'blame', label: 'Inline Blame', icon: 'eye' },
  { id: 'features', label: 'Features', icon: 'extensions' },
  { id: 'about', label: 'About', icon: 'info' },
];

const isMac = navigator.platform.toLowerCase().includes('mac');

export function SettingsModal({ onClose, initialTab = 'appearance' }: { onClose: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [cfg, setCfg] = useState<Config | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    call('getConfig').then(setCfg).catch(() => undefined);
  }, []);

  useEffect(() => {
    reload();
    return onEvent((e) => {
      if (e.name === 'settingsChanged' || e.name === 'avatarsChanged') reload();
    });
  }, [reload]);

  useEffect(() => {
    dialogRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);

  const set = (key: SettingKey, value: unknown) => {
    // Optimistic: reflect immediately, the host confirms with settingsChanged.
    setCfg((c) => (c ? { ...c, ...patchFor(key, value) } : c));
    act('updateSetting', { key, value });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label="Settings" tabIndex={-1}>
        <nav className="modal-nav" aria-label="Settings sections">
          <div className="modal-brand">
            <span className="brand-mark">
              <Icon name="git-merge" />
            </span>
            <div>
              <div className="brand-name">Git Workspace</div>
              <div className="brand-sub">Settings</div>
            </div>
          </div>
          <div className="nav-items" role="tablist" aria-orientation="vertical">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={cx('nav-item', tab === t.id && 'on', t.id === 'about' && 'about')}
                onClick={() => setTab(t.id)}
              >
                <Icon name={t.icon} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <section className="modal-content" role="tabpanel">
          <header className="modal-head">
            <h2>{TABS.find((t) => t.id === tab)!.label}</h2>
            <IconButton icon="close" title="Close (Esc)" onClick={onClose} />
          </header>
          <div className="modal-body">{cfg ? <Panel tab={tab} cfg={cfg} set={set} /> : <div className="muted">Loading…</div>}</div>
          <footer className="modal-foot">
            <button className="link-btn" onClick={() => act('openSettings')}>
              <Icon name="settings-gear" /> Open in VS Code Settings
            </button>
            <span className="muted">Changes apply instantly</span>
          </footer>
        </section>
      </div>
    </div>
  );
}

function patchFor(key: SettingKey, value: unknown): Partial<Config> {
  const map: Record<SettingKey, keyof Config> = {
    theme: 'theme',
    'graph.density': 'density',
    'graph.pageSize': 'pageSize',
    'graph.palette': 'palette',
    calendar: 'calendar',
    dateFormat: 'dateFormat',
    'avatars.gravatar': 'gravatar',
    'inlineBlame.enabled': 'blameEnabled',
    'inlineBlame.format': 'blameFormat',
    'inlineBlame.delay': 'blameDelay',
  };
  return { [map[key]]: value } as Partial<Config>;
}

type Set = (key: SettingKey, value: unknown) => void;

function Panel({ tab, cfg, set }: { tab: Tab; cfg: Config; set: Set }) {
  switch (tab) {
    case 'appearance':
      return <Appearance cfg={cfg} set={set} />;
    case 'graph':
      return <GraphTab cfg={cfg} set={set} />;
    case 'avatars':
      return <Avatars cfg={cfg} set={set} />;
    case 'blame':
      return <Blame cfg={cfg} set={set} />;
    case 'features':
      return <Features cfg={cfg} set={set} />;
    case 'about':
      return <About cfg={cfg} />;
  }
}

// ---------------- building blocks ----------------

function Row({ title, desc, children, stack }: { title: string; desc?: ReactNode; children: ReactNode; stack?: boolean }) {
  return (
    <div className={cx('set-row', stack && 'stack')}>
      <div className="set-text">
        <div className="set-title">{title}</div>
        {desc && <div className="set-desc">{desc}</div>}
      </div>
      <div className="set-control">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={cx('switch', on && 'on')} onClick={() => onChange(!on)}>
      <span className="knob" />
    </button>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} className={cx(value === o.id && 'on')} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Text/number input that commits on blur or Enter. */
function Field({ value, onCommit, type = 'text', min, max, width }: { value: string | number; onCommit: (v: string) => void; type?: 'text' | 'number'; min?: number; max?: number; width?: number }) {
  const [v, setV] = useState(String(value));
  useEffect(() => {
    setV(String(value));
  }, [value]);
  const commit = () => v !== String(value) && onCommit(v);
  return (
    <input
      className="field mono"
      type={type}
      value={v}
      min={min}
      max={max}
      style={{ width }}
      spellCheck={false}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

/** Tiny three-lane graph drawn with the palette's first colors. */
function PalettePreview({ colors }: { colors: string[] }) {
  const [a, b, c] = colors;
  return (
    <svg className="palette-preview" viewBox="0 0 120 54" aria-hidden>
      <path d="M20 4V50" stroke={a} strokeWidth={2.4} fill="none" />
      <path d="M20 14C20 22 42 18 42 26V34C42 42 20 38 20 46" stroke={b} strokeWidth={2.4} fill="none" />
      <path d="M20 8C20 14 64 10 64 18V30" stroke={c} strokeWidth={2.4} fill="none" opacity={0.95} />
      <circle cx={20} cy={8} r={4.5} fill="var(--bg)" stroke={a} strokeWidth={2.4} />
      <circle cx={42} cy={26} r={4} fill="var(--bg)" stroke={b} strokeWidth={2.2} />
      <circle cx={64} cy={30} r={4} fill="var(--bg)" stroke={c} strokeWidth={2.2} />
      <circle cx={20} cy={46} r={4} fill="var(--bg)" stroke={a} strokeWidth={2.2} />
      <rect x={76} y={6} width={36} height={6} rx={3} fill={a} opacity={0.35} />
      <rect x={76} y={23} width={30} height={6} rx={3} fill={b} opacity={0.35} />
      <rect x={76} y={40} width={34} height={6} rx={3} fill={c} opacity={0.35} />
    </svg>
  );
}

// ---------------- tabs ----------------

function Appearance({ cfg, set }: { cfg: Config; set: Set }) {
  const themes = [
    { id: 'brand', label: 'Night', desc: 'Obsidian dark from the design', icon: 'color-mode' },
    { id: 'light', label: 'Day', desc: 'Light version of the design', icon: 'lightbulb' },
    { id: 'auto', label: 'Follow VS Code', desc: 'Use the active editor theme', icon: 'vscode' },
  ] as const;
  return (
    <>
      <Row title="Theme" desc="Applies to the Git Graph and the sidebar." stack>
        <div className="theme-cards">
          {themes.map((t) => (
            <button key={t.id} className={cx('theme-card', cfg.theme === t.id && 'on')} onClick={() => set('theme', t.id)} aria-pressed={cfg.theme === t.id}>
              <span className={cx('theme-preview', `tp-${t.id}`)}>
                <span className="tp-line l1" />
                <span className="tp-line l2" />
                <span className="tp-dot d1" />
                <span className="tp-dot d2" />
                <span className="tp-bar" />
              </span>
              <span className="theme-label">
                <Icon name={t.icon} /> {t.label}
                {cfg.theme === t.id && <Icon name="pass-filled" className="theme-check" />}
              </span>
              <span className="theme-desc">{t.desc}</span>
            </button>
          ))}
        </div>
      </Row>
      <Row title="Graph colors" desc="Colors of branch lanes, badges and nodes. Darkened automatically on light themes." stack>
        <div className="palette-cards">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              className={cx('palette-card', cfg.palette === p.id && 'on')}
              aria-pressed={cfg.palette === p.id}
              onClick={() => set('graph.palette', p.id)}
            >
              <PalettePreview colors={p.colors} />
              <span className="theme-label">
                {p.label}
                {cfg.palette === p.id && <Icon name="pass-filled" className="theme-check" />}
              </span>
              <span className="swatches">
                {p.colors.map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </span>
              <span className="theme-desc">{p.desc}</span>
            </button>
          ))}
        </div>
      </Row>
      <Row title="Row density" desc="Spacious shows large nodes and a branch column, like the design.">
        <Seg
          value={cfg.density}
          options={[
            { id: 'compact', label: 'Compact' },
            { id: 'comfortable', label: 'Comfortable' },
            { id: 'spacious', label: 'Spacious' },
          ]}
          onChange={(v) => set('graph.density', v)}
        />
      </Row>
    </>
  );
}

function GraphTab({ cfg, set }: { cfg: Config; set: Set }) {
  const now = Math.floor(Date.now() / 1000);
  return (
    <>
      <Row title="Calendar" desc={<span dir="auto">Today: {longDate(now, cfg.calendar)}</span>}>
        <Seg value={cfg.calendar} options={CALENDARS.map((c) => ({ id: c.id, label: c.native }))} onChange={(v) => set('calendar', v)} />
      </Row>
      <Row title="Date in commit list" desc={<>Example: <span className="mono" dir="auto">{cfg.dateFormat === 'absolute' ? compactDateTime(now - 3360, cfg.calendar) : '56m ago'}</span></>}>
        <Seg
          value={cfg.dateFormat}
          options={[
            { id: 'relative', label: 'Relative' },
            { id: 'absolute', label: 'Date & time' },
          ]}
          onChange={(v) => set('dateFormat', v)}
        />
      </Row>
      <Row title="Commits per page" desc="Loaded at once; more load while you scroll (50–5000).">
        <Field
          type="number"
          min={50}
          max={5000}
          width={90}
          value={cfg.pageSize}
          onCommit={(v) => {
            const n = Math.round(Number(v));
            if (n >= 50 && n <= 5000) set('graph.pageSize', n);
          }}
        />
      </Row>
    </>
  );
}

function Avatars({ cfg, set }: { cfg: Config; set: Set }) {
  return (
    <>
      <Row
        title="Load avatars from Gravatar"
        desc={
          <>
            <Icon name="shield" className="inline-icon warn" /> Sends a hash of each author email to gravatar.com. Custom avatars always win.
          </>
        }
      >
        <Toggle on={cfg.gravatar} label="Gravatar" onChange={(v) => set('avatars.gravatar', v)} />
      </Row>
      <Row title="Custom avatars" desc="Set one from an author's hover card in the Git Graph." stack>
        {cfg.customAvatars.length === 0 ? (
          <div className="set-empty">
            <Icon name="account" /> No custom avatars yet.
          </div>
        ) : (
          <ul className="avatar-list">
            {cfg.customAvatars.map((email) => (
              <li key={email}>
                <Avatar name={email} email={email} size={28} card={false} />
                <span className="mono">{email}</span>
                <span className="grow" />
                <IconButton icon="device-camera" title="Change" className="sm" onClick={() => act('setAvatar', { name: email, email })} />
                <IconButton icon="trash" title="Remove" className="sm" onClick={() => act('removeAvatar', { email })} />
              </li>
            ))}
          </ul>
        )}
      </Row>
    </>
  );
}

function Blame({ cfg, set }: { cfg: Config; set: Set }) {
  const sample = { author: 'Hadi Esmaeili', timeAgo: timeAgo(Date.now() / 1000 - 7200, false), summary: 'feat: new UI', hash: 'a1b2c3d', date: new Date().toLocaleDateString() };
  const preview = cfg.blameFormat.replace(/\$\{(\w+)\}/g, (_, k: string) => (sample as Record<string, string>)[k] ?? '');
  return (
    <>
      <Row title="Show inline blame" desc="Faint author and commit at the end of the current line.">
        <Toggle on={cfg.blameEnabled} label="Inline blame" onChange={(v) => set('inlineBlame.enabled', v)} />
      </Row>
      <Row title="Format" desc={<>Variables: <code>${'{author}'}</code> <code>${'{timeAgo}'}</code> <code>${'{summary}'}</code> <code>${'{hash}'}</code> <code>${'{date}'}</code></>} stack>
        <Field value={cfg.blameFormat} onCommit={(v) => set('inlineBlame.format', v)} />
        <div className={cx('blame-preview mono', !cfg.blameEnabled && 'off')}>
          <span className="code">const [isOpen, setIsOpen] = useState(true);</span>
          <span className="ghost">{preview}</span>
        </div>
      </Row>
      <Row title="Delay" desc="Milliseconds before the blame appears (0–2000).">
        <Field
          type="number"
          min={0}
          max={2000}
          width={90}
          value={cfg.blameDelay}
          onCommit={(v) => {
            const n = Math.round(Number(v));
            if (n >= 0 && n <= 2000) set('inlineBlame.delay', n);
          }}
        />
      </Row>
    </>
  );
}

function Features({ cfg, set }: { cfg: Config; set: Set }) {
  const mod = isMac ? '⌘' : 'Ctrl';
  const items = [
    { icon: 'git-merge', title: 'Git Graph', desc: 'Branch topology, search, context menus, commit details and diffs.', kbd: `${mod}+Alt+G`, action: { label: 'Open', run: () => act('openGraph', {}) } },
    { icon: 'source-control', title: 'Source Control sidebar', desc: 'Stage, discard, commit, amend, sync and switch branches.' },
    { icon: 'eye', title: 'Inline blame', desc: 'Author and commit at the end of the current line, with a hover.', toggle: { on: cfg.blameEnabled, key: 'inlineBlame.enabled' as const } },
    { icon: 'account', title: 'Author cards', desc: 'Hover an avatar: commits, first/last activity, custom avatar.' },
    { icon: 'calendar', title: 'Date cards', desc: 'Hover a date: full time, time zone, Gregorian / Shamsi / Qamari.' },
    { icon: 'shield', title: 'Safe operations', desc: 'Reset hard, discard, delete and rebase always ask first.' },
  ];
  return (
    <div className="feature-grid">
      {items.map((f) => (
        <div key={f.title} className="feature">
          <span className="feature-icon">
            <Icon name={f.icon} />
          </span>
          <div className="feature-text">
            <div className="feature-title">
              {f.title}
              {f.kbd && <span className="kbd">{f.kbd}</span>}
            </div>
            <div className="feature-desc">{f.desc}</div>
          </div>
          {f.toggle && <Toggle on={f.toggle.on} label={f.title} onChange={(v) => set(f.toggle!.key, v)} />}
          {f.action && (
            <button className="btn btn-ghost" onClick={f.action.run}>
              {f.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function About({ cfg }: { cfg: Config }) {
  return (
    <div className="about">
      <div className="about-hero">
        <span className="about-logo">
          <Icon name="git-merge" />
        </span>
        <div>
          <h3>Git Workspace</h3>
          <p className="muted">Modern Git graph, source control and blame for VS Code.</p>
          <div className="about-tags">
            <span className="chip mono">v{cfg.version}</span>
            <span className="chip mono ghost">VS Code {cfg.vscodeVersion}</span>
            {cfg.repoName && (
              <span className="chip mono ghost">
                <Icon name="repo" /> {cfg.repoName}
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="about-text">
        Git Workspace lets you do your daily Git work without a terminal. It reads and writes through the Git CLI, uses VS Code's own diff
        editor, and keeps your data local: avatars are initials or images you choose, unless you turn on Gravatar.
      </p>
      <dl className="about-meta">
        <dt>Built with</dt>
        <dd>TypeScript · React · esbuild · Codicons</dd>
        <dt>Design</dt>
        <dd>Obsidian Git Graph design system</dd>
        <dt>License</dt>
        <dd>MIT</dd>
      </dl>
    </div>
  );
}
