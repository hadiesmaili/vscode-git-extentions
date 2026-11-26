import type { Theme } from '../../shared/protocol';

/** Switches the palette live; CSS keys off body[data-theme]. */
export function applyTheme(theme: Theme): void {
  if (document.body.dataset.theme !== theme) document.body.dataset.theme = theme;
}
