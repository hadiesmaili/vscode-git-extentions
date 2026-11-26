import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Ref } from '../../shared/protocol';
import { markBroken, useAvatarUrl } from '../lib/avatars';
import { cx, hueOf, initials } from '../lib/util';
import { authorHover } from './AuthorCard';

export function Icon({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  return <i className={cx('codicon', `codicon-${name}`, className)} style={style} aria-hidden />;
}

export function IconButton(props: {
  icon: string;
  title: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  disabled?: boolean;
  spin?: boolean;
}) {
  return (
    <button
      className={cx('icon-btn', props.className)}
      title={props.title}
      aria-label={props.title}
      disabled={props.disabled}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick?.(e);
      }}
    >
      <Icon name={props.icon} className={props.spin ? 'spin' : undefined} />
    </button>
  );
}

/**
 * Author avatar: custom image → Gravatar (if enabled) → initials.
 * With `card` (default) hovering opens the author card.
 */
export function Avatar({ name, email, size = 22, card = true }: { name: string; email?: string; size?: number; card?: boolean }) {
  const url = useAvatarUrl(email);
  const hover = card
    ? {
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => authorHover.enter(e.currentTarget, { name, email: email ?? '' }),
        onMouseLeave: () => authorHover.leave(),
      }
    : {};
  return (
    <span
      className={cx('avatar', url && 'has-img', card && 'hoverable')}
      aria-label={name}
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.4), ['--h' as string]: hueOf(email || name) }}
      {...hover}
    >
      {url ? <img src={url} alt="" draggable={false} onError={() => email && markBroken(email)} /> : initials(name)}
    </span>
  );
}

export function RefBadge({ r, color, onContextMenu }: { r: Ref; color?: number; onContextMenu?: (e: React.MouseEvent) => void }) {
  const icon = r.type === 'tag' ? 'tag' : r.type === 'remote' ? 'cloud' : 'git-branch';
  const style = r.type === 'tag' ? undefined : ({ ['--c' as string]: `var(--lane-${color ?? 0})` } as CSSProperties);
  return (
    <span
      className={cx('ref', r.type, r.current && 'current')}
      style={style}
      title={`${r.type === 'head' ? 'Branch' : r.type === 'remote' ? 'Remote branch' : 'Tag'}: ${r.short}${r.current ? ' (HEAD)' : ''}`}
      onContextMenu={onContextMenu}
    >
      <Icon name={icon} />
      <span>{r.short}</span>
    </span>
  );
}

// ---------------- Menu ----------------

export type MenuEntry =
  | { label: string; icon?: string; hint?: string; danger?: boolean; disabled?: boolean; run: () => void }
  | { separator: true }
  | { header: string };

export interface MenuState {
  x: number;
  y: number;
  items: MenuEntry[];
  alignRight?: boolean;
}

export function useMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const open = (e: { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuEntry[]) => {
    e.preventDefault?.();
    setMenu({ x: e.clientX, y: e.clientY, items });
  };
  const openAt = (el: HTMLElement, items: MenuEntry[], align: 'left' | 'right' = 'left') => {
    const r = el.getBoundingClientRect();
    setMenu({ x: align === 'left' ? r.left : r.right, y: r.bottom + 4, items, alignRight: align === 'right' });
  };
  const node = menu ? <Menu state={menu} onClose={() => setMenu(null)} /> : null;
  return { open, openAt, node, close: () => setMenu(null) };
}

function Menu({ state, onClose }: { state: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: state.x, top: state.y });
  const actionable = state.items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => 'run' in it && !it.disabled)
    .map(({ i }) => i);
  const [focus, setFocus] = useState(-1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = state.alignRight ? state.x - r.width : state.x;
    let top = state.y;
    if (left + r.width > window.innerWidth - 6) left = window.innerWidth - r.width - 6;
    if (top + r.height > window.innerHeight - 6) top = Math.max(6, state.y - r.height);
    setPos({ left: Math.max(6, left), top });
    el.focus();
  }, [state]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const blur = () => onClose();
    window.addEventListener('mousedown', down, true);
    window.addEventListener('blur', blur);
    window.addEventListener('resize', blur);
    return () => {
      window.removeEventListener('mousedown', down, true);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', blur);
    };
  }, [onClose]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const cur = actionable.indexOf(focus);
      const n = actionable.length;
      const next = e.key === 'ArrowDown' ? (cur + 1) % n : (cur - 1 + n) % n;
      setFocus(actionable[next]);
    } else if (e.key === 'Enter' && focus >= 0) {
      e.preventDefault();
      const it = state.items[focus];
      if ('run' in it) {
        onClose();
        it.run();
      }
    }
  };

  return (
    <div ref={ref} className="menu" style={pos} tabIndex={-1} role="menu" onKeyDown={onKey} onContextMenu={(e) => e.preventDefault()}>
      {state.items.map((it, i) => {
        if ('separator' in it) return <div key={i} className="menu-sep" />;
        if ('header' in it) return <div key={i} className="menu-label">{it.header}</div>;
        return (
          <button
            key={i}
            role="menuitem"
            className={cx('menu-item', it.danger && 'danger', focus === i && 'focused')}
            disabled={it.disabled}
            onMouseEnter={() => setFocus(i)}
            onClick={() => {
              onClose();
              it.run();
            }}
          >
            <Icon name={it.icon ?? 'blank'} />
            <span>{it.label}</span>
            {it.hint && <span className="hint">{it.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ show }: { show: boolean }) {
  return show ? <div className="progress-bar" role="progressbar" /> : null;
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} />
      </div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
