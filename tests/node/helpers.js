// Shared by the Node tests: the example games and their recorded snapshots.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { getHistoryLines, parseMoveText } from "../../src/engine/notation.js";
import { createInitialState } from "../../src/engine/state.js";
import { applyMove } from "../../src/engine/game.js";
import { coordstext2coords as sq } from "../../src/engine/utils.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// The example games, as { name, lines } with one ply of notation per line
function exampleGames() {
	const dir = path.join(ROOT, "example_games");
	return readdirSync(dir).filter(f => f.endsWith(".txt")).sort().map(name => ({
		name,
		lines: getHistoryLines(readFileSync(path.join(dir, name), "utf8")),
	}));
}

// tests/snapshots.json (recorded by tests/test.html)
function snapshots() {
	return JSON.parse(readFileSync(path.join(ROOT, "tests", "snapshots.json"), "utf8"));
}

// A ply of notation as a move for applyMove / session.submitMove: plain data, without the turn label
function moveFromLine(line) {
	const { turn, ...move } = parseMoveText(line);
	return move;
}

// The written history as trimmed lines, to compare with a game file
function historyAsLines(history) {
	return history.split(/\r?\n/).map(l => l.trim());
}

// A move as applyMove takes it, from "e2" style squares (null for no move: Black's move 0)
function move(from, to, extra = {}) {
	return { notAKing: null, from: from ? sq(from) : null, to: to ? sq(to) : null,
		enPassant: false, promotion: false, castle: false, pcKing: null, pcAttackers: [], ...extra };
}

// The position after Black's move 0 (a pass) and then the given plies, alternately White and Black.
// Each ply is [from, to] or [from, to, extra] (extra as for move()).
function play(...plies) {
	const state = createInitialState();
	assert.deepEqual(applyMove(state, move(null, null)), { ok: true });
	for (const ply of plies) {
		const [from, to, extra] = ply;
		assert.deepEqual(applyMove(state, move(from, to, extra)), { ok: true }, from + to);
	}
	return state;
}

// The piece on a square, given as "e2"
function at(state, square) {
	const [r, c] = sq(square);
	return state.board[r][c];
}

export { ROOT, exampleGames, snapshots, moveFromLine, historyAsLines, move, play, at, sq };
