"use strict";

// The Find Pieces tab: the K Q R B N P buttons, and the lists of captured pieces.

import { glyphHTML } from "./glyphs.js";
import { dom } from "./dom.js";

// view: see render.js
function drawPanels(view) {
	drawFindButtons(view.game.turnColor, view.findPiece);
	drawCaptured(view.game);
}

// The find buttons show the side to move's pieces, and the one being searched for is highlighted
function drawFindButtons(turnColor, findPiece) {
	const removeClass = turnColor == "w" ? "blackpiececollapsed" : "whitepiececollapsed";
	const addClass = turnColor == "w" ? "whitepiececollapsed" : "blackpiececollapsed";
	for (const wave of "KQRNBP") {
		const { button, symbol } = dom.findButtons[wave];
		button.classList.toggle("findHighlight", wave == findPiece);
		symbol.classList.remove(removeClass);
		symbol.classList.add(addClass);
		symbol.innerHTML = glyphHTML(wave, turnColor);
	}
}

// Each side's captured pieces, in the order they were taken, numbered by the turn they were taken on
function drawCaptured(game) {
	let whitecaptured = "<strong>White Captured</strong><br>";
	let blackcaptured = "<strong>Black Captured</strong><br>";
	const whiteorder = game.pieces.w.map(p => p.captured);
	const blackorder = game.pieces.b.map(p => p.captured);
	for (let i=0; i <= game.turnNumber; i++) {
		let idx = whiteorder.indexOf(i);
		if (idx > -1) {whitecaptured = whitecaptured + i + '. ' + game.pieces.w[idx].wavesWithBishopColor() + "<br>";}
		idx = blackorder.indexOf(i);
		if (idx > -1) {blackcaptured = blackcaptured + i + '. ' + game.pieces.b[idx].wavesWithBishopColor() + "<br>";}
	}
	dom.whiteCaptured.innerHTML = whitecaptured;
	dom.blackCaptured.innerHTML = blackcaptured;
}

export { drawPanels };
