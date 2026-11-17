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

## Board themes (2026-11-13)
- Settings tab has a **Theme** button (top of the tab) opening the Theme dialog (`#themeWrapper`): the Light mode and
  Colour pieces by type switches, then one
  button per theme with a light and a dark example square drawn in that theme.
- Themes: `classic` (the look before PRs #8/#9: grey squares, White in outline symbols) and `pillbox` (PRs #8/#9:
  brown squares, filled symbols on rounded boxes filling the square; the bishop underline was removed 2026-11-17).
  Default `pillbox`.
- A theme is only CSS variables (style.css 1.1), under `[data-board-theme=…]`, plus a light block. The attribute is
  on `<html>`; each dialog preview carries its own, so every theme must set every variable (see the list there).
- Piece symbols are drawn by CSS `::before` (glyph spans are empty), so a theme can choose White's symbols.
- "Colour pieces by type" off is applied on `.glyph-w/-b` themselves (not as variables on body) so previews get
  their own theme's colours.
- Theme list: `src/client/themes.js`. Setting: `theme` in settings.js, a "choices" setting (buttons with
  `data-value`) beside the boolean switches; remembered in localStorage, reset by Reset to defaults.

## Theme generator, custom theme (2026-11-18)
- `tools/theme-generator.html`: standalone page (works from file:// or the server). A picker + hex field + lock per
  board colour (squares, border, boxes, 12 piece colours, 2 side colours, 4 highlights), a preview that repeats the
  board CSS of style.css 7.1-7.4 (keep in step if those change), contrast numbers per colour, Generate (best of up
  to 400 random candidates scored against contrast targets; locked colours kept, others fitted to them; highlight
  hues kept to their meanings: check red, moves green, attacker blue-violet, side-to-move elsewhere), and Export
  (downloads custom.css). Remembers its state in localStorage `qhess.themeGenerator`.
- Its preview fits the window without scrolling (the pickers scroll): the preview is a size container and the square
  size comes from measured layout constants (in its CSS comment), with the 14 square states 7 or 5 to a row by the
  container's aspect ratio. Below 760px wide it stacks and scrolls instead.
- The game links `themes/custom.css` (committed as an empty placeholder). themes.js lists a `custom` theme when that
  file sets `--custom-theme-name`. One palette for both modes. The server's PUBLIC list includes themes/ and tools/.
- style.css 1.0 now holds the board colours (pieces, highlights, square border) on `:root, :where([data-board-theme])`
  (+ light), so each dialog preview resets to the built-in colours and a custom theme only colours its own preview.

## Board highlight colour (2026-11-17)
- `--piece-selectedStart-col` (side-to-move ring, hover, chosen start) is cyan `#3fd6e8` in dark mode and teal
  `#0b8a9e` in light (was dark amber, lost on the brown Pillbox board). The rings are inset box-shadows, painted
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
