"use strict";

import { getPieces } from "./state.js";

// Piece collapse: which identities each piece can still have, given that the whole army must
// still be assignable. Pure functions on 16x16 option matrices; no game state, no page code.

// What it does: for each colour, a (piece, identity) pair stays only if some complete
// assignment of the 16 identities to the 16 pieces uses it. This is Regin's AllDifferent
// filter: find one perfect matching, orient the edges, and keep an unmatched edge only if
// its two endpoints are in the same strongly connected component.
//
// One pass reaches the fixed point, because deleting edges that are in no perfect
// matching never changes the set of perfect matchings. No restart loop is needed.

// Pure helper (no globals, easy to test on its own).
// OM: square 0/1 matrix, rows = pieces, cols = identities (P1..P8, R1, R2, N1, N2, Bb, Bw, Q, K).
// Returns a NEW matrix with every pair that cannot appear in any perfect matching zeroed,
// or null if no perfect matching exists at all.
function filterOptionMatrix(OM) {
	const n = OM.length;

	// 1. Find one perfect matching with augmenting paths (Kuhn's algorithm).
	const matchOfRow = Array(n).fill(-1);
	const matchOfCol = Array(n).fill(-1);
	function augment(r, seen) {
		for (let c = 0; c < n; c++) {
			if (OM[r][c] !== 1 || seen[c]) { continue; }
			seen[c] = true;
			if (matchOfCol[c] === -1 || augment(matchOfCol[c], seen)) {
				matchOfCol[c] = r;
				matchOfRow[r] = c;
				return true;
			}
		}
		return false;
	}
	for (let r = 0; r < n; r++) {
		if (!augment(r, Array(n).fill(false))) {
			return null; // some piece can't be given an identity, so the matrix is impossible
		}
	}

	// 2. Directed graph on 2n nodes: rows are 0..n-1, columns are n..2n-1.
	// Matched edges point row -> column, unmatched edges point column -> row.
	// A cycle in this graph is an alternating cycle, so an unmatched edge lies on one
	// exactly when its endpoints are in the same strongly connected component.
	const adj = Array.from({ length: 2 * n }, () => []);
	for (let r = 0; r < n; r++) {
		for (let c = 0; c < n; c++) {
			if (OM[r][c] !== 1) { continue; }
			if (matchOfRow[r] === c) {
				adj[r].push(n + c);
			} else {
				adj[n + c].push(r);
			}
		}
	}

	// 3. Tarjan's strongly connected components (at most 32 nodes, so recursion is fine).
	const idx = Array(2 * n).fill(-1);
	const low = Array(2 * n).fill(0);
	const onStack = Array(2 * n).fill(false);
	const comp = Array(2 * n).fill(-1);
	const stack = [];
	let counter = 0;
	let nComp = 0;
	function strong(v) {
		idx[v] = low[v] = counter++;
		stack.push(v);
		onStack[v] = true;
		for (const w of adj[v]) {
			if (idx[w] === -1) {
				strong(w);
				low[v] = Math.min(low[v], low[w]);
			} else if (onStack[w]) {
				low[v] = Math.min(low[v], idx[w]);
			}
		}
		if (low[v] === idx[v]) {
			let w;
			do {
				w = stack.pop();
				onStack[w] = false;
				comp[w] = nComp;
			} while (w !== v);
			nComp++;
		}
	}
	for (let v = 0; v < 2 * n; v++) {
		if (idx[v] === -1) { strong(v); }
	}

	// 4. Keep matched edges, and unmatched edges whose endpoints share a component.
	const out = OM.map(row => Array(row.length).fill(0));
	for (let r = 0; r < n; r++) {
		for (let c = 0; c < n; c++) {
			if (OM[r][c] !== 1) { continue; }
			if (matchOfRow[r] === c || comp[r] === comp[n + c]) {
				out[r][c] = 1;
			}
		}
	}
	return out;
}

// Option matrix for a list of pieces: one row per piece (its options array)
function getOM(pieces) {
	let OM = [];
	for (let pi=0; pi < pieces.length; pi++) {
		OM.push(pieces[pi].options);
	}
	return OM;
}

// Collapse each colour's pieces (colors: "w", "b", "wb" or an array; default both) so that every
// remaining identity is part of some complete army
function updateOptionsFromEntanglement(state, colors) {
	if (colors == undefined) {
		colors = ["w", "b"];
	}
	if (typeof colors === "string") {
		// The old code was sometimes called with a bare "w" or "b"
		colors = colors.split("");
	}
	for (const color of colors) {
		const pieces = getPieces(state, color);
		const filtered = filterOptionMatrix(getOM(pieces));
		if (filtered === null) {
			throw new Error('Original OM is not valid');
		}
		for (let pi = 0; pi < pieces.length; pi++) {
			pieces[pi].options = filtered[pi];
		}
	}
}

export { filterOptionMatrix, getOM, updateOptionsFromEntanglement };
