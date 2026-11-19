"use strict";

// The HTML that shows a piece's remaining possibilities in a square.
// Each symbol is an empty <span class="glyph glyph-{color} glyph-{color}{type}">, e.g. glyph-w glyph-wQ: style.css
// (sections 1.1 and 7.4) draws the symbol itself, as the board theme picks White's symbols (outline or filled).

// HTML for one piece symbol: wave is the type ("K", "Q", ...), color is "w" or "b". lost: a type the move being
// made has just ruled out, shown faded until it is submitted (style.css 7.4 .glyph-lost)
function glyphHTML(wave, color, lost = false) {
	return '<span class="glyph glyph-' + color + ' glyph-' + color + wave + (lost ? " glyph-lost" : "") + '"></span>';
}

// HTML for a piece with the given waves (e.g. "KQRP") and color ("w"/"b"):
// a 3x2 grid of the possible types (K Q R / B N P), or one large symbol once fully collapsed.
// lost: the types the move being made has ruled out (e.g. "BN"), still shown in the grid, faded, until it is
// submitted; so a piece the move collapses keeps its grid until then.
// The grid (style.css 7.4) places one element per cell, so a type that is not possible is an empty <span>:
// loose text would merge with its neighbours into one cell and shift the rest.
function waveHTML(waves, color, lost = "") {
	const side = color == "w" ? "whitepiece" : "blackpiece";
	if (waves.length == 1 && lost == "") {
		return '<div class="' + side + 'collapsed">' + glyphHTML(waves, color) + '</div>';
	}
	const cell = wave => waves.includes(wave) ? glyphHTML(wave, color)
		: lost.includes(wave) ? glyphHTML(wave, color, true) : "<span></span>";
	return '<div class="' + side + '">' + [..."KQRBNP"].map(cell).join("") + '</div>';
}

export { glyphHTML, waveHTML };
