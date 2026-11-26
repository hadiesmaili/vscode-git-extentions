import type { Palette } from '../../shared/protocol';

/** Eight lane colors per palette, tuned for dark backgrounds. */
export const PALETTES: { id: Palette; label: string; desc: string; colors: string[] }[] = [
  { id: 'vivid', label: 'Vivid', desc: 'Default, from the design', colors: ['#818cf8', '#22d3ee', '#fb923c', '#4ade80', '#f472b6', '#facc15', '#a78bfa', '#2dd4bf'] },
  { id: 'pastel', label: 'Pastel', desc: 'Soft and calm', colors: ['#b4befe', '#94e2d5', '#fab387', '#a6e3a1', '#f5c2e7', '#f9e2af', '#cba6f7', '#89dceb'] },
  { id: 'neon', label: 'Neon', desc: 'Maximum contrast', colors: ['#7c4dff', '#00e5ff', '#ff9100', '#00e676', '#ff4081', '#ffea00', '#d500f9', '#1de9b6'] },
  { id: 'ocean', label: 'Ocean', desc: 'Blues and teals', colors: ['#60a5fa', '#2dd4bf', '#818cf8', '#38bdf8', '#5eead4', '#a5b4fc', '#22d3ee', '#93c5fd'] },
  { id: 'sunset', label: 'Sunset', desc: 'Warm oranges and pinks', colors: ['#fb923c', '#f472b6', '#facc15', '#fb7185', '#e879f9', '#fdba74', '#f9a8d4', '#fcd34d'] },
  { id: 'graphite', label: 'Graphite', desc: 'Monochrome, one accent', colors: ['#818cf8', '#a1a1aa', '#d4d4d8', '#71717a', '#c4c4cc', '#8b8b94', '#e4e4e7', '#9ca3af'] },
];

let current: Palette = 'vivid';

function isLight(): boolean {
  const t = document.body.dataset.theme;
  return t === 'light' || (t === 'auto' && document.body.classList.contains('vscode-light'));
}

/**
 * Sets --lane-0..7 on body. Vivid uses the stylesheet values (hand-tuned per theme);
 * other palettes are darkened automatically on light backgrounds.
 */
export function applyPalette(id: Palette = current): void {
  current = id;
  const style = document.body.style;
  const p = PALETTES.find((x) => x.id === id);
  for (let i = 0; i < 8; i++) {
    if (!p || id === 'vivid') style.removeProperty(`--lane-${i}`);
    else style.setProperty(`--lane-${i}`, isLight() ? `color-mix(in srgb, ${p.colors[i]} 72%, black)` : p.colors[i]);
  }
}

// VS Code toggles body.vscode-light/dark when the editor theme changes.
new MutationObserver(() => applyPalette()).observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });
