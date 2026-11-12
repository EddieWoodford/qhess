# Progress

Compact notes for whoever works on this next. Tests: `npm test` (node only; the browser UI has no automated tests,
check it with the `qhess` preview in `.claude/launch.json`).

## Board themes (2026-11-13)
- Settings tab has a **Theme** button opening the Theme dialog (`#themeWrapper`): the Light mode switch, then one
  button per theme with a light and a dark example square drawn in that theme.
- Themes: `classic` (the look before PRs #8/#9: grey squares, White in outline symbols) and `pillbox` (PRs #8/#9:
  brown squares, filled symbols on pills, bishops underlined). Default `pillbox`.
- A theme is only CSS variables (style.css 1.1), under `[data-board-theme=…]`, plus a light block. The attribute is
  on `<html>`; each dialog preview carries its own, so every theme must set every variable (see the list there).
- Piece symbols are drawn by CSS `::before` (glyph spans are empty), so a theme can choose White's symbols.
- "Colour pieces by type" off is applied on `.glyph-w/-b` themselves (not as variables on body) so previews get
  their own theme's colours.
- Theme list: `src/client/themes.js`. Setting: `theme` in settings.js, a "choices" setting (buttons with
  `data-value`) beside the boolean switches; remembered in localStorage, reset by Reset to defaults.

## Known, not fixed (from the review of PRs #8/#9)
- Pillbox: same symbol shapes for both sides, so with colours by type the sides are told apart mainly by the pill.
- Pillbox: the light-square bishop underline is near invisible in light mode; pills overflow small squares.
- Bishop marker differs between the board (underline) and the captured list (small swatch).
