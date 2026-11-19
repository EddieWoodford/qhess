# Progress

Compact notes for whoever works on this next. Tests: `npm test` (node only; the browser UI has no automated tests,
check it with the `qhess` preview in `.claude/launch.json`).

## Surrender, and no Add PC on a known king (2026-11-13)
- Until a move is staged (clear / highlightPotentialMoves / showPartialMove), sideButton2 reads **Surrender**;
  it asks first (choice dialog), then submits a turn `{ resign: true }`. Not offered at Black's move 0.
- Engine: a resign turn sets `state.result = "resigned"`, writes the ply `12w. resigns`, and does not pass the turn,
  so (as with checkmate) the side to move lost. parseMoveText reads it back; server cleanMove and plainMove carry it.
- Add PC is hidden once the opponent has a collapsed (pure "K") king on the board: status-view `hasCollapsedKing`.
  UI only: the engine still accepts a PC on a known king, because example game records contain such PCs.

## Board themes: one file each in themes/ (2026-11-18)
- The Settings tab lists the themes under its switches (`.theme-section`, `#themeList`): one button per theme, with a
  light and a dark example square in that theme. No Theme dialog, and no Light mode or Colour pieces by type
  switches any more: both are part of a theme.
- A theme is a CSS file in `themes/` with one rule, `.qhess-theme { … }`, setting every variable listed in style.css
  1.1 (tests/node/themes.test.js checks), including `--theme-name` and `--theme-page: dark|light` (the page around
  the board). One colour per side = all six of a side's `--piece-*` the same.
- themes.js `loadThemes` (awaited at the top of main.js) fetches `themes/index.json`, then each file, and puts each
  rule under `[data-board-theme="{file name without .css}"]` in one <style>. The theme setting's choices are the
  loaded ids; its default follows the device: `light-distinct` / `dark-distinct`. Applying a theme sets
  data-board-theme and data-theme (page) on <html>, and keeps the page mode in localStorage `qhess.themePage` for
  index.html's early script.
- `themes/index.json` (sorted file names): GitHub Pages can't list a folder, so the list is a file. The local server
  answers /themes/index.json from the folder and rewrites the file when it differs (npm test does too, via the
  server test); a node test fails if the list doesn't match the folder. So: drop a file in, reload (local server),
  commit the file + index.json.
- Built-in themes: Dark Simple / Light Simple (the old Classic, one colour per side, White in outline) and
  Dark Distinct / Light Distinct (the old Pillbox, a colour per type, boxes). Old ids (classic, pillbox) fall back to
  the default.
- Piece symbols are drawn by CSS `::before` (glyph spans are empty), so a theme can choose White's symbols.

## Theme generator (2026-11-18)
- `tools/theme-generator.html`: standalone page (works from file:// or the server). A picker + hex field + lock per
  board colour (squares, border, boxes, 12 piece colours, 2 side colours, 4 highlights), a preview that repeats the
  board CSS of style.css 7.1-7.4 (keep in step if those change), contrast numbers per colour, Generate (best of up
  to 400 random candidates scored against contrast targets; locked colours kept, others fitted to them; highlight
  hues kept to their meanings: check red, moves green, attacker blue-violet, side-to-move elsewhere).
- Export writes a theme file (named from the theme name). Part of the theme: the style toggle, **Simple** (one
  colour per side, no boxes, White in outline, as Dark/Light Simple) or **Distinct** (a colour per type, filled
  symbols on boxes) - colour by type and boxes always go together, by the user's choice - and Light page ->
  `--theme-page`.
- The style decides what is checked and generated (`unusedGroups`): only exported colours are checked (the others
  dimmed); in Simple pieces and highlights are measured against both squares, both squares are made dark or both
  light, and the two side colours must differ (contrast 1.6, a score-only check).
- Import (button or drop a file): first value of each board colour variable, `--theme-name` (or the old
  `--custom-theme-name`) and `--theme-page`; Simple if the pieces are one colour per side, White is in outline or the
  boxes are transparent, else Distinct; transparent values are skipped. Keeps colours it doesn't find and the locks,
  and reports found / needed for that style. The Simple themes round-trip exactly (the Distinct ones differ only in
  --glyph-shadow, which export always writes as 1px 1px 3px #0008). State in localStorage `qhess.themeGenerator`.
- Its preview fits the window without scrolling (the pickers scroll): the preview is a size container and the square
  size comes from measured layout constants (in its CSS comment), with the 14 square states 7 or 5 to a row by the
  container's aspect ratio. Below 760px wide it stacks and scrolls instead.
- The server's PUBLIC list includes themes/ and tools/.

## Deploy: versioned scripts on GitHub Pages (2026-11-18)
- Pages sends `max-age=600` on every file, each cached on its own, so after a push a new index.html could run with an
  old cached module (seen: modals.js looking for the removed Theme button).
- `.github/workflows/pages.yml` (push to main): npm ci, npm test, copy the repo to `_site`, `node
  deploy/stamp-versions.js _site`, deploy. The stamp adds an import map to the deployed index.html sending every
  `src/**/*.js` to `?v=<sha256 prefix>` (Pages ignores the query), and stamps main.js's script tag and style.css.
  The repo's index.html is never stamped. Needs Settings > Pages > Source = "GitHub Actions" (the user's to set).
- Left: index.html itself can be up to 10 minutes stale (an old page may then fetch a newly changed module).
  Data (themes/*.css, index.json) is fetched with `cache: "no-store"`.

## Idea, not done: arrow move markers (2026-11-19)
- `tools/move-markers-mockup.html` (from the server) shows every theme's board with the move markers now (style.css
  7.3: green stripes, rings for knight hops) beside a proposal: a small green `>` per square pointing the direction
  of motion (rotated by the existing 1-16 bearing), a solid dot for a knight's landing, and captures in another
  colour (arrow/dot plus a thin ring, as the marker covers the piece). Markers are square ::before (dark edge) and
  ::after (colour) masked with SVG; no ring on non-captures.
- Capture colour would be a new theme variable `--piece-capture-col` (mockup: magenta `#ff4fd8` dark, `#c0137a`
  light; orange clashes with several themes' pieces, red means check). Needs: the theme files, REQUIRED in
  themes.test.js, the generator, and controller/board-view marking which destinations capture.
- The user asked to park it, not to build it yet.

## Board highlight colour (2026-11-17)
- `--piece-selectedStart-col` (side-to-move ring, hover, chosen start) is cyan `#3fd6e8` in the dark themes and teal
  `#0b8a9e` in the light ones (was dark amber, lost on the brown Pillbox board). The rings are inset box-shadows, painted
  under the pillbox boxes, so only the ~2px gap round the boxes shows them.

## Known, not fixed (from the review of PRs #8/#9)
- Pillbox: same symbol shapes for both sides, so with colours by type the sides are told apart mainly by the pill.
  Since 2026-11-17 the pills are solid and set per mode (dark: warm brown / navy behind the bright palette; light:
  ivory / cool grey behind the deep palette), every piece colour at least ~3.1:1 on its pill. In dark mode the sides
  differ mainly by hue: a lighter White pill drops White's blue and orange-red below 3:1. The user wants the pills
  alone to tell the sides apart (no rims or other extra markers).
- (Fixed 2026-11-17: pills overflowed squares. Piece divs are now a CSS grid filling the square (3x2 uncollapsed, 1
  cell collapsed) and each `.glyph` is a flex box filling its cell, so pillbox draws rounded rectangles that tile the
  square. `--uncollapsed-size` sets the uncollapsed symbol size per theme. waveHTML writes exactly six cells, an
  empty `<span>` for each impossible type: `&nbsp;` text merged into one grid cell and squeezed/shifted the rest.)
- The captured list marks a bishop's square colour (small swatch); the board no longer does.
