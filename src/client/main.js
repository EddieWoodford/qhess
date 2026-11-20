"use strict";

// Entry point for the page: wires up every button and starts the game.
// Loaded from index.html as <script type="module">, which runs after the page has been parsed.

import * as game from "./controller.js";
import * as tour from "./tour.js";
import { setFlippedBoard, setCoordsShown } from "./board-view.js";
import { setupModals, showModal, hideModal, showChoice } from "./modals.js";
import { setupSettings, resetSettings } from "./settings.js";
import { loadThemes, buildThemeList, themeById } from "./themes.js";
import { dom } from "./dom.js";
import { normalizeCode } from "../shared/protocol.js";
import { wakeServer } from "./server-address.js";
import { codeFromUrl, urlWithoutJoin, networkHost } from "./join-link.js";
import { setNetworkHost } from "./multiplayer-view.js";

// Opened from GitHub Pages: start the hosted multiplayer server waking now, so it's ready sooner
wakeServer();

function onClick(id, handler) {
	document.getElementById(id).addEventListener("click", handler);
}

setupModals();

// Settings tab: what each switch does (settings.js). The themes are read from themes/ first, and the tab's list of
// them filled, to show the theme on.
await loadThemes();
buildThemeList(dom.settings.theme);
setupSettings({
	// (the demo's bubble moves to its square's new place once the board has turned round)
	blackView: on => setFlippedBoard(on).then(() => tour.refresh()),
	potentialCheck: on => game.setPotentialCheckRule(on),
	hintLevel: level => game.setHintLevel(level),
	// The file letters and rank numbers around the board (style.css 7.4)
	showCoords: on => setCoordsShown(on),
	// The board's colours and how the pieces are drawn (style.css 1.1), and the page around it light or dark
	// (style.css 1, :root[data-theme="light"]). The page's mode is kept for index.html, to draw it before this runs.
	theme: id => {
		const page = themeById(id)?.page ?? "dark";
		document.documentElement.dataset.boardTheme = id;
		document.documentElement.dataset.theme = page;
		try { localStorage.setItem("qhess.themePage", page); } catch {}
	},
});

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
// (during the demo play-through, < and > step through it)
onClick("back2", () => tour.running() || game.stepBackAll());
onClick("back1", () => tour.running() ? tour.back() : game.stepBackMove());
onClick("forward1", () => tour.running() ? tour.next() : game.stepForwardMove());
onClick("forward2", () => tour.running() || game.stepForwardAll());
// A click on a line of the move history shows the position after that ply (history-view.js numbers the lines)
dom.history.addEventListener("click", e => {
	const line = e.target.closest(".historyLine");
	if (line) {game.jumpToPly(Number(line.dataset.ply));}
});

// History buttons. Wrapped in arrow functions so the click event isn't passed in as an argument
// (restoreGameHistory, for example, would treat it as the history text).

// Export copies the moves, and says so on the button for a moment. Where the page can't use the clipboard,
// it opens the Edit / Import dialog with the moves selected instead, to copy by hand. Resolves to whether it copied.
const EXPORT_LABEL = dom.exportButton.textContent;
let exportTimer;
async function exportGame() {
	if (await game.exportMoves()) {
		dom.exportButton.textContent = "Copied ✓";
		clearTimeout(exportTimer);
		exportTimer = setTimeout(() => { dom.exportButton.textContent = EXPORT_LABEL; }, 1500);
		return true;
	}
	game.openImport();
	showModal("import");
	dom.importText.select();
	return false;
}
onClick("exportButton", () => exportGame());

// Reset starts a new game. If this game's moves haven't been exported, it asks first: export and reset, reset
// anyway, or keep playing. If the moves can't be copied, the Edit / Import dialog opens to copy them by hand, and
// the game isn't reset.
onClick("reset", () => {
	tour.stop();
	if (!game.hasUnexportedMoves()) {
		game.newGame();
		return;
	}
	showChoice({
		text: "This game hasn't been exported, so its moves will be lost. Export it first?",
		yes: "Export, then reset",
		no: "Reset without exporting",
		cancel: "Keep playing",
	}, async answer => {
		if (answer === null) { return; }
		if (answer && !(await exportGame())) { return; }
		game.newGame();
	});
});

// Edit / Import dialog (modals.js opens it; this fills it with the current moves first)
onClick("importButton", () => { tour.stop(); game.openImport(); });
onClick("importLoad", () => {
	// A move that can't be played keeps the dialog open, saying which, so it can be put right
	const problem = game.importMoves();
	dom.importError.textContent = problem ?? "";
	if (problem === null) { hideModal("import"); }
});
onClick("importCancel", () => hideModal("import"));

// Settings tab: in a multiplayer game a Hint Level button asks the opponent instead of changing the player's own
// setting (caught before settings.js sees the click)
dom.settings.hintLevel.addEventListener("click", e => {
	const button = e.target.closest("[data-value]");
	if (button && game.isMultiplayer()) {
		e.stopImmediatePropagation();
		game.requestHintLevel(button.dataset.value);
	}
}, true);
onClick("hintWithdraw", () => game.cancelHintLevel());

// Settings tab: every setting back to its default (the theme follows the device again)
onClick("settingsReset", () => resetSettings());

// Rules dialog (modals.js opens it from the Info tab)
onClick("rulesClose", () => hideModal("rules"));

// Multiplayer tab
onClick("mpCreate", () => {
	tour.stop();
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
	tour.stop();
	game.startMultiplayer({ join: code });
}
onClick("mpJoin", joinFromInput);
document.getElementById("mpCodeInput").addEventListener("keydown", e => {
	if (e.key == "Enter") {joinFromInput();}
});
// Copy buttons say "Copied ✓" for a moment
function copyButton(button, text) {
	const label = button.dataset.label ??= button.textContent;
	navigator.clipboard?.writeText(text).then(() => {
		button.textContent = "Copied ✓";
		clearTimeout(button.copiedTimer);
		button.copiedTimer = setTimeout(() => { button.textContent = label; }, 1500);
	}).catch(() => {});
}
onClick("mpCopyCode", () => copyButton(dom.mp.copyCode, dom.mp.code.textContent));
onClick("mpCopyLink", () => copyButton(dom.mp.copyLink, dom.mp.link.href));
// Share… opens the device's own share sheet (messages, email, ...), where it has one: mostly phones
dom.mp.shareLink.hidden = !navigator.share;
onClick("mpShareLink", () => {
	navigator.share({ title: "Play Qhess with me", text: "Join my Qhess game (code " + dom.mp.code.textContent + "):",
		url: dom.mp.link.href }).catch(() => {});
});
// A page opened as localhost makes its join links with this computer's network address instead
networkHost().then(setNetworkHost);
onClick("mpLeave", () => {
	showChoice({ text: "Leave this game? It ends the game for your opponent too.", yes: "Leave game", no: "Stay" },
		leave => {
			if (leave) { game.leaveMultiplayer(); }
		});
});
onClick("mpBack", () => game.backToSinglePlayer());

// Opened from a join link: join that game, straight to the board. The code is taken out of the address, so a
// reload goes back into the game (from its saved seat) rather than trying to join it again.
const joinCode = codeFromUrl();
if (joinCode) {
	history.replaceState(null, "", urlWithoutJoin());
}

// Make the board's squares and start the first game
game.init(joinCode);

// The demo play-through: from the Info tab, and offered once to a new player (no game of their own yet)
onClick("tourButton", () => { setPanelOpen(false); tour.start(); });
const DEMO_OFFERED_KEY = "qhess.demoOffered";
let demoOffered = true;
try { demoOffered = localStorage.getItem(DEMO_OFFERED_KEY) !== null; localStorage.setItem(DEMO_OFFERED_KEY, "1"); } catch {}
if (!demoOffered && !joinCode && !game.isMultiplayer() && ["", "0b."].includes(game.loadSavedRecord().trim())) {
	showChoice({ text: "New to Qhess? Watch a short demo game: it shows how the pieces work things out as they move.",
		yes: "Watch the demo", no: "Just play" }, watch => { if (watch) { tour.start(); } });
}
