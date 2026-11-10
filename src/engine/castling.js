"use strict";

// Castling. Pure functions of the game state; no page code.
//
// A piece may castle if it could still be the king and has never moved. It moves 2 squares sideways along
// its own rank, over an empty square onto an empty square. The rook is the first piece beyond the king's
// landing square: either right next to it, or one further with an empty square between (as in ordinary
// queenside castling). It must be the same colour, never have moved, and could still be a rook. It jumps to
// the square the king passed over. Castling collapses the king piece to K and the rook piece to R, which
// must leave a complete army. The king can't castle out of, through, or into check, judged as though the
// king piece were already collapsed to K.
//
// Castling is kept out of moves.js getPotentialMoves on purpose: that also answers "what does this piece
// attack" for check.js, and testing for check here calls check.js, so the two would call each other.

import { isValidCoord, ismember } from "./utils.js";
import { cloneState } from "./state.js";
import { getPotentialMoves } from "./moves.js";
import { findChecks } from "./check.js";
import { updateOptionsFromEntanglement } from "./entanglement.js";

// Can this piece take part in a castle as `wave` ("K" or "R")?
function unmovedCandidate(piece, color, wave) {
	return piece !== null && piece.color == color && piece.captured == -1 && piece.hasmoved == 0
		&& piece.promoted == 0 && piece.waves().includes(wave);
}

// The castles the board layout allows for the piece on `from`, before any check is considered.
// Returns a list of { kingTo, rookFrom, rookTo }.
function castlingLayouts(state, from) {
	const [r, c] = from;
	const king = state.board[r][c];
	if (!unmovedCandidate(king, king?.color, "K")) { return []; }
	const at = col => state.board[r][col];
	const layouts = [];
	for (const d of [1, -1]) {
		const pass = [r, c + d];
		const land = [r, c + 2 * d];
		if (!isValidCoord(land) || at(pass[1]) !== null || at(land[1]) !== null) { continue; }
		// The nearest piece beyond the landing square, if it is one or two squares away
		let rookFrom = null;
		for (const dist of [3, 4]) {
			const sq = [r, c + dist * d];
			if (!isValidCoord(sq)) { break; }
			if (at(sq[1]) !== null) { rookFrom = sq; break; }
		}
		if (rookFrom === null || !unmovedCandidate(at(rookFrom[1]), king.color, "R")) { continue; }
		layouts.push({ kingTo: land, rookFrom, rookTo: pass });
	}
	return layouts;
}

// Is `color` in automatic check in this state?
function inAutoCheck(state, color) {
	return findChecks(state, color).autoCheck;
}

// Move a piece on the board of a (throwaway) state
function placePiece(state, from, to) {
	const piece = state.board[from[0]][from[1]];
	state.board[from[0]][from[1]] = null;
	state.board[to[0]][to[1]] = piece;
	piece.r = to[0];
	piece.c = to[1];
}

// Collapse the castling pieces of `state` (changed in place): the king piece to K and the rook piece to R.
// Returns false if no complete army allows it.
function collapseForCastle(state, from, rookFrom) {
	const king = state.board[from[0]][from[1]];
	const rook = state.board[rookFrom[0]][rookFrom[1]];
	king.removewaves("QBNRP");
	rook.removewaves("KQBNP");
	try {
		updateOptionsFromEntanglement(state, king.color);
	} catch {
		return false;
	}
	return king.waves() == "K" && rook.waves() == "R";
}

// The castles the piece on `from` can make now, check rules included. Returns a list of
// { kingTo, rookFrom, rookTo }. Doesn't change the state.
function getCastlingMoves(state, from) {
	const layouts = castlingLayouts(state, from);
	if (layouts.length == 0) { return []; }
	const color = state.board[from[0]][from[1]].color;
	const legal = [];
	for (const layout of layouts) {
		const collapsed = cloneState(state);
		if (!collapseForCastle(collapsed, from, layout.rookFrom)) { continue; }
		// Not out of check
		if (inAutoCheck(collapsed, color)) { continue; }
		// Not through check
		const passing = cloneState(collapsed);
		placePiece(passing, from, layout.rookTo);
		if (inAutoCheck(passing, color)) { continue; }
		// Not into check
		const landed = cloneState(collapsed);
		placePiece(landed, from, layout.kingTo);
		placePiece(landed, layout.rookFrom, layout.rookTo);
		if (inAutoCheck(landed, color)) { continue; }
		legal.push(layout);
	}
	return legal;
}

// Every square the piece on `coords` could move to: its ordinary moves and any castle. Doesn't change the state.
function getMoveDestinations(state, coords) {
	const moves = getPotentialMoves(state, coords);
	for (const castle of getCastlingMoves(state, coords)) {
		if (!ismember(castle.kingTo, moves)) { moves.push(castle.kingTo); }
	}
	return moves;
}

export { getCastlingMoves, getMoveDestinations };
