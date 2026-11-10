// The rules' edge cases that the example games don't reach: en passant, promotion and potential check.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cloneState } from "../../src/engine/state.js";
import { applyMove, startMove } from "../../src/engine/game.js";
import { getPotentialMoves } from "../../src/engine/moves.js";
import { ismember } from "../../src/engine/utils.js";
import { move, play, at, sq } from "./helpers.js";

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
