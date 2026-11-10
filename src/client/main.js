"use strict";

// Entry point for the page: wires up every button and starts the game.
// Loaded from index.html as <script type="module">, which runs after the page has been parsed.

import * as game from "./controller.js";
import { toggleFlippedBoard } from "./board-view.js";
import { setupModals, hideModal } from "./modals.js";
import { normalizeCode } from "../shared/protocol.js";

function onClick(id, handler) {
	document.getElementById(id).addEventListener("click", handler);
}

setupModals();

// Options modal
onClick("toggleFlippedBoard", () => toggleFlippedBoard());

// Side panel: hidden until the menu button (☰) opens it.
// style.css shows it when <body> has .panel-open: beside the board on wide screens, over it on tall ones.
function setPanelOpen(open) {
	document.body.classList.toggle("panel-open", open);
	document.getElementById("panelButton").setAttribute("aria-expanded", open);
}
onClick("panelButton", () => setPanelOpen(!document.body.classList.contains("panel-open")));
onClick("panelClose", () => setPanelOpen(false));
// On tall screens the panel is over a dimmed backdrop: tapping the backdrop closes it
document.getElementById("sidePanel").addEventListener("click", e => {
	if (e.target === e.currentTarget) {setPanelOpen(false);}
});
document.addEventListener("keydown", e => {
	if (e.key == "Escape") {setPanelOpen(false);}
});

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

// Multiplayer tab
onClick("mpCreate", () => {
	const color = document.querySelector("input[name=mpColor]:checked")?.value ?? "random";
	game.startMultiplayer({ create: color });
});
function joinFromInput() {
	const input = document.getElementById("mpCodeInput");
	const error = document.getElementById("mpJoinError");
	const code = normalizeCode(input.value);
	if (code === null) {
		error.textContent = "Codes look like TIGER-42";
		input.focus();
		return;
	}
	error.textContent = "";
	input.value = "";
	game.startMultiplayer({ join: code });
}
onClick("mpJoin", joinFromInput);
document.getElementById("mpCodeInput").addEventListener("keydown", e => {
	if (e.key == "Enter") {joinFromInput();}
});
onClick("mpCopyCode", () => {
	const code = document.getElementById("mpCode").textContent;
	navigator.clipboard?.writeText(code).catch(() => {});
});
onClick("mpLeave", () => {
	if (confirm("Leave this game? It ends the game for your opponent too.")) {
		game.leaveMultiplayer();
	}
});
onClick("mpBack", () => game.backToSinglePlayer());

// Make the board's squares and start the first game
game.init();
