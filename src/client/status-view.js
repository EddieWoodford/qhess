"use strict";

// The status bar under the board: the prompt (whose turn it is and what to do next), the staged move's
// notation, and the two side buttons.

import { oppColor } from "../engine/state.js";
import { findChecks, findPotentialKings } from "../engine/check.js";
import { pcMoveText } from "../engine/game.js";
import { dom, setVisible } from "./dom.js";

// What the status bar shows at each step of the turn (the controller.js STATE).
//   prompt:   what to do, shown after whose turn it is (and any check)
//   button1, button2: the side buttons' labels, or null to hide the button.
//             controller.js sideButton1Action / sideButton2Action decide what a click does.
// A value can be a function of ctx (see statusContext) when it depends on the position.
const STEPS = {
	move0: {
		prompt: "Add Potential Check?",
		button1: "Add PC",
		button2: "Pass to white",
	},
	clear: {
		prompt: "Select piece to move",
		button1: ctx => ctx.inPotentialCheck ? "Declare 'Not a King'" : null,
		button2: null,
	},
	highlightPotentialMoves: {
		prompt: "Select piece to move",
		button1: null,
		button2: null,
	},
	showPartialMove: {
		prompt: "Select destination",
		button1: null,
		button2: null,
	},
	showCompleteMove: {
		prompt: ctx => ctx.canAddPC ? "Add Potential Check / Submit" : "Submit",
		button1: ctx => ctx.canAddPC ? "Add PC" : null,
		button2: "Submit",
	},
	invalidMoveIntoCheck: {
		prompt: "Invalid - moved into check",
		button1: null,
		button2: "Cancel",
	},
	selectPCKing: {
		prompt: "Select King to attack",
		button1: null,
		button2: null,
	},
	selectPCAttackers: {
		prompt: "Select attacking pieces",
		button1: null,
		button2: ctx => ctx.hasPCAttackers ? "Submit" : null, // once at least one attacker is chosen
	},
};

// While stepping through the history, the buttons are replaced by this
const REPLAY = { button1: "Resume from here", button2: null };

// The facts about the position that the prompt and buttons depend on
function statusContext(game, state) {
	// The checks to describe in the prompt. While the side to move is declaring a potential check, these
	// describe the side being checked.
	let checks = { autoCheck: game.autoCheck, potCheck: game.potCheck };
	if (game.pcKing >= 0 && game.pcColor == oppColor(game.turnColor)) {
		checks = findChecks(game, game.pcColor);
	}
	return {
		checks,
		inPotentialCheck: checks.potCheck,
		canAddPC: state == "showCompleteMove" && findPotentialKings(game).length > 0,
		hasPCAttackers: state == "selectPCAttackers" && findChecks(game, oppColor(game.turnColor)).attackerCoords.length > 0,
	};
}

// The start of the prompt: whose turn it is, and any check against them, e.g. "White · Check"
function promptHeading(game, checks) {
	const parts = [game.turnColor == "w" ? "White" : "Black"];
	if (game.turnNumber == 0) {
		parts.push("Move 0");
	}
	if (checks.autoCheck) {
		parts.push("Check");
	}
	if (checks.potCheck) {
		parts.push("Potential Check");
	}
	return parts.join(" · ");
}

// Show a side button with this label, or hide it (label null). A hidden button keeps its place.
function setButton(button, label) {
	setVisible(button, label !== null);
	if (label !== null) {
		button.innerText = label;
	}
}

// view: see render.js
function drawStatus(view) {
	const game = view.game;
	const step = STEPS[view.state];
	const ctx = statusContext(game, view.state);
	const value = v => typeof v == "function" ? v(ctx) : v;

	dom.prompt.innerHTML = '<span class="prompt-who">' + promptHeading(game, ctx.checks) + "</span> — " + value(step.prompt);

	const buttons = view.replayNumber > -1 ? REPLAY : step;
	setButton(dom.sideButton1, value(buttons.button1));
	setButton(dom.sideButton2, value(buttons.button2));

	dom.stagedMove.textContent = game.thisMove + pcMoveText(game);
}

export { drawStatus };
