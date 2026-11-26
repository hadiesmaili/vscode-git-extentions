---
name: Obsidian Git Graph
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1b1b1d'
  surface-container: '#201f21'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#303032'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00a572'
  on-tertiary-container: '#00311f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
  code-xs:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '500'
    lineHeight: 1rem
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.01em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '500'
    lineHeight: 0.875rem
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.375rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
---

## Brand & Style
The design system embodies precision engineering, high-density situational awareness, and technical sophistication tailored specifically for modern software engineers operating within an IDE environment. It delivers frictionless visual clarity across intricate Git topologies, diffs, and staging workflows.

The visual style is **Technical Minimalist with Layered Graphite Surfaces and Glass Accents**. It leverages matte obsidian finishes, micro-borders with refined translucency, and luminous neon-chromatic semantic markers to maximize information scanability without cognitive fatigue during prolonged coding sessions.

## Colors
The palette is built upon a hierarchy of deep charcoal and matte obsidian surfaces, structured to integrate natively within high-end dark IDE themes. Accent colors provide surgical functional contrast for Git semantics and topology branch paths.

### Surface Tiers
- **Canvas / Root Background:** `#09090B` (Deep Void)
- **Base Surface:** `#121214` (Matte Obsidian)
- **Elevated Layer / Panel Surface:** `#18181B` (Graphite)
- **Overlay / Modal / Float:** `#27272A` at 85% opacity with 16px background blur.
- **Micro-Border Subtle:** `rgba(255, 255, 255, 0.08)` (Active divider: `#3F3F46`)

### Semantic & Git Topology Accents
- **Primary Violet:** `#8B5CF6` (Focus rings, primary interactions, head commit nodes)
- **Indigo Secondary:** `#6366F1` (Active branch badges, secondary selections)
- **Diff Additions / Staged / Clean:** `#10B981` (Bright mint accent: `#34D399`)
- **Diff Modifications / Divergence / Warning:** `#F59E0B` (Amber)
- **Diff Deletions / Conflicts / Destructive:** `#EF4444` (Muted crimson: `#F87171`)
- **Topology Branch Lanes:** 5 distinct categorical channels:
  1. Lane 0 (Main/Default): `#8B5CF6` (Violet)
  2. Lane 1 (Feature): `#10B981` (Mint)
  3. Lane 2 (Release/Integration): `#38BDF8` (Sky)
  4. Lane 3 (Fix/Staging): `#F59E0B` (Amber)
  5. Lane 4 (Experimental): `#F43F5E` (Rose)

## Typography
Typography is tuned for high-density information layout within limited IDE window viewports. 

`Inter` governs structural UI controls, commit subject lines, and author metadata for effortless legibility at compact sizes. `JetBrains Mono` governs all Git technical artefacts: SHA hashes, branch refs, hunk line indicators, and inline diff snippets. Tabular figures are enforced for all monospace elements to ensure vertical alignment down commit columns.

## Layout & Spacing
The layout adheres to a high-density compact scale. In VS Code webview extensions, space conservation is paramount: default row heights in the graph table are locked to 28px–32px, maximizing the number of visible commits.

- **Layout Structure:** Multi-pane fluid split view. Left side hosts the SVG graph rendering and commit rows; right/bottom collapsible drawer hosts the inspector, commit detail metadata, and side-by-side or unified diff previews.
- **Row Grid:** Fixed virtualized row height of `1.75rem` (28px) for high throughput scrolling.
- **Responsive Adaptations:** 
  - *Narrow Viewport (< 600px):* Inspector collapses into an overlay drawer. Commit table truncates author and date, showing only commit graph nodes, short SHA, and commit message.
  - *Standard Viewport (600px–1100px):* Dual-pane split with horizontal scroll preservation for SVG graph lanes.
  - *Wide Viewport (> 1100px):* Full metadata visualization with pinned sidecar diff viewer and multi-branch comparison columns.

## Elevation & Depth
Depth avoids simulated heavy drop-shadows, which look out of place inside IDE frames. Visual hierarchy is achieved via surface tonal shifts, high-precision micro-borders, and targeted glassmorphism:

- **Surface Level 0 (Base Graph Canvas):** Solid `#09090B`. Flat, zero shadow.
- **Surface Level 1 (Hovered Commit Row):** `#18181B` with an inset `1px` subtle highlight border `rgba(255, 255, 255, 0.05)`.
- **Surface Level 2 (Selected Commit / Context Menus):** `#1F1F23` with a distinct `1px` border of `rgba(139, 92, 246, 0.35)`.
- **Surface Level 3 (Floating Detail Inspector & Tooltips):** Background tinted `#18181B` at 80% opacity, layered with `backdrop-filter: blur(12px)` and a crisp outer border of `rgba(255, 255, 255, 0.1)`. A low-spread ambient glow of `0 8px 24px rgba(0, 0, 0, 0.5)` grounds the floating inspector above the dense graph tracks.

## Shapes
Shapes balance modern softness with compact technical structure. Standard container elements utilize a `0.5rem` (8px) radius, preventing visual clutter when elements sit adjacent to one another. 

- **Graph Nodes:** Perfect circles (`50%` radius), 8px outer diameter with 2px stroke, hollow for uncommitted changes and solid for head/pushed nodes.
- **Badges & Tags (Branch Refs, PR badges):** Subtle rounded capsules (`4px` / `0.25rem`) that tightly frame text labels without excessive vertical padding.
- **Context Menus & Flyout Inspectors:** Standard `0.5rem` (8px) to `0.75rem` (12px) corners.

## Components

### Buttons
- **Primary (Action/Sync/Cherry-pick):** Background `#7C3AED`, text `#FFFFFF`, font `Inter` 12px weight 500. Height 28px, padding `0 10px`, radius 6px. Hover: `#8B5CF6`. Active state scales to 0.98. Focus: `2px` ring `#8B5CF6` with `2px` offset `#09090B`.
- **Secondary / Ghost (Checkout/Stash/Filter):** Background `rgba(255, 255, 255, 0.04)`, border `1px solid rgba(255, 255, 255, 0.08)`, text `#A1A1AA`. Hover: Background `rgba(255, 255, 255, 0.08)`, text `#FAFAFA`.

### Badges & Branch Refs
- **Head Branch:** Background `rgba(139, 92, 246, 0.15)`, text `#C4B5FD`, border `1px solid rgba(139, 92, 246, 0.4)`. Uses `JetBrains Mono` 11px.
- **Remote Ref:** Background `rgba(99, 102, 241, 0.12)`, text `#A5B4FC`, border `1px solid rgba(99, 102, 241, 0.3)`.
- **Tag:** Background `rgba(245, 158, 11, 0.12)`, text `#FCD34D`, border `1px solid rgba(245, 158, 11, 0.3)`.

### Input Fields & Search Bars
- Background `#121214`, border `1px solid rgba(255, 255, 255, 0.1)`, radius 6px, height 26px, padding `0 8px`.
- Text `JetBrains Mono` 12px, placeholder color `#52525B`.
- Focus state replaces border with `#8B5CF6` and renders a 2px subtle glow `rgba(139, 92, 246, 0.2)`.

### Commit Graph Rows
- Height fixed at 28px. Alternating row fills are avoided; visual separation relies solely on hover fills (`#18181B`).
- **Active / Selected Row:** Background `rgba(139, 92, 246, 0.12)` with a solid 2px vertical indicator bar on the left edge (`#8B5CF6`).

### Inline Diff Gutter Counters
- **Additions Indicator:** Text `#34D399`, background `rgba(16, 185, 129, 0.1)`, radius 3px, padding `1px 4px`.
- **Deletions Indicator:** Text `#F87171`, background `rgba(239, 68, 68, 0.1)`, radius 3px, padding `1px 4px`.

### Checkboxes & Stage Controls
- Size 14x14px, radius 3px. Unchecked: `1px solid #3F3F46`, background `transparent`. Checked: background `#10B981`, checkmark icon white 10px.

### Floating Inspector Panel
- Anchored to the edge or floating beside the graph. Background `#18181B` at 85% opacity, backdrop blur 16px, border `1px solid rgba(255, 255, 255, 0.1)`, border-radius 10px, padding 12px. Contains author avatars (20px circular), relative timestamps, multi-parent SHA chips, and file change lists.