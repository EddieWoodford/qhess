"use strict";

// Drawing the page. Everything here only reads the game state and the page state it is given;
// what happens on clicks lives in controller.js. Each part of the page has its own module:
//   board-view.js    the board's squares, pieces and highlights
//   status-view.js   the status bar under the board: prompt, staged move and the two side buttons
//   history-view.js  the History tab
//   panels-view.js   the captured pieces (in the History tab)
//   multiplayer-view.js  the Multiplayer tab
// and dom.js finds the page's elements for them.

import { drawBoard } from "./board-view.js";
import { drawStatus, HINT_NAMES } from "./status-view.js";
import { drawHistory } from "./history-view.js";
import { drawPanels } from "./panels-view.js";
import { drawMultiplayer } from "./multiplayer-view.js";
import { dom } from "./dom.js";

// Redraw everything. view = {
//   game:        the game state being shown
//   state:       the click-flow state ("clear", "move0", "showPartialMove", ... see controller.js)
//   squares:     8 x 8 SquareViews
//   start, end:  [r,c] of the move being made, or [] (while dragging, end is the square the board shows its move to)
//   draggable:   the colour whose pieces a press can drag now (style.css 7.8), or null
//   drag:        null, or while a piece is dragged (controller.js): { lifted: its copy follows the pointer (no move
//                shown), over: it is over a square it can move to, question: the move there is ambiguous (asked on
//                the drop) or null, intoCheck: the move there leaves the mover in check }
//   restage:     [[r,c]...]: while a move is staged, the squares a click moves its piece to instead of cancelling
//   pcAttackers: [[r,c]...]: while choosing potential-check attackers, the pieces a click adds (any other cancels)
//   arrows:      { last, current }: each [[r,c], [r,c]] or null: the last move played, and the move being made
//   replayNumber: -1, or the replay position (see controller.js)
//   record:      the game record for the History tab, one ply per line (array of strings)
//   multiplayer: null in single player; in a multiplayer game, its code, your colour and the connections
//                (controller.js ui.multiplayer)
//   pcRule:      whether the player can declare potential checks (controller.js pcRule)
//   pcSetting:   the Settings tab's Potential Check switch (controller.js ui.potentialCheck)
//   tour:        the demo play-through is driving the board (tour.js): the side buttons can't be pressed
//   before:      the game state at the start of the turn: the board shows the types the move being made has ruled
//                out, faded, until it is submitted. While stepping through the history, the state before the ply
//                shown (so the types that ply ruled out are faded), or null at the start.
//   hintLevel:   how much the board shows before Submit (protocol.js HINT_LEVELS; controller.js hintLevel): below
//                "moves" no move markers, below "captures" captures not in their own colour
//   hideCollapses: the None hint level, during a turn: pieces show the types they had at its start (view.before),
//                and the staged move is written without its types
//   animate:     slide the pieces that moved since the last draw (board-view.js); only for a move in live play
// }
function render(view) {
	drawStatus(view);
	drawHistory(view);
	drawBoard(view);
	drawPanels(view);
	drawMultiplayer(view);
	drawSettings(view);
}

// The Settings tab's Potential Check switch: a multiplayer game always uses the rule, so the switch shows it on
// and can't be changed until the game is over. It shows the player's own choice again afterwards.
// The Hint Level buttons likewise show a multiplayer game's level (or the demo's).
// The Black's view switch: a multiplayer game shows the player's own side at the bottom, so it can't be changed either.
function drawSettings(view) {
	const input = dom.settings.potentialCheck;
	input.disabled = view.multiplayer !== null;
	input.checked = view.multiplayer !== null ? true : view.pcSetting;
	dom.settings.blackView.disabled = view.multiplayer !== null;
	// Hint Level: the level in use, which in a multiplayer game is the game's (and the demo's is every hint).
	// Otherwise the player's own (settings.js has already shown it). The demo's can't be changed, nor a multiplayer
	// game's while not connected to it; while connected a button asks the opponent (controller.js requestHintLevel),
	// and the request shows under the buttons, with Withdraw for this player's own.
	const mp = view.multiplayer;
	const request = mp?.hintRequest ?? null;
	const locked = view.tour || (mp !== null && (mp.phase != "playing" || mp.connection != "connected"));
	for (const button of /** @type {NodeListOf<HTMLButtonElement>} */ (dom.settings.hintLevel.querySelectorAll("[data-value]"))) {
		button.disabled = locked;
		button.setAttribute("aria-pressed", String(button.dataset.value == view.hintLevel));
		button.classList.toggle("hint-asked", request?.mine === true && button.dataset.value == request.level);
	}
	dom.settings.hintRequest.hidden = request === null;
	dom.settings.hintWithdraw.hidden = !request?.mine;
	dom.settings.hintRequestText.textContent = request === null ? ""
		: request.mine ? "Asked your opponent to change to " + HINT_NAMES[request.level] + ". Waiting for their answer."
		: "Your opponent asks to change to " + HINT_NAMES[request.level] + ": answer under the board.";
}

// Show a message just above the status bar for a few seconds (style.css hides the element while it is empty)
const DEBUG_SHOW_MS = 6000;
let debugTimer;
function debugPrint(txt) {
	dom.debug.innerText = txt;
	clearTimeout(debugTimer);
	debugTimer = setTimeout(() => { dom.debug.innerText = ""; }, DEBUG_SHOW_MS);
}

export { render, debugPrint };
