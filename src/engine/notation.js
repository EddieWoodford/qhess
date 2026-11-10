"use strict";

// Reading the move-history notation. Pure functions; no game state, no page code.
//
// One ply looks like:   12w. [d2](KQRP)e2xe4(QR)=(QRNB)+<e8+ e4 h5> e.p.
//   12w.          turn number and colour
//   [d2]          optional: "Not a King" declared on d2 (the opponent's potential-check king)
//   (KQRP)e2      waves before moving, and the start square
//   x             optional: capture
//   e4(QR)        end square, and waves after moving
//   =(QRNB)       optional: pawn promotion
//   +             optional: automatic check
//   <e8+ e4 h5>   optional: potential check on the king at e8, by the attackers on e4 and h5
//   e.p.          optional: en passant
//   O-O / O-O-O   optional: castled towards the h-file / the a-file (after the end square's waves)

import { coordstext2coords } from "./utils.js";

// Take history text in various formats (one ply per line, or all run together)
// and return an array of trimmed plies, split wherever a turn label like "3w." starts
function getHistoryLines(historyText) {
	const splitOn = (slicable, ...indices) =>
		[0, ...indices].map((n, i, m) => slicable.slice(n, m[i + 1]).trim());

	historyText = historyText.replaceAll("\r", "");
	historyText = historyText.replaceAll("\n", "");
	let matches = historyText.match(/(\d+[bw]\.)/g);
	let idxs = [];
	for (let i = 0; i < matches.length; i++) {
		idxs.push(historyText.indexOf(matches[i]));
	}
	let historyLines = splitOn(historyText, ...idxs);
	historyLines = historyLines.filter((str) => str.length > 0);
	return historyLines;
}

// Parse one ply of notation into plain data:
// {
//   turn:        "12w"
//   notAKing:    [r,c] of the "Not a King" declaration, or null
//   from, to:    [r,c] of the move, or null if the ply has no move (Black's move 0)
//   enPassant:   true/false
//   promotion:   true/false
//   castle:      true/false
//   pcKing:      [r,c] of the potential-check king, or null
//   pcAttackers: list of [r,c] of the potential-check attackers
// }
function parseMoveText(moveText) {
	// Split on the first "." only, so the "e.p." marker stays in the rest of the text
	let dotIdx = moveText.indexOf(".");
	let turn = moveText.slice(0, dotIdx).trim();
	let rest = moveText.slice(dotIdx + 1).trim();

	let move = {
		turn,
		notAKing: null,
		from: null,
		to: null,
		enPassant: rest.includes("e.p."),
		promotion: rest.includes("="),
		castle: rest.includes("O-O"),
		pcKing: null,
		pcAttackers: [],
	};

	if (rest.includes("]")) {
		// "Not a King" declaration
		let parts = rest.split("]");
		move.notAKing = coordstext2coords(parts[0].replace("[", "").trim());
		rest = parts[1];
	}
	let pcText = [];
	if (rest.includes("<")) {
		// Potential check: "<king+ attacker attacker>"
		let parts = rest.split(">")[0].split("<");
		pcText = parts[1].split(" ");
		rest = parts[0];
	}
	if (rest.includes("(")) {
		// Drop the waves either side of the move: "(KQRP)e2xe4(QR)..." -> "e2xe4"
		rest = rest.split(")")[1].split("(")[0];
	}
	rest = rest.replace("x", "");
	if (rest.length >= 4) {
		// Now rest should be 4 chars long, such as h2h3, giving the from-to squares
		move.from = coordstext2coords(rest.substring(0, 2));
		move.to = coordstext2coords(rest.substring(2, 4));
	}
	if (pcText.length > 0) {
		// The first entry is the king ("e8+"), the rest are attackers
		move.pcKing = coordstext2coords(pcText[0]);
		for (let i = 1; i < pcText.length; i++) {
			move.pcAttackers.push(coordstext2coords(pcText[i].replace("+", "")));
		}
	}
	return move;
}

export { getHistoryLines, parseMoveText };
