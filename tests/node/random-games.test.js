// Random games played straight through the engine, checking after every ply what must always hold:
// the board and the piece lists agree, every piece can still be something, each army can still be completed
// (and is already collapsed as far as it goes), trying moves on a copy never changes the original,
// replaying the written history gives the same position, no move makes the engine fault, and the game
// ends exactly when the side to move has no legal turn. The seeds are fixed, so a failure always repeats.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, cloneState, getPieces } from "../../src/engine/state.js";
import { applyMove, startMove } from "../../src/engine/game.js";
import { getMoveDestinations } from "../../src/engine/castling.js";
import { findPotentialKings, findPCAttackers } from "../../src/engine/check.js";
import { filterOptionMatrix, getOM } from "../../src/engine/entanglement.js";
import { positionHash } from "../../src/engine/position-hash.js";
import { moveFromLine, historyAsLines } from "./helpers.js";

const GAMES = 100;
const MAX_PLIES = 80;

// Small seeded random number generator (as tests/generate.html), so a seed always gives the same game
function mulberry32(a) {
	return function () {
		a |= 0; a = a + 0x6D2B79F5 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}

function shuffle(list, rng) {
	const out = list.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** @returns {import("../../src/shared/protocol.js").Move} */
const blankMove = () => ({ notAKing: null, from: null, to: null, enPassant: false, promotion: false, castle: false,
	pcKing: null, pcAttackers: [], resign: false });

// Play the move on a copy; returns the copy, or null if it was refused. A refusal must be a rule, never a fault.
function tryMove(state, move) {
	const copy = cloneState(state);
	const result = applyMove(copy, move);
	if (!result.ok) {
		assert.doesNotMatch(result.error ?? "", /couldn't be played/, "engine fault on " + JSON.stringify(move));
		return null;
	}
	return copy;
}

// The answers to the move's questions (en passant, promotion, castle) as a list of every combination
const ANSWERS = [false, true].flatMap(enPassant => [false, true].flatMap(promotion =>
	[false, true].map(castle => ({ enPassant, promotion, castle }))));

// A random legal turn for the side to move, as { after: the state after it, move }, or null if there is none. Every move of
// every piece (with every answer, and with "Not a King" first when it can be declared) is tried before giving
// up, so null means the side to move really has no legal turn. Sometimes adds a potential check.
function randomTurn(state, rng) {
	const starts = state.turnNumber == 0 ? [blankMove()] : [];
	const notAKing = state.pcColor == state.turnColor && state.pcKing >= 0;
	for (const declare of notAKing ? shuffle([false, true], rng) : [false]) {
		if (state.turnNumber > 0) {
			const pieces = getPieces(state, state.turnColor).filter(p => p.captured == -1);
			for (const piece of pieces) {
				for (const to of getMoveDestinations(state, piece.coords())) {
					for (const answers of ANSWERS) {
						starts.push({ ...blankMove(), notAKing: declare ? pieceSquare(state) : null,
							from: piece.coords(), to, ...answers });
					}
				}
			}
		}
		for (const move of shuffle(starts, rng)) {
			const after = tryMove(state, move);
			if (after === null) { continue; }
			return (rng() < 0.4 ? withPotentialCheck(state, move, rng) : null) ?? { after, move };
		}
		starts.length = 0;
	}
	return null;
}

// The square of the piece the side to move is in potential check through (its declared king)
function pieceSquare(state) {
	return getPieces(state, state.turnColor)[state.pcKing].coords();
}

// The same turn with a potential check added on a random possible king, with a random set of its attackers;
// { after, move }, or null if none could be added
function withPotentialCheck(state, move, rng) {
	// The turn up to where the potential check is added (as playTurn takes it)
	const before = cloneState(state);
	if (move.notAKing) { return null; }
	if (state.turnNumber > 0 && !startMove(before, move.from, move.to, move).ok) { return null; }
	const kings = findPotentialKings(before);
	if (kings.length == 0) { return null; }
	const pcKing = kings[Math.floor(rng() * kings.length)];
	const king = before.board[pcKing[0]][pcKing[1]];
	if (king === null) { return null; }
	before.pcKing = king.i;
	before.pcColor = king.color;
	const attackers = findPCAttackers(before).filter(() => rng() < 0.6);
	const withPC = { ...move, pcKing, pcAttackers: attackers };
	const after = tryMove(state, withPC);
	return after && { after, move: withPC };
}

// Everything that must hold in any position
function checkPosition(state, label) {
	for (const color of ["w", "b"]) {
		const pieces = getPieces(state, color);
		assert.equal(pieces.length, 16, label);
		pieces.forEach((piece, i) => {
			assert.equal(piece.i, i, label + ": piece index");
			assert.equal(piece.color, color, label);
			if (piece.captured == -1) {
				assert.equal(state.board[piece.r][piece.c], piece, label + ": board and piece list agree");
				assert.notEqual(piece.waves(), "", label + ": a piece that can be nothing");
			}
		});
		// The army can still be completed, and the engine has already ruled out all it can
		const om = getOM(pieces);
		const filtered = filterOptionMatrix(om);
		assert.notEqual(filtered, null, label + ": " + color + " has no complete army");
		assert.deepEqual(filtered, om, label + ": " + color + " isn't collapsed as far as it goes");
	}
	let onBoard = 0;
	for (const row of state.board) {
		for (const piece of row) {
			if (piece === null) { continue; }
			onBoard++;
			assert.equal(piece.captured, -1, label + ": a captured piece on the board");
		}
	}
	const alive = [...state.pieces.w, ...state.pieces.b].filter(p => p.captured == -1).length;
	assert.equal(onBoard, alive, label + ": pieces missing from the board");
}

// Replaying the ply as written (onto `replay`, the game so far played from its written history) gives the same
// position and writes the same line
function checkReplay(replay, state, move, label) {
	const line = historyAsLines(state.history).at(-1) ?? "";
	const result = applyMove(replay, moveFromLine(line));
	assert.ok(result.ok, label + ": replaying " + line + " (played as " + JSON.stringify(move) + "): " + result.error);
	assert.equal(replay.history, state.history, label + ": replayed history");
	assert.equal(positionHash(replay), positionHash(state), label + ": replaying " + line + " (played as " + JSON.stringify(move) + ")");
}

for (let seed = 1; seed <= GAMES; seed++) {
	test("random game, seed " + seed, () => {
		const rng = mulberry32(seed);
		let state = createInitialState();
		const replay = createInitialState();
		for (let ply = 0; ply < MAX_PLIES && state.result === null; ply++) {
			const label = "seed " + seed + ", ply " + ply;
			const hashBefore = positionHash(state);
			const next = randomTurn(state, rng);
			assert.equal(positionHash(state), hashBefore, label + ": trying moves changed the original");
			if (next === null) {
				assert.fail(label + ": the game goes on, but no legal turn was found");
			}
			state = next.after;
			checkPosition(state, label);
			checkReplay(replay, state, next.move, label);
		}
		if (state.result == "checkmate" || state.result == "stalemate") {
			// The game ended: the side to move really has no legal turn (looked for as if it hadn't ended)
			const reopened = { ...cloneState(state), result: null };
			assert.equal(randomTurn(reopened, rng), null, "seed " + seed + ": " + state.result + " with a legal turn left");
		}
	});
}
