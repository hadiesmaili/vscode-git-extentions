# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.7.5] - 2026-11-28

### Added
- Source Control view: Git Graph button in the title bar, next to the commit input.

### Changed
- Calendar options use formal names: Gregorian, Solar Hijri, Lunar Hijri. Gregorian stays the default.
- Sidebar branch button: the chevron points right, toward the branch picker.
- Sidebar header shows only "Git Workspace".

## [0.7.4] - 2026-11-26

### Added
- About page: Telegram contact card (@he_tlg).

### Changed
- Calendar options in settings use English names: Miladi, Shamsi, Ghamari.

## [0.7.3] - 2026-11-26

### Added
- Commit context menu: merge into current branch, rebase current branch onto commit, compare with working tree, show details, copy short hash.

### Changed
- All numbers (hashes, counts, diff stats, date card ISO and timestamp chips) use the soft number font.

## [0.7.2] - 2026-11-26

### Changed
- Softer number typography: commit dates, section counts and the date card clock use the UI font with tabular digits instead of the monospace font, with a smooth fallback for Persian digits. Commit hashes stay monospace.

## [0.7.1] - 2026-11-26

### Fixed
- Settings modal: in a short window the **About** button was squeezed and its label sat at the bottom edge. Tab buttons no longer shrink, and About now sits in its own footer under the scrolling tab list.

## [0.7.0] - 2026-11-26

### Added
- `gitWorkspace.dateFormat` setting: show commit dates in the list as relative time ("56m ago", default) or as date and time in the selected calendar. Set it in Settings → Graph & Dates.
- A ✏️ button on the date card opens Settings directly on **Graph & Dates**.

### Changed
- The date card shows only the date and time (relative time, full date, clock, time zone, ISO and Unix). The calendar tabs and the list of other calendars were removed; the calendar is chosen in Settings.

## [0.6.1] - 2026-11-26

### Fixed
- Collapsing **Changes** or **Staged Changes** crashed the sidebar with "Something went wrong: o is not a function". A React effect returned the value of VS Code's `setState`, and React then called that value as the effect's cleanup function. The VS Code API is now wrapped so `setState` never returns a value, and all effects use block bodies.

### Changed
- An empty **Staged Changes** section stays visible and says "Nothing staged" instead of disappearing.

## [0.6.0] - 2026-11-26

### Added
- Sidebar tree view: toggle between a flat list and a folder tree. Single-child folders are compressed, folders collapse, and you can stage, unstage or discard a whole folder.

### Changed
- File rows under **Changes** and **Staged Changes** are indented, with a guide line, so they clearly belong to their section.
- **Discard all** moved from the section header into a `…` menu.

### Fixed
- Clicking a section header could hit the hidden **Discard all** button and open a discard warning instead of collapsing the section. The header now only collapses.

## [0.5.0] - 2026-11-26

### Added
- Graph color palettes: Vivid (default), Pastel, Neon, Ocean, Sunset and Graphite, chosen in Settings → Appearance with a live preview.
- Palettes are darkened automatically on light themes.
- Automated GitHub releases: pushing a `vX.Y.Z` tag builds the `.vsix` and publishes it.

## [0.4.0] - 2026-11-26

### Added
- Settings modal (⚙ next to Fetch) with side tabs: Appearance, Graph & Dates, Avatars, Inline Blame, Features and About.
- Day (light) theme alongside Night and Follow VS Code.

### Changed
- Theme changes apply live without reloading the view.

## [0.3.1] - 2026-11-26

### Changed
- Removed the author column from the commit list; the avatar and its hover card show the author.
- In Spacious density, branch badges wrap onto two lines, and extra refs collapse into a `+N` badge.

## [0.3.0] - 2026-11-26

### Added
- Date hover card: relative and full time, time zone, Gregorian / Solar Hijri (Shamsi) / Lunar Hijri (Qamari) calendars, and copyable ISO 8601 and Unix values.
- `gitWorkspace.calendar` setting.

## [0.2.0] - 2026-11-26

### Added
- Author hover card with commit count, first and last activity, and aliases.
- Custom avatars per author email, plus optional Gravatar (off by default).
- Spacious row density with large ring nodes and a separate branch column.

### Fixed
- The sidebar shows the error with a **Reset view** button instead of going blank.
- Refresh now reloads the sidebar view.

## 0.1.0 - 2026-11-26 (internal build)

### Added
- Git Graph with lanes, refs, search, filters, commit details and context menus.
- Source Control sidebar: stage, discard, commit, amend and sync.
- Inline blame on the current line.

[0.7.2]: https://github.com/hadiesmaili/vscode-git-extentions/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/hadiesmaili/vscode-git-extentions/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/hadiesmaili/vscode-git-extentions/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/hadiesmaili/vscode-git-extentions/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/hadiesmaili/vscode-git-extentions/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/hadiesmaili/vscode-git-extentions/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/hadiesmaili/vscode-git-extentions/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/hadiesmaili/vscode-git-extentions/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/hadiesmaili/vscode-git-extentions/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/hadiesmaili/vscode-git-extentions/commits/v0.2.0
