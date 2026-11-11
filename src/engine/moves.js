"use strict";

// Where a piece could move. Pure functions of the game state; no page code.
// Coordinates are [row, column], with row 0 = rank 8: White's pieces move towards row 0.

import { isequal, isValidCoord, ismember } from "./utils.js";

// [row, column] steps for each kind of move. The order matters: it is the order of the lists below, which
// tests/generate.html's seeded games depend on.
const KING_STEPS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK_LINES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_LINES = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
const KNIGHT_JUMPS = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];

// The destinations the piece on `coords` could move to as every one of its waves (types): the squares it is
// certain to be able to reach, whichever it turns out to be.
function getCertainMoves(state, coords) {
	const piece = state.board[coords[0]][coords[1]];
	if (piece === null) {
		return [];
	}
	const [first = [], ...others] = [...piece.waves()].map(wave => getPotentialMoves(state, coords, wave));
	return first.filter(to => others.every(moves => ismember(to, moves)));
}

// Every square the piece on `coords` could move to (not counting castling: see castling.js) as at least one of
// `waves` (default: all its waves), e.g. getPotentialMoves(state, [6, 4], "P") for its pawn moves only.
// A square reachable as more than one wave can appear more than once.
function getPotentialMoves(state, coords, waves) {
	const piece = state.board[coords[0]][coords[1]];
	if (piece === null || piece.captured > -1) {
		return [];
	}
	if (waves === undefined) {
		waves = piece.waves();
	}
	const [r, c] = coords;
	const at = ([row, col]) => state.board[row][col];
	const moves = [];

	// One step or jump: onto any square that isn't one of its own pieces
	const step = ([dr, dc]) => {
		const to = [r + dr, c + dc];
		if (isValidCoord(to) && at(to)?.color != piece.color) {
			moves.push(to);
		}
	};
	// Along a line: up to the first piece in the way, taking it if it's the opponent's
	const slide = ([dr, dc]) => {
		for (let to = [r + dr, c + dc]; isValidCoord(to); to = [to[0] + dr, to[1] + dc]) {
			const target = at(to);
			if (target?.color == piece.color) {
				break;
			}
			moves.push(to);
			if (target !== null) {
				break;
			}
		}
	};

	if (waves.includes("K")) {
		KING_STEPS.forEach(step);
	}
	if (waves.includes("P")) {
		const forward = piece.color == "w" ? -1 : 1;
		// Forward onto an empty square; two squares on its first move if both are empty
		const ahead = [r + forward, c];
		if (isValidCoord(ahead) && at(ahead) === null) {
			moves.push(ahead);
			const twoAhead = [r + 2 * forward, c];
			if (piece.hasmoved == 0 && isValidCoord(twoAhead) && at(twoAhead) === null) {
				moves.push(twoAhead);
			}
		}
		// Diagonally forward to take: an opponent's piece, or en passant
		for (const dc of [-1, 1]) {
			const to = [r + forward, c + dc];
			if (isValidCoord(to) && (enPassantVictim(state, to, piece.color) !== null || (at(to) !== null && at(to).color != piece.color))) {
				moves.push(to);
			}
		}
	}
	if (waves.includes("R") || waves.includes("Q")) {
		ROOK_LINES.forEach(slide);
	}
	if (waves.includes("B") || waves.includes("Q")) {
		BISHOP_LINES.forEach(slide);
	}
	if (waves.includes("N")) {
		KNIGHT_JUMPS.forEach(step);
	}
	return moves;
}

// The piece a pawn of `color` would take en passant by landing on `coords`, or null if there isn't one.
// That is the opponent's piece that has just stepped two squares forward over `coords`, as long as it could
// still be a pawn: a potential check declared on the same move can rule its pawn out.
function enPassantVictim(state, coords, color) {
	if (state.epColor == "" || state.epColor == color || !isequal(coords, state.epCoords)) {
		return null;
	}
	// It stands one square on from the square it passed over, in its own direction of travel
	const r = coords[0] + (state.epColor == "w" ? -1 : 1);
	const piece = state.board[r][coords[1]];
	return piece !== null && piece.color == state.epColor && piece.waves().includes("P") ? piece : null;
}

export { getPotentialMoves, getCertainMoves, enPassantVictim };
