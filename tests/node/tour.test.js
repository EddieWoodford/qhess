// The demo play-through's script (src/client/tour-text.js) against the engine: every ply plays, is written back
// exactly as in the script (so the page acting it out ends on the same line), and every check holds.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTour, pliesUpTo, plyClicks } from "../../src/client/tour-script.js";
import { TOUR_TEXT } from "../../src/client/tour-text.js";
import { createInitialState } from "../../src/engine/state.js";
import { applyMove } from "../../src/engine/game.js";
import { getHistoryLines, parseMoveText } from "../../src/engine/notation.js";
import { coordstext2coords } from "../../src/engine/utils.js";

const { steps, errors } = parseTour(TOUR_TEXT);

test("the tour script reads without mistakes", () => {
	assert.deepEqual(errors, []);
	assert.ok(steps.length > 0);
});

test("every ply of the tour plays, as the engine writes it, and its checks hold", () => {
	const state = createInitialState();
	for (const step of steps.filter(s => s.kind == "ply")) {
		const { turn, ...move } = parseMoveText(step.text);
		assert.deepEqual(applyMove(state, move), { ok: true }, step.text);
		assert.equal(getHistoryLines(state.history).at(-1), step.text, "written back differently");
		for (const check of step.checks) {
			if (check.pc) {
				const king = state.pcKing > -1 ? state.pieces[state.pcColor][state.pcKing] : null;
				assert.deepEqual(king && [king.r, king.c], coordstext2coords(check.pc), step.text + ": pc " + check.pc);
			} else {
				const [r, c] = coordstext2coords(check.square);
				assert.equal(state.board[r][c]?.waves(), check.types, step.text + ": " + check.square);
			}
		}
	}
	assert.ok(state.result === null || state.result == "checkmate", "the tour ends in play or in checkmate");
});

test("the tour shows the key ideas: a collapse to one type, a potential check, Not a King, a capture, castling, mate", () => {
	const plies = steps.filter(s => s.kind == "ply");
	assert.ok(plies.some(p => p.checks.some(c => c.types?.length == 1)), "a collapse");
	assert.ok(plies.some(p => p.text.includes("<")), "a potential check");
	assert.ok(plies.some(p => p.text.includes("[")), "Not a King");
	assert.ok(plies.some(p => p.text.includes("x")), "a capture");
	assert.ok(plies.some(p => p.text.includes("O-O")), "castling (a known king)");
	assert.ok(plies.some(p => p.text.includes("#")), "checkmate");
});

test("parseTour: notes, thoughts, checks and mistakes", () => {
	const t = parseTour("# hi\n# @e4 look\n1w. (KQBNRP)e2e4(QRP)\n> pick: one\n> to: two\n> submit: three\n? e4 QRP\n? pc e7\n" +
		"? nonsense\nwhat\n2b. x\n> no label");
	assert.deepEqual(t.steps.slice(0, 2), [{ kind: "note", text: "hi", at: null, place: null },
		{ kind: "note", text: "look", at: "e4", place: null }]);
	assert.deepEqual(t.steps[2].thoughts, [{ click: "pick", text: "one", place: null },
		{ click: "to", text: "two", place: null }, { click: "submit", text: "three", place: null }]);
	assert.deepEqual(t.steps[2].checks, [{ square: "e4", types: "QRP" }, { pc: "e7" }]);
	assert.equal(t.errors.length, 4); // the bad check, "what", the thought with no click, and 2b. without its thought
	assert.match(t.errors[3], /'2b\. x' needs a thought for each click \(submit\), has \(\)/);
	assert.deepEqual(pliesUpTo(t.steps, 1), { text: "", count: 0 });
	assert.deepEqual(pliesUpTo(t.steps, 3), { text: "1w. (KQBNRP)e2e4(QRP)\n2b. x", count: 2 });
});

test("plyClicks: the clicks a player makes for a ply", () => {
	assert.deepEqual(plyClicks("0b."), ["submit"]);
	assert.deepEqual(plyClicks("1w. (KQBNRP)e2e4(QRP)"), ["pick", "to", "submit"]);
	assert.deepEqual(plyClicks("3w. [b2](N)f3d4(N)"), ["nak", "pick", "to", "submit"]);
	assert.deepEqual(plyClicks("2b. (KQBNRP)g8xb3(QB)<b2+ b3 g7>"), ["pick", "to", "pc", "king", "submit"]);
	assert.deepEqual(plyClicks("0b. <e1+ e8>"), ["pc", "king", "submit"]);
	assert.deepEqual(plyClicks("9w. resigns"), ["resign"]);
});

test("parseTour: where the bubble goes", () => {
	const t = parseTour("# [above] hi\n# @e7 [below] look\n1w. (KQBNRP)e2e4(QRP)\n> pick: one\n> to: [left] two\n" +
		"> submit: x\n# [middle] no such place\n# @e4 [Left] only lower case\n# [notes can start with a link] fine");
	assert.deepEqual(t.steps[0], { kind: "note", text: "hi", at: null, place: "above" });
	assert.deepEqual(t.steps[1], { kind: "note", text: "look", at: "e7", place: "below" });
	assert.equal(t.steps[2].thoughts[0].place, null);
	assert.deepEqual(t.steps[2].thoughts[1], { click: "to", text: "two", place: "left" });
	assert.equal(t.steps[4].text, "[Left] only lower case"); // not a place: left as text
	assert.equal(t.steps[5].text, "[notes can start with a link] fine");
	assert.equal(t.errors.length, 1); // [middle]
	assert.match(t.errors[0], /line 7: .*\[middle\]/);
});
