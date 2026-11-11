"use strict";

// Reading the move-history notation. Pure functions; no game state, no page code.
//
// One ply looks like:   12w. [d2](KQRP)e2xe4(QR)+<e8+ e4 h5>
//   12w.          turn number and colour
//   [d2]          optional: "Not a King" declared on d2 (the opponent's potential-check king)
//   (KQRP)e2      waves before moving, and the start square
//   x             optional: capture
//   e4(QR)        end square, and waves after moving
//   then, optionally, one of
//     =(QRNB)       pawn promotion (in place of the waves after moving: "e8(P)=(QRNB)")
//     " e.p."       en passant
//     " O-O" / " O-O-O"  castled towards the h-file / the a-file
//   +             optional: automatic check
//   <e8+ e4 h5>   optional: potential check on the king at e8, by the attackers on e4 and h5
// On checkmate, the "+" of the check that mates is written "#" instead: "...e4(QR)#" or "<e8# e4 h5>".
// Black's move 0 has no move: "0b. ", or "0b. <e2+ e7>" with a potential check.

import { coordstext2coords } from "./utils.js";

// A turn label such as "12w.", where each ply starts
const TURN_LABEL = /\d+[bw]\./g;

// Take history text in various formats (one ply per line, or all run together) and return an array of trimmed
// plies, split wherever a turn label like "3w." starts. Any text before the first label is a ply of its own
// (so it is reported when it can't be played, rather than silently dropped). Empty text gives no plies.
function getHistoryLines(historyText) {
	// A ply can be wrapped across lines when pasted, so the lines are joined back up first
	const text = historyText.replace(/[\r\n]/g, "");
	const starts = [...text.matchAll(TURN_LABEL)].map(m => m.index);
	if (starts[0] !== 0) {
		starts.unshift(0);
	}
	return starts.map((start, i) => text.slice(start, starts[i + 1]).trim()).filter(line => line.length > 0);
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
// It never throws. A square that can't be read comes out as something that isn't a square (such as [NaN, NaN]),
// which game.js applyMove then refuses.
function parseMoveText(moveText) {
	// Split on the first "." only, so the "e.p." marker stays in the rest of the text
	const dotIdx = moveText.indexOf(".");
	const turn = moveText.slice(0, dotIdx).trim();
	let rest = moveText.slice(dotIdx + 1);

	const move = {
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

	// "[d2]": "Not a King" declaration
	const notAKing = /\[([^\]]*)\]?/.exec(rest);
	if (notAKing) {
		move.notAKing = coordstext2coords(notAKing[1].trim());
		rest = rest.slice(notAKing.index + notAKing[0].length);
	}
	// "<e8+ e4 h5>" (or "<e8# e4 h5>"): potential check. The first square is the king, the rest are attackers.
	const pc = /<([^>]*)>?/.exec(rest);
	if (pc) {
		const [king, ...attackers] = pc[1].replace(/[+#]/g, " ").trim().split(/\s+/);
		move.pcKing = coordstext2coords(king);
		move.pcAttackers = attackers.map(coordstext2coords);
		rest = rest.slice(0, pc.index);
	}
	// "(KQRP)e2xe4(QR)=(QRNB)+": the waves (letters in brackets) either side are dropped, leaving "e2xe4"
	const squares = /([a-h][1-8])\s*x?\s*([a-h][1-8])/.exec(rest.replace(/\([KQBNRP]*\)?/g, " "));
	if (squares) {
		move.from = coordstext2coords(squares[1]);
		move.to = coordstext2coords(squares[2]);
	}
	return move;
}

export { getHistoryLines, parseMoveText };
