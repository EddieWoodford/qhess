// Level 1: the rules engine on its own. Replays every example game through applyMove and checks the written
// history matches the file exactly and the position after every ply matches tests/snapshots.json.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, cloneState } from "../../src/engine/state.js";
import { applyMove } from "../../src/engine/game.js";
import { positionHash } from "../../src/engine/position-hash.js";
import { exampleGames, snapshots, moveFromLine, historyAsLines } from "./helpers.js";

const snaps = snapshots();

for (const { name, lines } of exampleGames()) {
	test("engine replays " + name, () => {
		const snap = snaps.games[name];
		assert.ok(snap, "no snapshot recorded for " + name);
		const state = createInitialState();
		lines.forEach((line, i) => {
			const result = applyMove(state, moveFromLine(line));
			assert.deepEqual(result, { ok: true }, "ply " + i + " (" + line + ")");
			assert.equal(positionHash(state), snap.plyHashes[i], "position after ply " + i + " (" + line + ")");
		});
		assert.equal(lines.length, snap.plyHashes.length, "number of plies");
		assert.deepEqual(historyAsLines(state.history), lines, "written history");
	});
}

test("cloneState gives an independent copy", () => {
	const { lines } = exampleGames()[0];
	const state = createInitialState();
	applyMove(state, moveFromLine(lines[0]));
	const before = positionHash(state);
	const copy = cloneState(state);
	applyMove(copy, moveFromLine(lines[1]));
	assert.equal(positionHash(state), before);
	assert.notEqual(positionHash(copy), before);
});

test("applyMove rejects a move by the wrong side", () => {
	const { lines } = exampleGames()[0];
	const state = createInitialState();
	applyMove(state, moveFromLine(lines[0])); // Black's move 0; White to move
	// A Black piece (row 1) trying to move
	const result = applyMove(cloneState(state), { notAKing: null, from: [1, 4], to: [2, 4], enPassant: false, promotion: false, castle: false, pcKing: null, pcAttackers: [] });
	assert.equal(result.ok, false);
});
