"use strict";

// Chess piece symbols and the HTML that shows a piece's remaining possibilities in a square.

// White pieces – richer, warmer, darker shades for visibility
const WK = "<span style='color:#FFD700'>&#9812;</span>"; // bright gold
const WQ = "<span style='color:#FF69B4'>&#9813;</span>"; // hot pink
const WR = "<span style='color:#1E90FF'>&#9814;</span>"; // dodger blue
const WB = "<span style='color:#FF4500'>&#9815;</span>"; // orange-red
const WP = "<span style='color:#32CD32'>&#9817;</span>"; // lime green
const WN = "<span style='color:#FFA500'>&#9816;</span>"; // orange

// Black pieces – softer, slightly glowing pastels to pop on dark squares
const BK = "<span style='color:#F0E68C'>&#9818;</span>"; // khaki
const BQ = "<span style='color:#BA55D3'>&#9819;</span>"; // medium orchid
const BR = "<span style='color:#87CEFA'>&#9820;</span>"; // light sky blue
const BB = "<span style='color:#FF6347'>&#9821;</span>"; // tomato
const BN = "<span style='color:#FFA07A'>&#9822;</span>"; // light salmon
const BP = "<span style='color:#90EE90'>&#9823;</span>"; // light green

// HTML for a piece with the given waves (e.g. "KQRP") and color ("w"/"b"):
// a 3x2 grid of the possible types (K Q R / B N P), or one large symbol once fully collapsed.
function waveHTML(waves, color) {
	let wavetext = "";
	let allwaves = "KQRBNP";
	for (let i = 0; i < 6; i++) {
		if (waves.includes(allwaves[i])) {
			wavetext = wavetext + allwaves[i];
		} else {
			wavetext = wavetext + "empty";
		}
		if (i == 2) { wavetext = wavetext + "<br>"; }
	}

	if (color == "w") {
		if (waves.length == 1) {
			wavetext = waves;
			wavetext = wavetext.replace(/^/, '<div class="whitepiececollapsed">');
		} else {
			wavetext = wavetext.replace(/^/, '<div class="whitepiece">');
		}
		wavetext = wavetext.replace(/$/, '</div>');
		// The letters are swapped for symbols one at a time, in this order. Each replace() only
		// changes the first match, and some symbol strings contain capital letters (e.g. the "B" in
		// WQ's colour), so changing the order could swap a letter inside an earlier symbol.
		wavetext = wavetext.replace("B", WB);
		wavetext = wavetext.replace("K", WK);
		wavetext = wavetext.replace("Q", WQ);
		wavetext = wavetext.replace("R", WR);
		wavetext = wavetext.replace("N", WN);
		wavetext = wavetext.replace("P", WP);
		wavetext = wavetext.replaceAll("empty", "&nbsp;");
	} else {
		if (waves.length == 1) {
			wavetext = waves;
			wavetext = wavetext.replace(/^/, '<div class="blackpiececollapsed">');
		} else {
			wavetext = wavetext.replace(/^/, '<div class="blackpiece">');
		}
		wavetext = wavetext.replace(/$/, '</div>');
		wavetext = wavetext.replace("B", BB);
		wavetext = wavetext.replace("K", BK);
		wavetext = wavetext.replace("Q", BQ);
		wavetext = wavetext.replace("R", BR);
		wavetext = wavetext.replace("N", BN);
		wavetext = wavetext.replace("P", BP);
		wavetext = wavetext.replaceAll("empty", "&nbsp;");
	}
	return wavetext;
}

export { WK, WQ, WR, WB, WN, WP, BK, BQ, BR, BB, BN, BP, waveHTML };
