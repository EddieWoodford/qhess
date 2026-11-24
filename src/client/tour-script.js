"use strict";

// Reading the demo play-through's script (tour-text.js). Pure functions, no page code, so the Node tests can check
// the script against the engine (tests/node/tour.test.js).
//
// The script is a game record, one ply per line exactly as the engine writes it in the history, with lines between:
//   # text          a note from the narrator: a step of its own, with no move
//   # @e4 text      the same, pointing at the square e4
//   > click: text   what the side making the ply above is thinking as it makes one of its clicks: a step of its own.
//                   Every click a player makes for the ply needs one, in order (plyClicks): nak (Declare 'Not a
//                   King'), pick (the piece), to (where it goes), pc (Add PC), king (the king it may be), submit
//                   (Submit, or Pass to white at move 0); resign for a resignation.
//   ? e4 QR         check (by the test): after the ply above, the piece on e4 could be exactly these types
//   ? pc e7         check: after the ply above, a potential check stands on the piece on e7
//   // text         a comment for whoever edits the script: ignored
// Blank lines are ignored.
//
// Where the bubble goes: a note can start with [left], [right], [above] or [below] after its @square, and a thought
// after its click, to put the bubble on that side of the square it points at (for a thought: the square clicked, or
// for a button the piece moving), so it doesn't hide the pieces the step is about. For a note with no square, the
// bubble goes to that edge of the board instead of the middle.
//   # @e7 [below] text        > to: [left] text        # [above] text
// The sides are as seen from White's side of the board; on Black's view they are mirrored, so the bubble stays off
// the same squares. Without one, the bubble goes beside the square, on the side nearer the middle of the board.

import { parseMoveText } from "../engine/notation.js";

const PLY = /^\d+[bw]\./;
const SQUARE = /^[a-h][1-8]$/;
const PLACES = ["left", "right", "above", "below"];

// The clicks a player makes for a ply, in order (the thoughts' labels)
function plyClicks(plyText) {
	const move = parseMoveText(plyText);
	if (move.resign) { return ["resign"]; }
	return [...(move.notAKing ? ["nak"] : []), ...(move.from ? ["pick", "to"] : []), ...(move.pcKing ? ["pc", "king"] : []), "submit"];
}

// The steps of the tour, in order, and the script's mistakes (lines that can't be read):
//   { steps: [ { kind: "note", text, at, place }   at: "e4", or null
//              { kind: "ply", text, side, thoughts: [{ click, text, place }], checks: [{ square, types } | { pc: square }] } ],
//     errors: ["line 12: ..."] }
// place: where the bubble goes ("left", "right", "above" or "below"), or null for the usual place
function parseTour(scriptText) {
	const steps = [];
	const errors = [];
	const lastPly = () => steps.at(-1)?.kind == "ply" ? steps.at(-1) : null;
	// A [place] at the start of text: { place (null if there isn't one), text (the rest) }
	const readPlace = (text, where) => {
		const m = /^\[([a-z]+)\]\s*/.exec(text);
		if (!m) { return { place: null, text }; }
		if (!PLACES.includes(m[1])) {
			errors.push(where + "the bubble can go [" + PLACES.join("], [") + "], not [" + m[1] + "]");
			return { place: null, text };
		}
		return { place: m[1], text: text.slice(m[0].length) };
	};
	scriptText.split(/\r?\n/).forEach((raw, i) => {
		const line = raw.trim();
		const where = "line " + (i + 1) + ": ";
		if (line == "" || line.startsWith("//")) { return; }
		if (PLY.test(line)) {
			steps.push({ kind: "ply", text: line, side: line.match(/^\d+([bw])/)[1], thoughts: [], checks: [] });
		} else if (line.startsWith("#")) {
			const m = /** @type {RegExpExecArray} */ (/^#\s*(?:@([a-h][1-8])\s+)?(.*)$/.exec(line)); // (always matches)
			const { place, text } = readPlace(m[2].trim(), where);
			steps.push({ kind: "note", text, at: m[1] ?? null, place });
		} else if (line.startsWith(">")) {
			const ply = lastPly();
			if (!ply) { errors.push(where + "a thought must follow a ply"); return; }
			const m = /^>\s*([a-z]+):\s*(.*)$/.exec(line);
			if (!m) { errors.push(where + "a thought starts with the click it is for, as '> pick: text'"); return; }
			const { place, text } = readPlace(m[2].trim(), where);
			ply.thoughts.push({ click: m[1], text, place });
		} else if (line.startsWith("?")) {
			const ply = lastPly();
			const [a, b] = line.slice(1).trim().split(/\s+/);
			if (!ply) {
				errors.push(where + "a check must follow a ply");
			} else if (a == "pc" && SQUARE.test(b ?? "")) {
				ply.checks.push({ pc: b });
			} else if (SQUARE.test(a ?? "") && /^[KQBNRP]+$/.test(b ?? "")) {
				ply.checks.push({ square: a, types: b });
			} else {
				errors.push(where + "can't read the check '" + line + "'");
			}
		} else {
			errors.push(where + "can't read '" + line + "'");
		}
	});
	for (const step of steps) {
		if (step.kind != "ply") { continue; }
		const clicks = plyClicks(step.text).join(", ");
		const labels = step.thoughts.map(t => t.click).join(", ");
		if (labels != clicks) {
			errors.push("'" + step.text + "' needs a thought for each click (" + clicks + "), has (" + labels + ")");
		}
	}
	return { steps, errors };
}

// The plies of the steps up to and including step i, as history text, and how many there are
function pliesUpTo(steps, i) {
	const plies = steps.slice(0, i + 1).filter(s => s.kind == "ply").map(s => s.text);
	return { text: plies.join("\n"), count: plies.length };
}

export { parseTour, pliesUpTo, plyClicks };
