"use strict";

// The HTML that shows a piece's remaining possibilities in a square.
// Each symbol is an empty <span class="glyph glyph-{color} glyph-{color}{type}">, e.g. glyph-w glyph-wQ: style.css
// (sections 1.1 and 7.4) draws the symbol itself, as the board theme picks White's symbols (outline or filled).

// HTML for one piece symbol: wave is the type ("K", "Q", ...), color is "w" or "b"
function glyphHTML(wave, color) {
	return '<span class="glyph glyph-' + color + ' glyph-' + color + wave + '"></span>';
}

// HTML for a piece with the given waves (e.g. "KQRP") and color ("w"/"b"):
// a 3x2 grid of the possible types (K Q R / B N P), or one large symbol once fully collapsed.
function waveHTML(waves, color) {
	const side = color == "w" ? "whitepiece" : "blackpiece";
	if (waves.length == 1) {
		return '<div class="' + side + 'collapsed">' + glyphHTML(waves, color) + '</div>';
	}
	const cell = wave => waves.includes(wave) ? glyphHTML(wave, color) : "&nbsp;";
	return '<div class="' + side + '">'
		+ [..."KQR"].map(cell).join("") + "<br>"
		+ [..."BNP"].map(cell).join("")
		+ '</div>';
}

export { glyphHTML, waveHTML };
