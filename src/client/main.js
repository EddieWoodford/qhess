"use strict";

// Entry point for the page: wires up every button and starts the game.
// Loaded from index.html as <script type="module">, which runs after the page has been parsed.

import * as game from "../../script.js";
import { setupModals } from "../../ui.js";

function onClick(id, handler) {
	document.getElementById(id).addEventListener("click", handler);
}

setupModals();

// Options modal
onClick("toggleFlippedBoard", () => game.toggleFlippedBoard());

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
onClick("restorehistory", () => game.restoreGameHistory());
onClick("copyallhistory", () => game.copyAllHistory());
onClick("copylastmove", () => game.copyLastMove());
onClick("pasteallrestore", () => game.pasteAllRestore());
onClick("pastelinerestore", () => game.pasteLineRestore());

// Find-piece buttons
for (const wave of "KQRBNP") {
	onClick("find" + wave, () => game.findPiecesClick(wave));
}

game.setup();
