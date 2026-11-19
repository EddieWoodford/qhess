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

const PLY = /^\d+[bw]\./;
const SQUARE = /^[a-h][1-8]$/;

// The steps of the tour, in order, and the script's mistakes (lines that can't be read):
//   { steps: [ { kind: "note", text, at }   at: "e4", or null
//              { kind: "ply", text, side, thought, checks: [{ square, types } | { pc: square }] } ],
//     errors: ["line 12: ..."] }
function parseTour(scriptText) {
	const steps = [];
	const errors = [];
	const lastPly = () => steps.at(-1)?.kind == "ply" ? steps.at(-1) : null;
	scriptText.split(/\r?\n/).forEach((raw, i) => {
		const line = raw.trim();
		const where = "line " + (i + 1) + ": ";
		if (line == "" || line.startsWith("//")) { return; }
		if (PLY.test(line)) {
			steps.push({ kind: "ply", text: line, side: line.match(/^\d+([bw])/)[1], thought: "", checks: [] });
		} else if (line.startsWith("#")) {
			const m = /^#\s*(?:@([a-h][1-8])\s+)?(.*)$/.exec(line);
			steps.push({ kind: "note", text: m[2].trim(), at: m[1] ?? null });
		} else if (line.startsWith(">")) {
			const ply = lastPly();
			if (!ply) { errors.push(where + "a thought must follow a ply"); return; }
			ply.thought = (ply.thought + " " + line.slice(1).trim()).trim();
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
