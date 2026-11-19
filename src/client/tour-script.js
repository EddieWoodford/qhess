"use strict";

// Reading the demo play-through's script (tour-text.js). Pure functions, no page code, so the Node tests can check
// the script against the engine (tests/node/tour.test.js).
//
// The script is a game record, one ply per line exactly as the engine writes it in the history, with lines between:
//   # text          a note from the narrator: a step of its own, with no move
//   # @e4 text      the same, pointing at the square e4
//   > text          what the side making the ply above is thinking (more > lines join on). Every ply needs one.
//   ? e4 QR         check (by the test): after the ply above, the piece on e4 could be exactly these types
//   ? pc e7         check: after the ply above, a potential check stands on the piece on e7
//   // text         a comment for whoever edits the script: ignored
// Blank lines are ignored.
//
// Where the bubble goes: a note or thought can start with [left], [right], [above] or [below], after a note's
// @square, to put its bubble on that side of the square it points at (for a ply: the piece moving, then where it
// lands), so it doesn't hide the pieces the step is about. For a note with no square, the bubble goes to that edge
// of the board instead of the middle.
//   # @e7 [below] text        > [left] text        # [above] text
// The sides are as seen from White's side of the board; on Black's view they are mirrored, so the bubble stays off
// the same squares. Without one, the bubble goes beside the square, on the side nearer the middle of the board.

const PLY = /^\d+[bw]\./;
const SQUARE = /^[a-h][1-8]$/;
const PLACES = ["left", "right", "above", "below"];

// The steps of the tour, in order, and the script's mistakes (lines that can't be read):
//   { steps: [ { kind: "note", text, at, place }   at: "e4", or null
//              { kind: "ply", text, side, thought, checks: [{ square, types } | { pc: square }], place } ],
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
			steps.push({ kind: "ply", text: line, side: line.match(/^\d+([bw])/)[1], thought: "", checks: [], place: null });
		} else if (line.startsWith("#")) {
			const m = /^#\s*(?:@([a-h][1-8])\s+)?(.*)$/.exec(line);
			const { place, text } = readPlace(m[2].trim(), where);
			steps.push({ kind: "note", text, at: m[1] ?? null, place });
		} else if (line.startsWith(">")) {
			const ply = lastPly();
			if (!ply) { errors.push(where + "a thought must follow a ply"); return; }
			const { place, text } = readPlace(line.slice(1).trim(), where);
			if (place && ply.place) {
				errors.push(where + "this ply's bubble already has a place, [" + ply.place + "]");
			} else if (place) {
				ply.place = place;
			}
			ply.thought = (ply.thought + " " + text).trim();
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
		if (step.kind == "ply" && step.thought == "") {
			errors.push("'" + step.text + "' has no thought (> line)");
		}
	}
	return { steps, errors };
}

// The plies of the steps up to and including step i, as history text, and how many there are
function pliesUpTo(steps, i) {
	const plies = steps.slice(0, i + 1).filter(s => s.kind == "ply").map(s => s.text);
	return { text: plies.join("\n"), count: plies.length };
}

export { parseTour, pliesUpTo };
