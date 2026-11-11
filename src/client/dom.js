"use strict";

// Every fixed element of the page that the code uses, looked up once. (The board's squares are made by
// board-view.js buildBoard, which keeps its own references to them.)
// Modules load after the page has been parsed, so the elements exist when this runs.

const $ = id => document.getElementById(id);

const dom = {
	board: $("board"),

	// Status bar, under the board
	prompt: $("prompt"),
	sideButton1: $("sideButton1"),
	sideButton2: $("sideButton2"),
	stagedMove: $("thismove"),

	// The banner over the board when the game ends
	gameOver: $("gameOver"),
	gameOverTitle: $("gameOverTitle"),
	gameOverDetail: $("gameOverDetail"),

	// History tab
	history: $("movehistory"),
	stepButtons: { back2: $("back2"), back1: $("back1"), forward1: $("forward1"), forward2: $("forward2") },
	historyButtons: [...document.querySelectorAll("#gameMetaTab .historyButton")],
	// the history buttons that would change the game: hidden in a multiplayer game
	localOnlyButtons: ["reset", "importButton"].map($),
	exportButton: $("exportButton"),
	importText: $("importText"), // the Edit / Import dialog's text box
	importError: $("importError"), // ... and why its moves couldn't be loaded

	// Captured tab
	whiteCaptured: $("whitecaptured"),
	blackCaptured: $("blackcaptured"),

	// Multiplayer tab (multiplayer-view.js), and the line above the prompt in a multiplayer game
	mpBadge: $("mpBadge"),
	mp: {
		start: $("mpStart"),
		game: $("mpGame"),
		ended: $("mpEnded"),
		code: $("mpCode"),
		invite: $("mpInvite"),
		link: $("mpLink"),
		qr: $("mpQr"),
		copyCode: $("mpCopyCode"),
		copyLink: $("mpCopyLink"),
		shareLink: $("mpShareLink"),
		codeInput: $("mpCodeInput"),
		joinError: $("mpJoinError"),
		message: $("mpMessage"),
		color: $("mpColor"),
		opponent: $("mpOpponent"),
		connection: $("mpConnection"),
		endedText: $("mpEndedText"),
		tabTitle: $("mpTabTitle"),
	},

	// Settings tab: one switch (checkbox) per setting
	settings: {
		blackView: $("settingBlackView"),
		colourByType: $("settingColourByType"),
		lightMode: $("settingLightMode"),
		potentialCheck: $("settingPotentialCheck"),
		showCoords: $("settingShowCoords"),
	},

	debug: $("debug"),
};

// Show or hide an element while keeping its place in the layout (so the things around it don't move)
function setVisible(el, visible) {
	el.classList.toggle("invisible", !visible);
}

export { dom, setVisible };
