# Progress

Compact notes for whoever works on this next. Tests: `npm test` (node only; the browser UI has no automated tests,
check it with the `qhess` preview in `.claude/launch.json`).

## Multiplayer rewind (2026-11-19)
- Stepping back in a multiplayer game now offers **Resume from here** (button1; "Back to game" moved to button2) once
  the opponent has joined. It asks the opponent to take the game back to the position shown.
- Protocol (protocol.js): `rewind {keep}` (keep = moves to keep, 0 <= keep < moves; replaces any open request),
  `rewindAnswer {agree}`, `rewindCancel` (asker only); server sends `rewind {keep, by}` to both (again on resume)
  and `rewindEnded {keep, by, result}`, result agreed / declined / cancelled / moved (any move played closes it).
  On agree the server truncates the moves, saves, sends `sync` then `rewindEnded`. Requests live on the room only
  (not the store).
- SocketSession: requestRewind / answerRewind / cancelRewind, info().rewind `{keep, mine, undo}`, events
  rewindAsked / rewindEnded (+ a non-fatal message). The asker can't submit a move while their request is open.
  sync now drops a pending move whose seq isn't the next one (it was played, or rewound away).
- Controller: the asked player is jumped to the position (showPosition) with the prompt "Your opponent wishes to
  rewind to the position shown, undoing N moves. Agree?" and Agree / Decline; the asker sees "Waiting…" with
  Withdraw (+ Back to game while replaying). Agreed: both go back to the live game; declined: the asker stays where
  they were looking. Status overrides in status-view.js REWIND_ASKED / REWIND_WAITING.

## Demo play-through (2026-11-19)
- Info tab "Watch the demo", and offered once (choice dialog, localStorage `qhess.demoOffered`) to a player with no
  saved game. Steps through a short scripted game with thought bubbles; bar under the status bar: Back / Next /
  Play from here / Exit (keys ← → Esc; the History tab's < > step it too).
- Script: `src/client/tour-text.js` (a JS module so it's versioned with the scripts on deploy), format in
  `tour-script.js` (`parseTour`): plies exactly as the engine writes them, `# [@sq] note` steps, `> thought` per ply
  (required), `? sq TYPES` / `? pc sq` checks. tests/node/tour.test.js plays every ply, checks it's written back
  identically, runs the checks, and that a collapse, PC, Not a King, a capture, castling and mate appear.
- The game (16 plies, 29 steps): PCs and Not a King, knight collapses, army adds up (two known knights), captures;
  then Black castles h8->f8 with d8 (collapses K and R: the king is known), White pins e7 with c5, Black takes e4 as
  its only queen (so e7/g7 lose Q), 8w. c4xf7# - mate because a2 (unmoved, could be Q/B) guards f7 under the strict
  check rule. Found with a small helpmate search over getMoveDestinations + applyMove (not kept in the repo).
- `src/client/tour.js` never draws the board: Next acts a ply out through the controller's own calls (showPartialMove,
  showCompleteMove, sideButton1Action for Add PC / Not a King, selectPCKing/Attackers, sideButton2Action), 1.2s per
  stage, flashing the side button it "presses" (.tour-press); so theme, highlights, prompts and slide animation are
  the game's own. Back/jumps use restoreGameHistory. If acting ends on a different line than the script, it warns
  in the console and shows the ply as written.
- controller `ui.tour`: board clicks/hover and side-button clicks ignored, record not saved, pcRule forced on,
  jumpToPly ignored. Exit restores the game saved at start; Play from here keeps the shown position. Reset, Import,
  multiplayer Create/Join stop the tour first. Not available in multiplayer.
- Bubble (style.css 7.7): beside the anchor square (left of it on the right half, right on the left half), white /
  black border from `--piece-wK` / `--piece-bK`; narrator notes centred unless `@sq`. Follows resize and Black's view.
- The game's own Checkmate banner shows on the mating ply; the tour clicks it away for the notes after it.
- Left: the bubble can still cover a square the thought is about (e.g. e7 in 1b.); no auto-play.

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

## Idea, not done: drag-and-drop moves (2026-11-19)
- Drag a piece; while it hovers a legal square the board shows the position after that move (all collapses, ruled-out
  types fading); dropping plays and submits it (no Submit). Drop off-board / on its start square / Esc cancels;
  an into-check square shows as illegal and refuses the drop. A press without moving stays the click-click flow.
- Plan: pointer events (not HTML5 DnD, no touch), `touch-action: none` on the board, ghost piece offset above a
  finger. New controller state `dragging`; on drag start try every destination once (startMove on clones, as
  showCompleteMove does) and cache the results, so hovering only renders a cached state. Drop = showCompleteMove +
  submitMove. No slide animation for dragged moves. Engine/server unchanged.
- Open points: potential check (today added after the move, before Submit) -> an "Add PC" toggle armed before the
  drag; when on, the drop goes to selectPCKing instead of submitting (no undo window: multiplayer moves can't be
  taken back). Promotion / en passant / castle questions: hover shows the move with the choice open (e.g. `?`),
  the drop asks, cancelling the dialog cancels the move. Maybe a setting "submit on drop / ask first" against
  mis-drops. Pairs with the arrow move markers above.
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
