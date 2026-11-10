// Reading the move history (src/engine/notation.js): splitting text into plies, and reading each ply. Pasted
// or edited text can be anything, so neither may ever throw.

import { test } from "node:test";
import assert from "node:assert/strict";
import { getHistoryLines, parseMoveText } from "../../src/engine/notation.js";
import { createInitialState } from "../../src/engine/state.js";
import { applyMove } from "../../src/engine/game.js";
import { sq } from "./helpers.js";

test("history text splits into plies however it is laid out", () => {
	const plies = ["0b.", "1w. (KQBNRP)e2e4(QRP)", "1b. (KQBNRP)h7h6(KQRP)"];
	assert.deepEqual(getHistoryLines(plies.join("\n")), plies);
	assert.deepEqual(getHistoryLines(plies.join("\r\n") + "\r\n"), plies);
	assert.deepEqual(getHistoryLines(plies.join(" ")), plies);
	assert.deepEqual(getHistoryLines(plies.join("")), plies);
	// A ply wrapped across lines is joined back up
	assert.deepEqual(getHistoryLines("0b.\n1w. (KQBNRP)e2\ne4(QRP)"), ["0b.", "1w. (KQBNRP)e2e4(QRP)"]);
});

test("turn labels past 9 split in the right places", () => {
	// "11w." contains "1w.": each label must be found where it is, not where its text first appears
	const plies = ["1w. (KQBNRP)a2a3(KQRP)", "1b. (KQBNRP)a7a6(KQRP)", "11w. (KQRP)a3a4(KQRP)", "11b. (KQRP)a6a5(KQRP)"];
	assert.deepEqual(getHistoryLines(plies.join("")), plies);
});

test("empty text has no plies; text without turn labels is one ply, kept so it can be reported", () => {
	assert.deepEqual(getHistoryLines(""), []);
	assert.deepEqual(getHistoryLines("  \r\n \n"), []);
	assert.deepEqual(getHistoryLines("hello"), ["hello"]);
	assert.deepEqual(getHistoryLines("My game:\n0b.\n1w. (KQBNRP)e2e4(QRP)"), ["My game:", "0b.", "1w. (KQBNRP)e2e4(QRP)"]);
});

test("a ply is read into a move", () => {
	assert.deepEqual(parseMoveText("12w. [d2](KQRP)e2xe4(QR)+<e8+ e4 h5>"), {
		turn: "12w", notAKing: sq("d2"), from: sq("e2"), to: sq("e4"),
		enPassant: false, promotion: false, castle: false, pcKing: sq("e8"), pcAttackers: [sq("e4"), sq("h5")],
	});
	assert.deepEqual(parseMoveText("0b. "), {
		turn: "0b", notAKing: null, from: null, to: null,
		enPassant: false, promotion: false, castle: false, pcKing: null, pcAttackers: [],
	});
	const move0 = parseMoveText("0b. <e2+ e7>");
	assert.deepEqual([move0.from, move0.pcKing, move0.pcAttackers], [null, sq("e2"), [sq("e7")]]);
	assert.equal(parseMoveText("3w. (QRP)e5xd6(P) e.p.").enPassant, true);
	assert.equal(parseMoveText("54w. (P)h7h8(P)=(QRNB)+<h2+ h8>").promotion, true);
	assert.equal(parseMoveText("5w. (KQBNRP)e1c1(K) O-O-O").castle, true);
});

test("a ply typed by hand is read too", () => {
	const expected = { from: sq("e2"), to: sq("e4") };
	for (const text of ["1w. e2e4", "1w. e2 e4", "1w.  (KQBNRP) e2 x e4 (QRP) ", "1w. (KQBNRP e2e4"]) {
		const move = parseMoveText(text);
		assert.deepEqual({ from: move.from, to: move.to }, expected, text);
	}
	assert.deepEqual(parseMoveText("2b. (Q)c6d6(Q)<b2+   b7 >").pcAttackers, [sq("b7")]);
});

test("a ply that can't be read never throws, and gives a move applyMove refuses", () => {
	const afterMove0 = () => {
		const state = createInitialState();
		applyMove(state, parseMoveText("0b. "));
		return state;
	};
	for (const text of ["", ".", "1w.", "1w. []e2e4", "1w. [z9](K)e2e4(K)", "1w. (K)e2e4(K)<>", "1w. (K)e2e4(K)<e8+ q0>", "hello", "1w. e2"]) {
		const move = parseMoveText(text);
		assert.equal(applyMove(afterMove0(), move).ok, false, text);
	}
});
