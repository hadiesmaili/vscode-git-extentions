/** Lets any component (e.g. a hover card) ask the view to open the settings modal on a tab. */
export type SettingsTab = 'appearance' | 'graph' | 'avatars' | 'blame' | 'features' | 'about';

const listeners = new Set<(tab: SettingsTab) => void>();

export function openSettingsModal(tab: SettingsTab = 'appearance'): void {
  listeners.forEach((l) => l(tab));
}

export function onOpenSettings(l: (tab: SettingsTab) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
