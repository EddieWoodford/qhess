// The rules' edge cases that the example games don't reach: en passant, promotion and potential check.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, cloneState } from "../../src/engine/state.js";
import { applyMove, startMove, declareNotAKing, hasLegalTurn } from "../../src/engine/game.js";
import { getPotentialMoves } from "../../src/engine/moves.js";
import { updateOptionsFromEntanglement } from "../../src/engine/entanglement.js";
import { ismember } from "../../src/engine/utils.js";
import { move, play, at, sq, exampleGames, moveFromLine } from "./helpers.js";

////////////////////////////////
// En passant
////////////////////////////////

// Black's e-piece is on e4, beside where White's d-piece lands after d2-d4
const blackOnE4 = [["a2", "a3"], ["e7", "e5"], ["b2", "b3"], ["e5", "e4"]];

test("a piece that steps two squares can be taken en passant", () => {
	const state = play(...blackOnE4, ["d2", "d4"]);
	assert.ok(ismember(sq("d3"), getPotentialMoves(state, sq("e4"), "P")));
	assert.deepEqual(applyMove(state, move("e4", "d3", { enPassant: true })), { ok: true });
	assert.equal(at(state, "d4"), null);
	assert.equal(at(state, "d3").waves(), "P");
	assert.match(state.history, /e4xd3\(P\) e\.p\.$/);
});

test("en passant is only offered on the very next move", () => {
	const state = play(...blackOnE4, ["d2", "d4"], ["h7", "h6"], ["h2", "h3"]);
	assert.ok(!ismember(sq("d3"), getPotentialMoves(state, sq("e4"), "P")));
});

test("a potential check that rules out the stepping piece's pawn also rules out en passant", () => {
	// d2-d4 then a potential check on d7 by the d4 piece, which leaves it a queen or rook: not a pawn.
	// (Taking it en passant used to make the pawn of a piece that can't be one, and throw.)
	const state = play(...blackOnE4, ["d2", "d4", { pcKing: sq("d7"), pcAttackers: [sq("d4")] }]);
	assert.equal(at(state, "d4").waves(), "QR");
	assert.ok(!ismember(sq("d3"), getPotentialMoves(state, sq("e4"), "P")));
	// e4-d3 is still a move (as a queen), but takes nothing, and isn't asked about
	const trial = cloneState(state);
	const result = startMove(trial, sq("e4"), sq("d3"), { ask: () => assert.fail("shouldn't ask about en passant") });
	assert.equal(result.ok, true);
	assert.equal(result.enPassant, false);
	assert.equal(at(trial, "d4").captured, -1);
	assert.equal(at(trial, "d3").waves(), "Q");
	// Black still has a game: the d7 piece steps off the d-file
	assert.equal(state.result, null);
	assert.deepEqual(applyMove(state, move("d7", "e6")), { ok: true });
});

test("a pawn can't take its own side's piece en passant", () => {
	// After e2-e4, the d2 piece could step diagonally onto e3 as a king, queen or bishop, but not as a pawn
	const state = play(["e2", "e4"]);
	const trial = cloneState(state);
	trial.turnColor = "w"; // as if White moved again
	const result = startMove(trial, sq("d2"), sq("e3"), { ask: () => assert.fail("shouldn't ask about en passant") });
	assert.equal(result.ok, true);
	assert.equal(result.enPassant, false);
	assert.ok(!at(trial, "e3").waves().includes("P"));
});

////////////////////////////////
// Promotion
////////////////////////////////

// The example promotion game, up to (not including) the first ply that contains `text`
function promotionGameBefore(text) {
	const { lines } = exampleGames().find(g => g.name == "05_promotion.txt");
	const state = createInitialState();
	for (const line of lines) {
		if (line.includes(text)) { return state; }
		assert.deepEqual(applyMove(state, moveFromLine(line)), { ok: true }, line);
	}
	assert.fail("no ply " + text);
}

test("a promoted pawn could be a queen, rook, knight, or the bishop for its square", () => {
	// White's h7 piece can only be a pawn, so stepping onto h8 (a dark square) promotes it without asking
	const state = promotionGameBefore("h7h8");
	const result = startMove(state, sq("h7"), sq("h8"), { ask: () => assert.fail("shouldn't ask") });
	assert.equal(result.promotion, true);
	const piece = at(state, "h8");
	assert.equal(piece.promoted, 1);
	assert.equal(piece.waves(), "QBNR");
	assert.equal(piece.wavesWithBishopColor(), "QBbNR"); // (the Captured tab shows the bishop's square from this)
	assert.match(state.thisMove, /h7h8\(P\)=\(QRNB\)/);
	// It is still counted as the pawn it was, so the army adds up
	assert.deepEqual(piece.options.slice(8), [0, 0, 0, 0, 0, 0, 0, 0]);
});

////////////////////////////////
// Potential check
////////////////////////////////

test("a potential check must be answered: by moving out of it, blocking, or 'Not a King'", () => {
	// Black's move 0: the e7 piece sees e2 straight down the empty e-file, as a rook or queen
	const state = createInitialState();
	assert.deepEqual(applyMove(state, move(null, null, { pcKing: sq("e2"), pcAttackers: [sq("e7")] })), { ok: true });
	assert.equal(state.history, "0b. <e2+ e7>");
	assert.equal(at(state, "e7").waves(), "QR");
	assert.equal(state.potCheck, true);
	// Ignoring it isn't allowed
	assert.deepEqual(applyMove(cloneState(state), move("a2", "a3")), { ok: false, error: "the move leaves the mover in check" });
	// Blocking it is (d2 steps diagonally onto e3)
	assert.deepEqual(applyMove(cloneState(state), move("d2", "e3")), { ok: true });
	// So is declaring that e2 isn't the king, and then making any move
	const declared = cloneState(state);
	assert.deepEqual(applyMove(declared, move("a2", "a3", { notAKing: sq("e2") })), { ok: true });
	assert.ok(!at(declared, "e2").waves().includes("K"));
	assert.match(declared.history, /\r\n1w\. \[e2\]\(KQBNRP\)a2a3\(KQRP\)$/);
});

test("a potential check needs an attacker", () => {
	const state = createInitialState();
	const result = applyMove(state, move(null, null, { pcKing: sq("e2") }));
	assert.deepEqual(result, { ok: false, error: "the potential check has no attacker" });
});

test("'Not a King' can't be declared on a piece that must be the king", () => {
	// White to move, in potential check on e2, with every other White piece ruled out as the king
	const state = play(["a2", "a3"]);
	const king = at(state, "e2");
	for (const piece of state.pieces.w) {
		if (piece !== king) { piece.removewaves("K"); }
	}
	updateOptionsFromEntanglement(state, "w");
	assert.equal(king.waves(), "K");
	Object.assign(state, { turnColor: "w", pcKing: king.i, pcColor: "w" });
	assert.deepEqual(declareNotAKing(cloneState(state)), { ok: false, error: "the piece on e2 must be the king" });
	assert.equal(hasLegalTurn(state), true);
});

////////////////////////////////
// Moves from outside the engine (the network, a pasted history)
////////////////////////////////

test("applyMove refuses anything that isn't a move, without throwing", () => {
	const afterMove0 = play();
	const junk = [
		null,
		"e2e4",
		{ from: [9, 9], to: [4, 4] },
		{ from: "e2", to: "e4" },
		{ from: [6, 4.5], to: [4, 4] },
		{ from: [6, 4], to: [4, 4], pcKing: [1, 4], pcAttackers: "e4" },
		{ from: [6, 4], to: [4, 4], pcKing: [1, 4], pcAttackers: [[1]] },
		{ from: [6, 4] },
		{ from: [5, 4], to: [4, 4] }, // an empty square
	];
	for (const m of junk) {
		const result = applyMove(cloneState(afterMove0), m);
		assert.equal(result.ok, false, JSON.stringify(m));
		assert.equal(typeof result.error, "string");
	}
});

test("applyMove refuses a move that needs an answer it wasn't given", () => {
	// e4xd3 could be en passant or a queen's move: leaving enPassant out (and no ask) can't be played
	const state = play(...blackOnE4, ["d2", "d4"]);
	const result = applyMove(cloneState(state), { from: sq("e4"), to: sq("d3") });
	assert.equal(result.ok, false);
	assert.match(result.error, /En passant\?/);
});
