// Shared by the Node tests: the example games and their recorded snapshots.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getHistoryLines, parseMoveText } from "../../src/engine/notation.js";

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

export { ROOT, exampleGames, snapshots, moveFromLine, historyAsLines };
