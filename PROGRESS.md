# Progress

Compact notes for whoever works on this next. Tests: `npm test` (node), and the browser page `tests/test.html`
(start_test.bat, or the `qhess` preview in `.claude/launch.json` at /tests/test.html, then Run tests: replays the
example games against tests/snapshots.json, plus multiplayer and page-feature checks). Types: `npm run typecheck`.

## Type checking, no build step (2026-11-22)
- Still plain JS served as-is; `npm run typecheck` runs `tsc -p jsconfig.json` (checkJs, noEmit, strict off) over
  src/, server/, deploy/, tools/ and tests/node/. Keep it at 0 errors. vendor/qrcode.js is `@ts-nocheck`.
- Types are JSDoc. protocol.js has `Move`, `ClientMessage`, `ServerMessage` (and Square, Color, HintLevel):
  socket-session.js `send` / `request` and rooms.js `send` / `broadcast` / `moveMessage` only take those.
  game.js startMove's result is one flat type (ok, error?, movedIntoCheck?, ...). dom.js casts the elements whose
  properties are used (inputs, buttons, the link, the textarea); event targets are cast to Element where `closest`
  is used. server.js tracks heartbeat answers in a WeakSet `alive` (was `ws.isAlive`).
- Next places worth typing, if wanted: the controller's `ui` state and the engine `state`; then `strict: true`.

## Potential check: attackers automatic, arrows (2026-11-21)
- Add PC -> choose the king -> **every** piece of the mover's that could attack it attacks it (controller
  `selectPCKing(king, attackers = choosePCKing's list)`: addPCAttacker each, skipping any an earlier collapse ruled
  out; into check -> invalidMoveIntoCheck). The state after is `showPotentialCheck` (was `selectPCAttackers`, the
  one-at-a-time step, now gone with `highlightPCAttackers`, `highlightPotAttacker`, `.potAttacker`); any click
  cancels, Submit submits.
- At Captures: a red arrow from each attacker to the king (`arrows.attacks` from controller draw ->
  board-view `.arrow-attacks` group, rebuilt each draw; style.css 7.9 `#f44`); attackers get no `.checkAttacker`
  outline in that state (real checks still do). Below Captures: no arrows, and choosing the king shows no `.potKing`
  highlights nor cancel cursors (they'd give the candidates away); the flags are still set (generate.html reads them).
- The demo passes its scripted attackers (`selectPCKing(move.pcKing, move.pcAttackers)`). tests/generate.html picks
  attackers the old random way on an engine copy (board order, same rng use) so seed 5 still makes
  01_short_opening.txt, then passes that set.
- tests/test.html "potential check: every possible attacker attacks, with arrows at Captures".

## Re-staging a move before Submit (2026-11-21)
- While a move is staged (`STAGED_STATES`: showCompleteMove, invalidMoveIntoCheck) its piece can still go
  elsewhere. controller `restageSquares()` = the start square + the piece's other destinations in `committed`.
  Click: one of those squares -> cancelTurn, then showCompleteMove there (slides), or for the start square
  showPartialMove (picked up again). The staged square still submits (the user's tick); anything else cancels.
  Board-view gives restage squares no cancel cursor (view.restage).
- Drag: DRAG_STATES includes the staged states. On activating, the staged move is saved in `drag.staged`
  ({game, turnMove, start, end, state}); a press on the staged square drags from the piece's own start
  (`drag.pressed` is where the ghost is copied from, before the redraw); cancelTurn. A drop on a destination stages
  it; on the start square, picked; elsewhere or Esc, `putBack(staged)` restores the staged move. Pressing another of
  the mover's pieces drags that one (the staged move comes back on a miss).
- tests/test.html "restage: a move not yet submitted can go elsewhere".

## Move pattern pulses: on branch `pulsing-move-pattern` (2026-11-21)
- An experiment, kept off main at the user's request: instead of the static lines/arcs, the picked piece's ways of
  moving pulse out from it to the board's edge (through pieces), and a knight's two rings of dashes turn opposite
  ways on its hop squares. Engine `getMovePattern`, board-view `drawPattern`, style.css 7.9 (speeds in
  `--pattern-ray-time` / `--pattern-ring-time`). main keeps the static markers (7.3).

## Two move arrows (2026-11-21)
- The last move and the move being made (once it has a destination, dragged or picked) now show together, styled
  apart: controller draw passes `arrows: {last, current}`; board-view `drawArrows` keeps `<g class="arrow-last">`
  (under) and `<g class="arrow-current">` in the one SVG, each an edge + line path. style.css 7.9: `.arrow-last`
  is grey (#999 line) at 0.6 opacity (dashed was tried first; the user preferred grey), the current one solid white. tests/test.html "move arrows" checks both.
  (Supersedes the single `arrow` in "Move arrow" below.)

## Knight markers: arcs round the knight (2026-11-21)
- A knight's hop (odd classes) is now a thin arc, not a dot: part of the circle centred on the knight through the
  destination's centre (r = 223.6 of a 100 square, the knight's distance), to show knights move by distance, not
  direction. One mask per class (`--marker-arc1`..`15` + `-edge`, style.css 7.3), circle centre = the source
  square relative to the destination; the 8 arcs together nearly close the circle. Rows/files reverse in Black's
  view but squares don't, so `.board.flipped` turns the knight markers' ::before/::after 180deg. Theme generator
  matches; tests/test.html checks g1->f3's arc.

## Move markers: thin lines again (2026-11-21)
- The chevrons are gone (the user preferred the old green stripes): a line move's square gets a thin (5 of 100),
  hard-edged (crispEdges, square caps) line right across it along the move's axis, so a slider's moves join into
  a ray. Four fixed masks in style.css 7.3 (`--marker-line-{up,across,ne,nw}` + `-edge`, 9 wide, under it in
  #000a): 8/16 up, 4/12 across, 2/10 NE, 6/14 NW. Knight dots unchanged (since replaced by arcs, above); captures
  keep their colour and ring. No rotation any more (`--bearing`, `--marker-flip` removed): a line looks the
  same from Black's side. The theme generator's preview CSS matches. tests/test.html "move markers" checks the
  masks.

## Hint Level (2026-11-20)
- Settings tab "Hint Level", four buttons (settings.js `hintLevel`, a remembered choice; values protocol.js
  `HINT_LEVELS`): **none** (no markers; pieces keep their start-of-turn types until Submit, and the staged move is
  written without its "(...)" types), **collapses** (collapses shown, no markers), **moves** (markers, no capture
  colour), **captures** (everything, the default = the old behaviour).
- controller `hintLevel()`: the demo always "captures"; a multiplayer game uses `ui.multiplayer.hintLevel` (the
  server's), else `ui.hintLevel`. draw passes `hintLevel` and `hideCollapses` (none, live, not a waiting state).
  board-view gates `.destination` / `.destinationCapture` on it and, with hideCollapses, draws each piece with
  `typesBefore` (its waves in view.before, unless the move gave it a new type: promotion). Below "moves" a dragged
  piece shows no move while hovered (that would show where it can go); dropping still stages it. A click on a
  square it can't reach just puts it back, as before.
- Multiplayer: `create {color, hintLevel}` (default captures; bad value -> bad_request), kept on the record,
  sent in every `welcome`; SocketSession info().hintLevel. render.js drawSettings shows the level in use; the
  player's own level is back after the game.
- Changing a multiplayer game's level needs the opponent's OK (like rewind): a Hint Level button sends
  `hintLevel {level}` (main.js catches the click before settings.js, so the player's own setting is untouched);
  server sends `hintLevelAsked {level, by}` to both (again on resume), then `hintLevelEnded {level, by, result}`
  (protocol.js HINT_CHANGE: agreed / declined / cancelled; agreed sets record.hintLevel). A new request replaces
  an open one; moves don't end it; before anyone has joined it applies at once. `hintLevelAnswer {agree}`,
  `hintLevelCancel` (asker only). SocketSession requestHintLevel / answerHintLevel / cancelHintLevel,
  info().hintRequest `{level, mine}`.
- The asked player gets status-view HINT_ASKED (Agree / Decline in the side buttons; a rewind request comes
  first). The asker plays on; the Settings tab marks the asked level (`.hint-asked`) with a note and Withdraw
  (clicking the game's current level withdraws too). Buttons are disabled only in the demo or while not connected.
- Tests: server.test.js / socket-session.test.js; tests/test.html "hint level: what each level shows before
  Submit" and "hint level: a multiplayer game plays at its creator's, changed if the opponent agrees".

## Move arrow (2026-11-20)
- A light line arrow over the board (the user wanted a single line, not a wide arrow): a 2px white line with a
  two-stroke head on a 4px black one (`.arrow-line` over `.arrow-edge`, the same path). It shows the move being made once it has a
  destination (staged, or a dragged piece over a legal square), otherwise the last move played (`ui.lastStart` /
  `lastEnd`: the opponent's, or your own after Submit; the ply shown while replaying). None at a new game or move 0.
- controller draw passes `arrow`; board-view drawArrow keeps one `<svg class="move-arrow">` (viewBox 8 x 8, a square
  per unit) as the board's last child, outside the squares, so the view snapshots don't see it. style.css 7.9 places
  it past the padding and coordinate strip (calc with `--coord-strip`, so it slides with the strip), and turns it
  180deg in Black's view; `.board` is now position: relative.
- tests/test.html "move arrow: the last move, or the one being made".

## Move markers: chevrons and dots, captures in their own colour (2026-11-20; chevrons replaced 2026-11-21)
- Replaced the green stripes / rings (style.css 7.3). board-view adds `.destination` + `.destination{1-16}` (the
  controller's bearing, 16 = up the board) and `.destinationCapture` when an opponent piece is on the square (not
  en passant). Even bearing: a chevron turned `--bearing` x 22.5deg; odd (knight hop): a dot, both drawn at
  `--marker-size: 33%` of the square (the user found full size too big and bold). Drawn as ::before
  (dark #000a edge) + ::after (colour), each an SVG mask (`--marker-*` on :root); no ring except on captures (3px
  `--piece-capture-col`). Black's view: `.board.flipped { --marker-flip: 180deg }` (flipped is a re-layout, not a
  turn). Shapes as in the old mockup (deleted, tools/move-markers-mockup.html).
- New theme variable `--piece-capture-col` (in every theme, REQUIRED in themes.test.js): #da0b9c Dark Distinct and
  eddie1, #ff4fd8 Dark Simple, #c0137a both light themes (best magenta contrast against each theme's squares/boxes).
- Theme generator: "Captures" picker (default #da0b9c), generated hue 295-325 (magenta); the side-to-move colour no
  longer uses magenta (amber-yellow or cyan only). Its preview CSS copies the new 7.3; its 14 square states now show
  up / right / diagonal / knight hop / capture / knight capture.
- tests/test.html "move markers: direction, knight hops, captures".

## Drag-and-drop moves (2026-11-20)
- Press one of the mover's pieces and move 4px (mouse) / 8px (touch): it's dragged (state `dragging`). Over a square
  it can move to, the board shows that move (startMove on a clone of `game`, tried each time the square changes):
  piece there, every collapse, ruled-out types faded, prompt "Drop here, then Submit". Elsewhere a copy follows the
  pointer (`.piece-lifted`, a 7.5 ghost; drawn above a finger) and the start square is faded (`.dragOrigin`).
- Drop on a destination = clicking it (showCompleteMove): **the move still waits for Submit / Add PC** (the user
  wanted that stop kept). An ambiguous move (en passant / promotion / castle) shows no position while hovered (prompt
  names the question) and asks on the drop; a move into check shows the check and drops into invalidMoveIntoCheck,
  as a click does. Back on its own square: stays picked (showPartialMove). Elsewhere, Esc, pointercancel: clear.
- controller.js "Dragging a piece": window pointer listeners while pressed (no pointer capture); `ignoreClick`
  swallows the click a release can make (reset by the next pointerdown); setState to any other state ends a drag
  (e.g. a multiplayer catch-up). draw passes the hovered move's state as `game`, plus `drag` and `draggable`.
- board-view sets `data-drag` on the board (whose pieces can be dragged); style.css 7.8 gives those squares
  `touch-action: none` + grab cursor via `:has` (squares' classes unchanged, so the view snapshots still hold).
- tests/test.html "drag: a dropped piece waits for Submit" drives it with synthetic PointerEvents.
- The Browser pane's click/drag tool loses a press that lands right after the mouse moves onto a piece in "clear"
  (the hover preview redraws the square first; older than this feature). Hover first, then drag, when testing there.

## start.bat sets everything up (2026-11-20)
- A fresh clone needs only start.bat. Node.js 20+: the one on PATH, else `%ProgramFiles%\nodejs` (installed, but the
  window's PATH predates it, or an older node comes first), else `winget install OpenJS.NodeJS.LTS` (machine-wide
  MSI with a UAC prompt: winget has no user-scope Node installer any more), then put first on this window's PATH.
  No winget, or the install fails: it points to nodejs.org and pauses.
- Packages: `npm ci` when package-lock.json is newer than node_modules/.package-lock.json (fresh clone, or a pull that
  changed it); npm ci never rewrites the lock file. A failed install stops before the server.
- node / npm / winget all run via `call`: a .cmd shim run without it never returns, and its `>nul` sticks.
  start_test.bat = start.bat --open tests/test.html. `.gitattributes` checks *.bat out CRLF (cmd misreads labels in
  LF files).
- Tested on a temp clone with a fake PATH / ProgramFiles / winget.cmd; the real winget install was not run.

## Ruled-out types shown faded until Submit (2026-11-19)
- While a turn has changes not yet submitted (a staged move, Add PC attackers, Not a King), every piece also shows
  the types it has lost since the start of the turn, faded and grey (`.glyph-lost`, style.css 7.4: opacity 0.3 +
  grayscale), in their places in its 3x2 grid; a piece the move collapses keeps its grid until Submit. That includes
  army-adds-up losses on other pieces (e.g. the second known knight fades N on the side's other pieces).
- Stepping through the history shows the same for the ply that led to the position shown: replayPly keeps
  `beforeLastPly` (a clone of the state before it; setup clears it), and draw passes it as `before` while replaying.
- controller draw passes `before: committed` (beforeLastPly while replaying); board-view `lostTypes` compares each piece's
  waves with `before.pieces[color][i]`; glyphs.js waveHTML(waves, color, lost). The theme generator's preview has the
  same rule, shown on the second piece of the Pieces board's last row.

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
- The demo always shows the coordinates (its thoughts name squares): settings.js `holdSetting("showCoords", true)` on
  start, `holdSetting("showCoords")` on stop. A held switch shows the value, is disabled, and the player's own value
  comes back when let go (Reset Settings meanwhile sets that to the default). tour.js re-places the bubble on the
  board's `--coord-strip` transitionend (the squares shrink as the strip slides in). tests/test.html "demo: the
  coordinates always show".
- No Surrender in the demo (status-view.js `SURRENDER` is null when `ctx.tour`): it flashed up before and after
  every acted-out move, as the states before a move is staged offer it. tests/test.html "demo: no Surrender between
  its moves" (fails without the fix).
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
  board colour (squares, border, boxes, 12 piece colours, 2 side colours, 5 highlights), a preview that repeats the
  board CSS of style.css 7.1-7.4 (keep in step if those change), contrast numbers per colour, Generate (best of up
  to 400 random candidates scored against contrast targets; locked colours kept, others fitted to them; highlight
  hues kept to their meanings: check red, moves green, captures magenta, attacker blue-violet, side-to-move amber or
  cyan).
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

## Theme generator: colour-blind safe (2026-11-19)
- Top-bar switch **Colour-blind safe** (saved with the generator's state). When on: every contrast check also runs on
  the colours as seen with protanopia, deuteranopia and tritanopia (the number beside a colour is its worst, its
  title says which vision), plus "look apart" checks (OKLab deltaE x100): each side's six type colours >= 5
  (Distinct only; types also differ in shape) and the five highlights pairwise >= 8. A report under the pickers
  lists what isn't met. "View as" toggles (Normal / the three) filter the preview with SVG feColorMatrix filters.
- `tools/colour-vision.js`: classic script (file:// still works) setting globalThis.ColourVision: Machado 2009
  matrices at full severity on linear RGB (passing dichromacy covers the milder, commoner anomalies), simulate,
  deltaE (OKLab), svgMatrix; both memoised. tests/node/colour-vision.test.js.
- Generate steering when on: fit uses worst contrast over all visions; each piece type's lightness is chosen
  (greedy, random type order) to look most different from that side's types already chosen while keeping contrast
  (apartFrom); highlights likewise, check and moves first, wider lightness range, and the side-to-move colour tries
  candidate hues. Measured (with four highlights, before captures): ~18% of Distinct and ~46% of Simple pass at ~25 ms each;
  Generate stops at the first pass or after 2.5 s (typically 20-150 ms). Off: unchanged.
- Not covered: achromatopsia (total colour blindness, very rare).

## Deploy: versioned scripts on GitHub Pages (2026-11-18)
- Pages sends `max-age=600` on every file, each cached on its own, so after a push a new index.html could run with an
  old cached module (seen: modals.js looking for the removed Theme button).
- `.github/workflows/pages.yml` (push to main): npm ci, npm test, copy the repo to `_site`, `node
  deploy/stamp-versions.js _site`, deploy. The stamp adds an import map to the deployed index.html sending every
  `src/**/*.js` to `?v=<sha256 prefix>` (Pages ignores the query), and stamps main.js's script tag and style.css.
  The repo's index.html is never stamped. Needs Settings > Pages > Source = "GitHub Actions" (the user's to set).
- Left: index.html itself can be up to 10 minutes stale (an old page may then fetch a newly changed module).
  Data (themes/*.css, index.json) is fetched with `cache: "no-store"`.

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
- Nothing shows a bishop's square colour any more: not the board, nor (since 2026-11-19, at the user's request) the
  captured list, which shows a plain bishop symbol. piece.wavesWithBishopColor is kept (rules.test.js uses it).
