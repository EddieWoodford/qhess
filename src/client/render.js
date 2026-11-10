"use strict";

// Drawing the page. Everything here only reads the game state and the page state it is given;
// what happens on clicks lives in controller.js. Each part of the page has its own module:
//   board-view.js    the board's squares, pieces and highlights
//   status-view.js   the status bar under the board: prompt, staged move and the two side buttons
//   history-view.js  the History tab
//   panels-view.js   the Captured tab
//   multiplayer-view.js  the Multiplayer tab
// and dom.js finds the page's elements for them.

import { drawBoard } from "./board-view.js";
import { drawStatus } from "./status-view.js";
import { drawHistory } from "./history-view.js";
import { drawPanels } from "./panels-view.js";
import { drawMultiplayer } from "./multiplayer-view.js";
import { dom } from "./dom.js";

// Redraw everything. view = {
//   game:        the game state being shown
//   state:       the click-flow state ("clear", "move0", "showPartialMove", ... see controller.js)
//   squares:     8 x 8 SquareViews
//   start, end:  [r,c] of the move being made, or []
//   lastStart, lastEnd: [r,c] of the last submitted move (highlighted during replay)
//   replayNumber: -1, or the replay position (see controller.js)
//   record:      the game record for the History tab, one ply per line (array of strings)
//   multiplayer: null in single player; in a multiplayer game, its code, your colour and the connections
//                (controller.js ui.multiplayer)
//   pcRule:      whether the player can declare potential checks (controller.js pcRule)
//   pcSetting:   the Settings tab's Potential Check switch (controller.js ui.potentialCheck)
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
function drawSettings(view) {
	const input = dom.settings.potentialCheck;
	input.disabled = view.multiplayer !== null;
	input.checked = view.multiplayer !== null ? true : view.pcSetting;
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
