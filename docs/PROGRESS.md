# Progress

Compact notes for whoever works on this next. Tests: `npm test` (node), and the browser page `tests/test.html`
(start_test.bat, or the `qhess` preview in `.claude/launch.json` at /tests/test.html, then Run tests: replays the
example games against tests/snapshots.json, plus multiplayer and page-feature checks), or headless with
`npm run test:browser`. Types: `npm run typecheck`. CI (pages.yml) runs all three before deploying.

## Potential check: the player picks the attackers again (2026-11-27)
- Why: adding every possible attacker in piece order wasn't neutral. One attacker's collapse can rule another out
  (e.g. after `...2b. (KQRP)a6a5(KQRP)`, 3w. c2g6 <f7+>: a2 (diagonal, QB) and f2 (file, QR) can't both attack), so
  the order decided the waves. Now the player decides by choosing.
- State `selectPCAttackers` again (replaces `showPotentialCheck`): after the king, click each attacker
  (controller `selectPCAttacker`); a square with no piece that could still attack cancels the move; the only
  possible attacker is chosen by itself. Pieces certain to attack (every wave) count already, as before, so Submit
  can show straight away. Formatting is the current one, not the old: red arrows from the attackers, no
  `.potAttacker` highlight; cancel cursors on the other squares only at Captures (render view `pcAttackers`).
- `selectPCKing(king, attackers)` still adds a given list at once (demo, tests/generate.html).

## start.bat gets Node.js with fnm (2026-11-26)
- A fresh clone needs only start.bat. The node on PATH, if it is the .nvmrc major; else fnm (Fast Node Manager):
  on PATH, else found under `%LOCALAPPDATA%\Microsoft\WinGet` (this window's PATH predates a winget install), else
  `winget install Schniz.fnm` (portable, per user: no UAC). Then `fnm install` (reads .nvmrc) only if `fnm exec --
  node -v` fails (so no network once installed), and the folder of `fnm exec -- node -p process.execPath`
  (`%APPDATA%\fnm\node-versions\v24.x\installation`) goes first on this window's PATH.
- Why: the Node MSI (the old `winget install OpenJS.NodeJS.24`) can't install beside or below another Node:
  on a PC with Node 26 it exits 1603 "A later version of Node.js is already installed". fnm leaves that one alone.
- Not `fnm env` / `fnm use`: they put junctions in `%LOCALAPPDATA%\fnm_multishells` pointing into `%APPDATA%\fnm`,
  and on this PC a junction in LOCALAPPDATA into APPDATA can't be followed (any process, even started by Explorer;
  junctions in LOCALAPPDATA to Temp, or in the profile to APPDATA, work). fnm exec uses the real folder.
- Packages: `npm ci` when package-lock.json is newer than node_modules/.package-lock.json (fresh clone, or a pull that
  changed it); npm ci never rewrites the lock file. A failed install stops before the server.
- node / npm / winget / fnm all run via `call`: a .cmd shim run without it never returns, and its `>nul` sticks.
  start_test.bat = start.bat --open tests/test.html. `.gitattributes` checks *.bat out CRLF (cmd misreads labels in
  LF files); the Write tool writes LF, so re-save it CRLF after editing.
- Tested for real on this PC (Node 26 installed): fnm install by winget, Node 24 through fnm (also with an empty
  FNM_DIR, the `fnm install` path), npm ci, server 200 on Node 24.
- git on this PC is GitHub Desktop's (`%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`), not on PATH.

## Hosted server moved from Render to Railway (2026-11-25)
- server-address.js `HOSTED_SERVER` = `qhess-production.up.railway.app` (the user's Railway service `qhess`).
  render.yaml deleted. No Railway config file: railway.json/toml are deprecated (unread after 2026-12-01, new
  services can't use them), and their replacement `.railway/railway.ts` can't set Wait for CI or sleeping. The
  dashboard settings are listed in README "Online": EU West, healthcheck `/`, Wait for CI (= Render's
  checksPass), domain target port 8000. The wake-on-load logic stays (needed if Railway app sleeping is on).
- The Render service itself is deleted by the user in Render's dashboard, once old pages have stopped using it.

## Checks shown by red arrows only (2026-11-24)
- controller draw `arrows.attacks`: from each attacker to the king of the check / potential check on the side to
  move (findChecks(game, turnColor)), at every hint level, until answered (moved away, blocked, taken, Not a King);
  while declaring (showPotentialCheck) the declared one, also at every level (was Captures only). board-view no longer sets
  `.checkKing` / `.checkAttacker`; their CSS is gone (the theme vars `--piece-checkKing-col` stays for `.potKing`;
  `--piece-checkAttacker-col` and the theme generator's previews of both are now unused). Snapshots re-recorded
  (6 games changed: the outline classes). tests/test.html potential-check test checks the arrows stay, then go.

## Demo: a thought per click, a pointer making the clicks (2026-11-24)
- Script: each ply has one `> click: [place] text` thought per click a player makes for it, in order
  (tour-script.js `plyClicks`: nak, pick, to, pc, king, submit; resign). parseTour errors on a missing/extra/
  out-of-order one; `ply.thoughts = [{click, text, place}]` (no more `thought` / ply `place`). 51 steps now.
- tour.js: `frames` (a note, or one click of a ply) are what Next/Back step; `reach(f)` rebuilds the position after
  frame f (plies before, then the ply's clicks made at once via `makeClick`; a ply's last click = the whole ply),
  `shown` = the frame on the board. Next: thought shows, the pointer (`.tour-cursor`, made in tour.js, fixed to the
  page, style.css 7.7) glides to the square / side button (LEAD_MS 400 + MOVE_MS 700), dips with a ring, and the
  click is made. Next/Back mid-glide settles (click made at once). Bubble anchor per click (`anchorOf`), pointer
  target `targetOf`. tests/test.html "no Surrender" also checks each step says something new.
- The pointer looks like the page's own cursor under its hotspot (`track`, a rAF loop while the tour runs:
  elementFromPoint -> computed `cursor`; a url() cursor (tick, cross) is used as is, "pointer" -> HAND, else ARROW;
  side buttons -> HAND, as they're disabled in the tour). It is `.resting` (faded out) except from a click's start
  until REST_MS after it, so it never covers the bubble or the collapsed pictures. A plain move is submitted by
  clicking its square again (`submitsOnSquare`); a PC or the move-0 pass uses the Submit button.
- Text for beginners: the player sees pictures, not letters (no "its N", "letters", "kNight"). 5w. thinks it sees
  checkmate. A hidden Browser pane stalls transitions/rAF: check the pointer with screenshots, not sampling.

## Cross over squares a picked piece can't reach (2026-11-24)
- Rule: the cross shows wherever a click would cancel, the tick wherever it would submit. In showPartialMove,
  board-view now gives `.cancelOnClick` to squares with no `potentialMove` (a click there puts the piece back),
  only from the Moves hint level (below it the crosses would give the destinations away, as with the PC kings).
  Over the mover's own pieces grab still wins (7.8). tests/test.html restage test checks a3's cross / e4's none.

## Last move: arrow only; tick on the draggable staged square (2026-11-24)
- The last move (in replay, and in multiplayer) no longer outlines its squares (board-view gave them selectedStart /
  selectedEnd); the grey last-move arrow shows it, in replay too (replayPly sets ui.lastStart/lastEnd). draw no longer
  passes lastStart/lastEnd to the view.
- The staged destination's tick cursor was hidden by the drag rule (7.8 `cursor: grab`, more specific) once staged
  pieces became draggable. `.submitOnClick` keeps the cursor in `--submit-cursor`; 7.8 puts it back on
  `.board[data-drag] .boardsquare.submitOnClick`. Crosses still show on empty / opponent squares; over the mover's
  own pieces grab wins (a press there drags). tests/test.html restage test checks e4's tick.

## Docker (2026-11-24)
- Node 24 everywhere: `.nvmrc` (24) is the one place; package.json engines "24.x" + `.npmrc` engine-strict (npm
  install/ci fail EBADENGINE on another major; checked), CI `node-version-file: .nvmrc`, Dockerfile node:24-alpine,
  @types/node ^24. start.bat's fnm reads .nvmrc too. To move: change all four.
- Dockerfile (`npm ci --omit=dev`, runs as `node`, which can't write the files: the themes list write already fails
  quietly), .dockerignore, compose.yaml (port `${QHESS_PORT:-8000}`, no restart policy). For checking the image by
  hand; development runs on Node (npm start / start.bat).
- start.bat briefly ran Docker (start Docker Desktop, compose up, fall back to Node); reverted to the Node route
  only, with its version check reading .nvmrc. Why: on this PC (Docker Desktop 4.72 and 4.100, Windows Insider
  26300) Docker Desktop crashes on every start after it has been quit: its AF_UNIX socket files
  (Docker\run\dockerInference, docker-secrets-engine\engine.sock) can't be removed or renamed (error 1920); a reboot
  doesn't help. Renaming both folders aside with Docker fully quit lets one start (15 s). Keep start.bat CRLF
  (`grep -c $'\r'` in Git Bash reports 0 regardless; check with od -c).
- (Hosting moved to Railway 2026-11-25, above; render.yaml is gone.) pages.yml builds the
  image and curls / from it (`--retry-all-errors`: Docker's port proxy gives an empty reply until the server listens).
- server.js: env `QHESS_NO_BROWSER` (= --no-browser, set in the image); `QHESS_LAN_ADDRESS` (comma list) replaces
  `lanAddresses()` (in a container they're the container's 172.x ones, so join links were wrong); SIGTERM/SIGINT
  close the server and exit (Node as PID 1 ignored them: docker stop took 10 s, now 1 s).
- Checked by hand: image builds, page 200, server/ 403, tests/test.html 22/22 (multiplayer included) in the container.
  The image serves no-store like the local server, so it doesn't need deploy/stamp-versions.js.

## Robustness: CI checks, random-game tests (2026-11-22)
- pages.yml runs typecheck, `npm test`, then `npm run test:browser` (tests/browser/run.js: starts the server on a
  free port, Playwright Chromium opens tests/test.html, presses Run tests, waits for `window.testResults`; prints
  the rows that didn't pass, exit 1 on any failure or page error). Locally it needs `npx playwright install chromium`
  once. Not yet seen running on GitHub (nothing pushed); Linux fonts could matter to the page-feature checks.
- jsconfig also has noUnusedLocals/Parameters, noImplicitReturns, noFallthroughCasesInSwitch.
- tests/node/random-games.test.js: 100 seeded random games (mulberry32, as generate.html) of up to 80 plies straight
  through the engine. Each turn is picked from every move x every en passant/promotion/castle answer (with Not a King
  when it can be declared), sometimes with a potential check on a random king and random attackers. Every ply
  checks: board and piece lists agree, no piece is nothing, each army completable and already fully collapsed
  (filterOptionMatrix changes nothing), trying moves never changes the original, replaying the written line gives
  the same position and line, no "couldn't be played" faults; the game goes on exactly while a legal turn exists.
- It found a bug, fixed: pcMoveText wrote findChecks' attackers, which for an already-collapsed king are every piece
  that *might* attack it; replaying the line then collapsed them (a different position). Now it always writes the
  pieces certain to capture the king (getCertainMoves). The UI never hit it (it adds every possible attacker).

## Type checking, no build step (2026-11-22)
- Still plain JS served as-is; `npm run typecheck` runs `tsc -p jsconfig.json` (checkJs, noEmit, **strict on except
  noImplicitAny**) over src/, server/, deploy/, tools/ and tests/node/. Keep it at 0 errors. vendor/qrcode.js is
  `@ts-nocheck`. noImplicitAny stays off: it would mean a JSDoc type on every parameter (~500).
- `GameState` (state.js typedef) is on every engine function taking `state`; `pieceAt(state, coords)` (state.js) is
  the board lookup where there must be a piece (throws if empty). controller.js: `UiState` (the ui.state names: a
  typo in setState is an error), `MultiplayerView`, `Drag`; `committed` / `game` are GameState.
- Null rules: variables that start null say their type (`/** @type {X | null} */`); the page's elements are cast to
  HTMLElement where looked up (dom.js / tour.js / modals.js `$`). tour.js `steps` is [] when not running (was null).
  Fields of a class are set in its constructor (SocketSession, TestClient state/moves), not only in a method.
- Types are JSDoc. protocol.js has `Move`, `ClientMessage`, `ServerMessage` (and Square, Color, HintLevel):
  socket-session.js `send` / `request` and rooms.js `send` / `broadcast` / `moveMessage` only take those.
  game.js startMove's result is one flat type (ok, error?, movedIntoCheck?, ...). dom.js casts the elements whose
  properties are used (inputs, buttons, the link, the textarea); event targets are cast to Element where `closest`
  is used. server.js tracks heartbeat answers in a WeakSet `alive` (was `ws.isAlive`).

## Potential check: attackers automatic, arrows (2026-11-21; picking restored 2026-11-27, above)
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
- The game (10 plies; the user's own) teaches one idea at a time: collapses first (1w. Nf3 -> N, 1b. f7xa2
  -> QB, 2w. a1b3 the second knight so no other White piece is N), then potential check (2b. g8xb3 <b2+ b3 g7>
  makes b3 Q and g7/a2 B; 3w. Not a King on b2; 3b. f8xf2 rook <f1+>; 4w. f1g1 steps out instead, KQR), then mate
  (4b. O-O makes the king known; 5w. g2xg7# : g1 guards g7 up the file). Move 0 is passed, PC explained later.
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
