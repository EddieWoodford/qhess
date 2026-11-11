"use strict";

// Each side's captured pieces, under the move history in the History tab. Drawn from the position being shown, so
// while stepping through the history they are the pieces captured by then.

import { glyphHTML } from "./glyphs.js";
import { dom } from "./dom.js";

// The swatch after a bishop symbol for the colour of square that bishop would be on
// (piece.wavesWithBishopColor: "Bw" = light-square bishop, "Bb" = dark-square bishop). style.css 6.5 colours it.
const BISHOP_SQUARE = {
	w: '<span class="bishop-square bishop-square-light" title="light-square bishop"></span>',
	b: '<span class="bishop-square bishop-square-dark" title="dark-square bishop"></span>',
};

// One captured piece: the turn it was taken on, then the types it could still have been, in the board's
// order (K Q R B N P), coloured as on the board. Each type is its own item so a long list can wrap.
function capturedEntryHTML(turn, piece) {
	const waves = piece.waves();
	const bishop = /B([wb])/.exec(piece.wavesWithBishopColor());
	const glyphs = [..."KQRBNP"].filter(w => waves.includes(w))
		.map(w => '<span class="captured-type">' + glyphHTML(w, piece.color)
			+ (w == "B" && bishop ? BISHOP_SQUARE[bishop[1]] : "") + '</span>')
		.join("");
	return '<div class="captured-entry"><span class="captured-turn">' + turn + '.</span>'
		+ '<span class="captured-glyphs">' + glyphs + '</span></div>';
}

// Each side's captured pieces, in the order they were taken, numbered by the turn they were taken on
function drawCaptured(game) {
	let whitecaptured = "<strong>White Captured</strong>";
	let blackcaptured = "<strong>Black Captured</strong>";
	const whiteorder = game.pieces.w.map(p => p.captured);
	const blackorder = game.pieces.b.map(p => p.captured);
	for (let i=0; i <= game.turnNumber; i++) {
		let idx = whiteorder.indexOf(i);
		if (idx > -1) {whitecaptured = whitecaptured + capturedEntryHTML(i, game.pieces.w[idx]);}
		idx = blackorder.indexOf(i);
		if (idx > -1) {blackcaptured = blackcaptured + capturedEntryHTML(i, game.pieces.b[idx]);}
	}
	dom.whiteCaptured.innerHTML = whitecaptured;
	dom.blackCaptured.innerHTML = blackcaptured;
}

// view: see render.js
function drawPanels(view) {
	drawCaptured(view.game);
}

export { drawPanels };
