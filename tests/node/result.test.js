// Checkmate and stalemate: endTurn sets state.result when the side to move has no legal turn.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../../src/engine/state.js";
import { applyMove, refreshChecks, gameResult, hasLegalTurn } from "../../src/engine/game.js";
import { coordstext2coords as sq } from "../../src/engine/utils.js";
import { exampleGames, moveFromLine } from "./helpers.js";

// Option indexes for each type (see constants.js)
const IDS = { P: [0, 1, 2, 3, 4, 5, 6, 7], R: [8, 9], N: [10, 11], B: [12, 13], Q: [14], K: [15] };

// A fully collapsed position, `turnColor` to move. placed: { w: { e1: "K", ... }, b: { ... } }.
// Each side's other pieces are captured, with the identities left over.
function position(turnColor, placed) {
	const state = createInitialState();
	state.turnNumber = 30;
	state.turnColor = turnColor;
	state.thisMove = "30" + turnColor + ". ";
	state.board = Array.from({ length: 8 }, () => Array(8).fill(null));
	for (const color of ["w", "b"]) {
		const pieces = state.pieces[color];
		const used = new Set();
		const oneHot = id => { used.add(id); return Array.from({ length: 16 }, (_, i) => (i == id ? 1 : 0)); };
		let pi = 0;
		for (const [square, type] of Object.entries(placed[color])) {
			const piece = pieces[pi++];
			piece.options = oneHot(IDS[type].find(id => !used.has(id)));
			[piece.r, piece.c] = sq(square);
			piece.hasmoved = 1;
			state.board[piece.r][piece.c] = piece;
		}
		for (; pi < 16; pi++) {
			pieces[pi].options = oneHot([...Array(16).keys()].find(id => !used.has(id)));
			pieces[pi].captured = 1;
		}
	}
	refreshChecks(state, turnColor);
	return state;
}

test("a king with nowhere to go, not in check, is stalemate", () => {
	const state = position("b", { w: { c7: "Q", h1: "K" }, b: { a8: "K" } });
	assert.equal(state.autoCheck, false);
	assert.equal(gameResult(state), "stalemate");
});

test("a king in check with nowhere to go is checkmate", () => {
	const state = position("b", { w: { b7: "Q", c6: "K" }, b: { a8: "K" } });
	assert.equal(state.autoCheck, true);
	assert.equal(gameResult(state), "checkmate");
});

test("taking the checking piece is a way out", () => {
	// The queen on b7 isn't protected
	const state = position("b", { w: { b7: "Q", h1: "K" }, b: { a8: "K" } });
	assert.equal(state.autoCheck, true);
	assert.equal(gameResult(state), null);
});

test("any other piece's move is enough to avoid stalemate", () => {
	const state = position("b", { w: { c7: "Q", h1: "K" }, b: { a8: "K", h7: "P" } });
	assert.equal(gameResult(state), null);
	// ... unless it is blocked
	const blocked = position("b", { w: { c7: "Q", h1: "K", h6: "P" }, b: { a8: "K", h7: "P" } });
	assert.equal(gameResult(blocked), "stalemate");
});

test("blocking the check is a way out", () => {
	// The rook on a1 checks the king on a8 along the a-file, and the queen on c7 covers a7, b7 and b8, so only
	// the black rook on b3 blocking on a3 saves it
	const state = position("b", { w: { a1: "R", c7: "Q", h1: "K" }, b: { a8: "K", b3: "R" } });
	assert.equal(state.autoCheck, true);
	assert.equal(gameResult(state), null);
	const noBlocker = position("b", { w: { a1: "R", c7: "Q", h1: "K" }, b: { a8: "K" } });
	assert.equal(gameResult(noBlocker), "checkmate");
});

test("Black's move 0 always has a legal turn", () => {
	assert.equal(hasLegalTurn(createInitialState()), true);
});

test("the example checkmate game ends in checkmate on its last move, and no move can follow", () => {
	const { lines } = exampleGames().find(g => g.name == "06_checkmate.txt");
	const state = createInitialState();
	lines.forEach((line, i) => {
		assert.deepEqual(applyMove(state, moveFromLine(line)), { ok: true }, line);
		assert.equal(state.result, i == lines.length - 1 ? "checkmate" : null, line);
	});
	assert.deepEqual(applyMove(state, moveFromLine("51b. (K)h8g8(K)")), { ok: false, error: "the game is over" });
});

test("the example stalemate game ends in stalemate on its last move", () => {
	const { lines } = exampleGames().find(g => g.name == "08_stalemate.txt");
	const state = createInitialState();
	lines.forEach((line, i) => {
		assert.deepEqual(applyMove(state, moveFromLine(line)), { ok: true }, line);
		assert.equal(state.result, i == lines.length - 1 ? "stalemate" : null, line);
	});
	assert.equal(state.autoCheck, false);
	assert.equal(state.pieces.b.filter(p => p.captured == -1).length, 1); // Black's lone king
});

test("no other example game ends", () => {
	for (const { name, lines } of exampleGames()) {
		if (name == "06_checkmate.txt" || name == "08_stalemate.txt") { continue; }
		const state = createInitialState();
		for (const line of lines) {
			applyMove(state, moveFromLine(line));
			assert.equal(state.result, null, name + " " + line);
		}
	}
});

test("the example castling game castles on both sides", () => {
	const { lines } = exampleGames().find(g => g.name == "07_castling.txt");
	const state = createInitialState();
	for (const line of lines) {
		assert.deepEqual(applyMove(state, moveFromLine(line)), { ok: true }, line);
	}
	// White castled e1-g1 with h1 (rook to f1); Black e8-c8 with b8 next to c8 (rook to d8). Both kings moved on.
	assert.equal(state.board[7][5].waves(), "R"); // f1
	assert.equal(state.board[0][3].waves(), "R"); // d8
	assert.equal(state.board[7][7].waves(), "K"); // h1
	assert.equal(state.board[0][1].waves(), "K"); // b8
});
