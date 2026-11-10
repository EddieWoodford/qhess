"use strict";

// The Captured tab: each side's captured pieces.

import { dom } from "./dom.js";

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

// view: see render.js
function drawPanels(view) {
	drawCaptured(view.game);
}

export { drawPanels };
