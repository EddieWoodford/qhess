"use strict";

// Chess piece symbols, and the HTML that shows a piece's remaining possibilities in a square.
// Each symbol is a <span class="glyph glyph-{color}{type}">, e.g. glyph-wQ; style.css (section 7.4) colours them.

const SYMBOLS = {
// "white" unicode characters for pieces are outline. 
//	w: { K: "&#9812;", Q: "&#9813;", R: "&#9814;", B: "&#9815;", N: "&#9816;", P: "&#9817;" },
// "black" characters are filled in. We use them for both sides, and CSS style the difference
	w: { K: "&#9818;", Q: "&#9819;", R: "&#9820;", B: "&#9821;", N: "&#9822;", P: "&#9823;" },
	b: { K: "&#9818;", Q: "&#9819;", R: "&#9820;", B: "&#9821;", N: "&#9822;", P: "&#9823;" },
};

// HTML for one piece symbol: wave is the type ("K", "Q", ...), color is "w" or "b"
function glyphHTML(wave, color) {
	return '<span class="glyph glyph-' + color + ' glyph-' + color + wave + '">' + SYMBOLS[color][wave] + '</span>';
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
