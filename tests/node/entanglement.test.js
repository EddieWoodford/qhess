// The army collapse (src/engine/entanglement.js): a piece keeps an identity only if some complete army uses it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { filterOptionMatrix, updateOptionsFromEntanglement } from "../../src/engine/entanglement.js";
import { createInitialState } from "../../src/engine/state.js";

const full = n => Array.from({ length: n }, () => Array(n).fill(1));

// The answer worked out the slow way: keep (piece, identity) if any whole assignment (a permutation) uses it
function bruteForce(OM) {
	const n = OM.length;
	const out = OM.map(row => row.map(() => 0));
	let any = false;
	const used = Array(n).fill(false);
	const pick = Array(n);
	(function assign(r) {
		if (r == n) {
			any = true;
			pick.forEach((c, row) => { out[row][c] = 1; });
			return;
		}
		for (let c = 0; c < n; c++) {
			if (OM[r][c] == 1 && !used[c]) {
				used[c] = true;
				pick[r] = c;
				assign(r + 1);
				used[c] = false;
			}
		}
	})(0);
	return any ? out : null;
}

test("with nothing known, nothing is ruled out", () => {
	assert.deepEqual(filterOptionMatrix(full(16)), full(16));
});

test("an identity only one piece can have is that piece's, and no one else's", () => {
	const OM = full(4);
	OM[0] = [0, 0, 0, 1]; // piece 0 must be identity 3
	assert.deepEqual(filterOptionMatrix(OM), [
		[0, 0, 0, 1],
		[1, 1, 1, 0],
		[1, 1, 1, 0],
		[1, 1, 1, 0],
	]);
});

test("two pieces sharing the only two places for two identities use them up", () => {
	// Pieces 0 and 1 can only be identities 2 or 3, so nobody else can be either
	const OM = full(4);
	OM[0] = [0, 0, 1, 1];
	OM[1] = [0, 0, 1, 1];
	assert.deepEqual(filterOptionMatrix(OM), [
		[0, 0, 1, 1],
		[0, 0, 1, 1],
		[1, 1, 0, 0],
		[1, 1, 0, 0],
	]);
});

test("a matrix with no complete assignment gives null", () => {
	const OM = full(3);
	OM[0] = [1, 0, 0];
	OM[1] = [1, 0, 0]; // two pieces that can only be identity 0
	assert.equal(filterOptionMatrix(OM), null);
	assert.equal(filterOptionMatrix([[1, 1], [0, 0]]), null); // a piece that can be nothing
});

test("the matrix passed in is left as it was", () => {
	const OM = full(3);
	OM[0] = [0, 1, 0];
	const copy = OM.map(row => row.slice());
	filterOptionMatrix(OM);
	assert.deepEqual(OM, copy);
});

test("agrees with trying every assignment, on many random matrices", () => {
	// A small seeded random number generator, so a failure can be repeated
	let seed = 7;
	const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
	for (let trial = 0; trial < 1500; trial++) {
		const n = 2 + Math.floor(random() * 6); // 2 to 7 pieces
		const density = 0.25 + random() * 0.6;
		const OM = Array.from({ length: n }, () => Array.from({ length: n }, () => (random() < density ? 1 : 0)));
		assert.deepEqual(filterOptionMatrix(OM), bruteForce(OM), "trial " + trial + ": " + JSON.stringify(OM));
	}
});

test("a whole side is collapsed in place, and an impossible side throws", () => {
	const state = createInitialState();
	// Every White piece but e1 is ruled out as the king, so e1 must be the king
	for (const piece of state.pieces.w) {
		if (piece.r != 7 || piece.c != 4) { piece.removewaves("K"); }
	}
	updateOptionsFromEntanglement(state, "w");
	assert.equal(state.board[7][4].waves(), "K");
	// Black is untouched
	assert.ok(state.pieces.b.every(p => p.waves().includes("K")));
	// Ruling e1 out as well leaves White with no king at all
	state.board[7][4].removewaves("K");
	assert.throws(() => updateOptionsFromEntanglement(state, "w"), /no complete army fits the White pieces/);
});
