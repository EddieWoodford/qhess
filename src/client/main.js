"use strict";

// Entry point for the page: wires up every button and starts the game.
// Loaded from index.html as <script type="module">, which runs after the page has been parsed.

import * as game from "./controller.js";
import { toggleFlippedBoard } from "./board-view.js";
import { setupModals, hideModal } from "./modals.js";

function onClick(id, handler) {
	document.getElementById(id).addEventListener("click", handler);
}

setupModals();

// Options modal
onClick("toggleFlippedBoard", () => toggleFlippedBoard());

// Side buttons
onClick("sideButton1", () => game.sideButton1Click());
onClick("sideButton2", () => game.sideButton2Click());

// Replay stepping
onClick("back2", () => game.stepBackAll());
onClick("back1", () => game.stepBackMove());
onClick("forward1", () => game.stepForwardMove());
onClick("forward2", () => game.stepForwardAll());

// History buttons. Wrapped in arrow functions so the click event isn't passed in as an argument
// (restoreGameHistory, for example, would treat it as the history text).
onClick("reset", () => game.setup());
onClick("copyallhistory", () => game.copyAllHistory());
onClick("copylastmove", () => game.copyLastMove());
onClick("pasteallrestore", () => game.pasteAllRestore());
onClick("pastelinerestore", () => game.pasteLineRestore());

// Edit / Import dialog (modals.js opens it; this fills it with the current moves first)
onClick("importButton", () => game.openImport());
onClick("importLoad", () => { game.importMoves(); hideModal("import"); });
onClick("importCancel", () => hideModal("import"));

// Find-piece buttons
for (const wave of "KQRBNP") {
	onClick("find" + wave, () => game.findPiecesClick(wave));
}

// Make the board's squares and start the first game
game.init();
