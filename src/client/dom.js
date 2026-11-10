"use strict";

// Every fixed element of the page that the code uses, looked up once. (The board's squares are made by
// board-view.js buildBoard, which keeps its own references to them.)
// Modules load after the page has been parsed, so the elements exist when this runs.

const $ = id => document.getElementById(id);

const dom = {
	board: $("board"),

	// Status area
	prompt: $("prompt"),
	sideButton1: $("sideButton1"),
	sideButton2: $("sideButton2"),
	stagedMove: $("thismove"),

	// History tab
	history: $("movehistory"),
	stepButtons: { back2: $("back2"), back1: $("back1"), forward1: $("forward1"), forward2: $("forward2") },
	historyButtons: [...document.querySelectorAll(".historyButton")],

	// Find Pieces tab: for each piece type, its button and the element holding its symbol
	findButtons: Object.fromEntries([..."KQRBNP"].map(w => [w, { button: $("find" + w), symbol: $("find" + w + "piece") }])),
	whiteCaptured: $("whitecaptured"),
	blackCaptured: $("blackcaptured"),

	debug: $("debug"),
};

// Show or hide an element while keeping its place in the layout (so the things around it don't move)
function setVisible(el, visible) {
	el.classList.toggle("invisible", !visible);
}

export { dom, setVisible };
