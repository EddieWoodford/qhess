// Castling: when it is offered, what it does to the pieces, and how it is written and replayed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, cloneState } from "../../src/engine/state.js";
import { applyMove, startMove } from "../../src/engine/game.js";
import { getCastlingMoves, getMoveDestinations } from "../../src/engine/castling.js";
import { updateOptionsFromEntanglement } from "../../src/engine/entanglement.js";
import { getHistoryLines, parseMoveText } from "../../src/engine/notation.js";
import { positionHash } from "../../src/engine/fingerprint.js";
import { coordstext2coords as sq, ismember } from "../../src/engine/utils.js";

// A move as applyMove takes it, from "e2" style squares
function move(from, to, extra = {}) {
	return { notAKing: null, from: from ? sq(from) : null, to: to ? sq(to) : null,
		enPassant: false, promotion: false, castle: false, pcKing: null, pcAttackers: [], ...extra };
}

// The position after Black's move 0 (a pass) and then the given plies, alternately White and Black
function play(...plies) {
	const state = createInitialState();
	assert.deepEqual(applyMove(state, move(null, null)), { ok: true });
	for (const ply of plies) {
		const [from, to, extra] = ply;
		assert.deepEqual(applyMove(state, move(from, to, extra)), { ok: true }, from + to);
	}
	return state;
}

const at = (state, square) => { const [r, c] = sq(square); return state.board[r][c]; };

// White clears f1 and g1; Black shuffles on the h- and a-files, away from White's back rank
const kingsideReady = () => play(
	["f2", "f4"], ["h7", "h6"], ["f1", "f3"], ["h6", "h5"],
	["g2", "g4"], ["a7", "a6"], ["g1", "g3"], ["a6", "a5"]);

test("castling is offered when the king and rook candidates are unmoved and the way is clear", () => {
	const state = kingsideReady();
	assert.deepEqual(getCastlingMoves(state, sq("e1")), [{ kingTo: sq("g1"), rookFrom: sq("h1"), rookTo: sq("f1") }]);
	assert.ok(ismember(sq("g1"), getMoveDestinations(state, sq("e1"))));
	// Any unmoved piece that could be the king can castle: h1 can, with e1 as its rook
	assert.deepEqual(getCastlingMoves(state, sq("h1")), [{ kingTo: sq("f1"), rookFrom: sq("e1"), rookTo: sq("g1") }]);
	assert.deepEqual(getCastlingMoves(state, sq("d1")), []);
});

test("castling collapses the king and rook pieces and moves both", () => {
	const state = kingsideReady();
	const result = startMove(state, sq("e1"), sq("g1"), { castle: true });
	assert.equal(result.ok, true);
	assert.equal(result.castle, true);
	assert.equal(result.movedIntoCheck, false);
	assert.equal(at(state, "g1").waves(), "K");
	assert.equal(at(state, "f1").waves(), "R");
	assert.equal(at(state, "e1"), null);
	assert.equal(at(state, "h1"), null);
	assert.equal(at(state, "f1").hasmoved, 1);
	assert.equal(state.thisMove, "5w. (KQBNRP)e1g1(K) O-O");
	// No other white piece can be the king any more
	for (const piece of state.pieces.w) {
		if (piece !== at(state, "g1")) { assert.ok(!piece.waves().includes("K")); }
	}
});

test("a move that could also be an ordinary move asks, and declining plays it as a non-king", () => {
	const state = kingsideReady();
	const asked = [];
	const result = startMove(state, sq("e1"), sq("g1"), { ask: q => { asked.push(q); return false; } });
	assert.deepEqual(asked, ["Castle?"]);
	assert.equal(result.castle, false);
	assert.equal(at(state, "g1").waves(), "QR");
	assert.equal(at(state, "h1").hasmoved, 0);
	assert.equal(state.thisMove, "5w. (KQBNRP)e1g1(QR)");
});

test("a king that can only castle there castles without being asked", () => {
	const state = kingsideReady();
	// Make the e1 piece the king (a complete army: no other white piece is the king)
	for (const piece of state.pieces.w) {
		if (piece !== at(state, "e1")) { piece.removewaves("K"); }
	}
	at(state, "e1").removewaves("QBNRP");
	updateOptionsFromEntanglement(state, "w");
	const result = startMove(state, sq("e1"), sq("g1"), { ask: () => assert.fail("shouldn't ask") });
	assert.equal(result.castle, true);
	assert.equal(at(state, "f1").waves(), "R");
	// ... and can't decline, as a king can't otherwise move two squares
	const declined = startMove(kingsideReadyWithKing(), sq("e1"), sq("g1"), { castle: false });
	assert.equal(declined.ok, false);
});

function kingsideReadyWithKing() {
	const state = kingsideReady();
	for (const piece of state.pieces.w) {
		if (piece !== at(state, "e1")) { piece.removewaves("K"); }
	}
	updateOptionsFromEntanglement(state, "w");
	return state;
}

test("a king or rook that has moved can't castle", () => {
	// The e1 piece steps to f1 and back
	const kingMoved = play(
		["f2", "f4"], ["h7", "h6"], ["f1", "f3"], ["h6", "h5"],
		["g2", "g4"], ["a7", "a6"], ["g1", "g3"], ["a6", "a5"],
		["e1", "f1"], ["h5", "h4"], ["f1", "e1"], ["a5", "a4"]);
	assert.ok(at(kingMoved, "e1").waves().includes("K"));
	assert.deepEqual(getCastlingMoves(kingMoved, sq("e1")), []);
	// The h1 piece goes up the h-file and back (h2 has gone up two squares)
	const rookMoved = play(
		["f2", "f4"], ["h7", "h6"], ["f1", "f3"], ["h6", "h5"],
		["g2", "g4"], ["a7", "a6"], ["g1", "g3"], ["a6", "a5"],
		["h2", "h4"], ["a5", "a4"], ["h1", "h3"], ["b7", "b6"], ["h3", "h1"], ["b6", "b5"]);
	assert.ok(at(rookMoved, "h1").waves().includes("R"));
	assert.deepEqual(getCastlingMoves(rookMoved, sq("e1")), []);
	assert.equal(startMove(rookMoved, sq("e1"), sq("g1"), { castle: true }).ok, false);
});

test("can't castle out of check", () => {
	// g1 hops to h3, leaving the h4-e1 diagonal open for the Black piece that reaches h4
	const state = play(
		["f2", "f4"], ["h7", "h6"], ["f1", "f3"], ["h6", "h5"],
		["g2", "g4"], ["a7", "a6"], ["g1", "h3"], ["h5", "h4"]);
	assert.ok(at(state, "h4").waves().includes("Q"));
	assert.deepEqual(getCastlingMoves(state, sq("e1")), []);
});

test("can't castle through check", () => {
	// A Black piece that could be a queen reaches h3, attacking f1 through g2 (but not e1 or g1;
	// a7 moves first, or it would see g1)
	const state = play(
		["a2", "a3"], ["a7", "a6"],
		["f2", "f4"], ["h7", "h6"], ["f1", "f3"], ["h6", "h5"],
		["g2", "g4"], ["h5", "h4"], ["g1", "g3"], ["h4", "h3"]);
	assert.ok(at(state, "h3").waves().includes("Q"));
	assert.deepEqual(getCastlingMoves(state, sq("e1")), []);
	// Without the h3 piece's queen possibility, the castle is back
	at(state, "h3").removewaves("Q");
	updateOptionsFromEntanglement(state, "b");
	assert.equal(getCastlingMoves(state, sq("e1")).length, 1);
});

test("can't castle into check", () => {
	// The a7 piece (which could be a queen or bishop) sees g1 along the open a7-g1 diagonal
	const state = play(
		["f2", "f4"], ["h7", "h6"], ["f1", "f3"], ["h6", "h5"],
		["g2", "g4"], ["d7", "d6"], ["g1", "g3"], ["d6", "d5"]);
	assert.deepEqual(getCastlingMoves(state, sq("e1")), []);
	assert.equal(startMove(cloneState(state), sq("e1"), sq("g1"), { castle: true }).ok, false);
	// The ordinary move is still there (and doesn't make e1 the king)
	assert.equal(startMove(state, sq("e1"), sq("g1"), { castle: false }).movedIntoCheck, false);
});

test("queenside: the rook can be next to the landing square, or one further with a gap", () => {
	// Clear d1 and c1: the rook candidate on b1 is next to c1
	const adjacent = play(
		["d2", "d4"], ["h7", "h6"], ["d1", "d3"], ["h6", "h5"],
		["c2", "c4"], ["h5", "h4"], ["c1", "c3"], ["a7", "a6"]);
	assert.deepEqual(getCastlingMoves(adjacent, sq("e1")), [{ kingTo: sq("c1"), rookFrom: sq("b1"), rookTo: sq("d1") }]);
	// Also clear b1: the rook candidate on a1 is the ordinary queenside rook
	const standard = play(
		["d2", "d4"], ["h7", "h6"], ["d1", "d3"], ["h6", "h5"],
		["c2", "c4"], ["h5", "h4"], ["c1", "c3"], ["a7", "a6"],
		["b2", "b4"], ["a6", "a5"], ["b1", "b3"], ["g7", "g6"]);
	assert.deepEqual(getCastlingMoves(standard, sq("e1")), [{ kingTo: sq("c1"), rookFrom: sq("a1"), rookTo: sq("d1") }]);
	assert.equal(startMove(standard, sq("e1"), sq("c1"), { castle: true }).castle, true);
	assert.equal(at(standard, "d1").waves(), "R");
	assert.equal(at(standard, "a1"), null);
	assert.match(standard.thisMove, /e1c1\(K\) O-O-O$/);
});

test("a castle is written in the history and replays from it", () => {
	const state = kingsideReady();
	assert.deepEqual(applyMove(state, move("e1", "g1", { castle: true })), { ok: true });
	assert.deepEqual(applyMove(state, move("a5", "a4")), { ok: true });
	const lines = getHistoryLines(state.history);
	assert.ok(lines.includes("5w. (KQBNRP)e1g1(K) O-O"));
	assert.equal(parseMoveText("5w. (KQBNRP)e1g1(K) O-O").castle, true);
	assert.equal(parseMoveText("5w. (KQBNRP)e1g1(QR)").castle, false);
	const replay = createInitialState();
	for (const line of lines) {
		const { turn, ...parsed } = parseMoveText(line);
		assert.deepEqual(applyMove(replay, parsed), { ok: true }, line);
	}
	assert.equal(positionHash(replay), positionHash(state));
});
