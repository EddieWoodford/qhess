"use strict";

// Drawing the page. Everything here only reads the game state and the page state it is given;
// what happens on clicks lives in controller.js. Each part of the page has its own module:
//   board-view.js    the board's squares, pieces and highlights
//   status-view.js   the prompt, the two side buttons and the staged move
//   history-view.js  the History tab
//   panels-view.js   the Find Pieces tab (find buttons and captured lists)
// and dom.js finds the page's elements for them.

import { drawBoard } from "./board-view.js";
import { drawStatus } from "./status-view.js";
import { drawHistory } from "./history-view.js";
import { drawPanels } from "./panels-view.js";
import { dom } from "./dom.js";

// Redraw everything. view = {
//   game:        the game state being shown
//   state:       the click-flow state ("clear", "move0", "showPartialMove", ... see controller.js)
//   squares:     8 x 8 SquareViews
//   start, end:  [r,c] of the move being made, or []
//   lastStart, lastEnd: [r,c] of the last submitted move (highlighted during replay)
//   findPiece:   piece type the find buttons are highlighting, or ""
//   replayNumber: -1, or the replay position (see controller.js)
// }
function render(view) {
	drawStatus(view);
	drawHistory(view);
	drawBoard(view);
	drawPanels(view);
}

function debugPrint(txt) {
	dom.debug.innerText = txt;
}

export { render, debugPrint };
