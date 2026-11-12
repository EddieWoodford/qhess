"use strict";

// The status bar under the board: the prompt (whose turn it is and what to do next), the staged move's
// notation, and the two side buttons.

import { oppColor } from "../engine/state.js";
import { findChecks, findPotentialKings } from "../engine/check.js";
import { pcMoveText } from "../engine/game.js";
import { coords2text } from "../engine/utils.js";
import { dom, setVisible } from "./dom.js";

// What the status bar shows at each step of the turn (the controller.js STATE).
//   prompt:   what to do, shown after whose turn it is (and any check)
//   button1, button2: the side buttons' labels, or null to hide the button.
//             controller.js sideButton1Action / sideButton2Action decide what a click does.
// A value can be a function of ctx (see statusContext) when it depends on the position.
const STEPS = {
	move0: {
		prompt: ctx => ctx.pcRule ? "Add Potential Check?" : "Pass to white",
		button1: ctx => ctx.pcRule ? "Add PC" : null,
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
		// Names the squares, e.g. "Invalid - moved into check: e2 attacking f1"
		prompt: ctx => "Invalid - moved into check" + (ctx.intoCheckAttackers.length > 0
			? ": " + ctx.intoCheckAttackers.join(", ") + " attacking " + ctx.intoCheckKing
			: ""),
		button1: null,
		button2: "Cancel",
	},
	selectPCKing: {
		prompt: "Select King to attack",
		button1: null,
		button2: null,
	},
	selectPCAttackers: {
		// Names the squares, e.g. "Select pieces attacking f1", then "e2 attacking f1. Submit, or add another"
		prompt: ctx => ctx.pcAttackers.length == 0
			? "Select pieces attacking " + ctx.pcKing
			: ctx.pcAttackers.join(", ") + " attacking " + ctx.pcKing + ". Submit, or add another",
		button1: null,
		button2: ctx => ctx.hasPCAttackers ? "Submit" : null, // once at least one attacker is chosen
	},
	// Checkmate or stalemate
	gameOver: {
		prompt: ctx => ctx.result == "checkmate"
			? "Checkmate: " + (ctx.toMove == "w" ? "Black" : "White") + " wins"
			: "Stalemate: the game is a draw",
		button1: null,
		button2: null,
	},
	// Multiplayer, while the player can't move
	waitJoin: {
		prompt: ctx => ctx.multiplayer?.phase == "playing" ? "Waiting for your friend to join" : "Connecting…",
		button1: null,
		button2: null,
	},
	waitOpponent: {
		prompt: ctx => ctx.multiplayer?.opponent == "disconnected" ? "Opponent disconnected, waiting for them to come back" : "Waiting for your opponent",
		button1: null,
		button2: null,
	},
	sendingMove: {
		prompt: "Sending your move…",
		button1: null,
		button2: null,
	},
	multiplayerOver: {
		prompt: ctx => ctx.multiplayer?.message || "The game has ended",
		button1: null,
		button2: null,
	},
};

// While stepping through the history, the buttons are replaced by this: play on from the position shown (the later
// moves are dropped), or go back to the game as it was. At the newest move the two would be the same.
const REPLAY = { button1: "Resume from here", button2: ctx => ctx.replayAtEnd ? null : "Back to game" };
// ... and in a multiplayer game, where the game can't be taken back
const REPLAY_MULTIPLAYER = { button1: "Back to game", button2: null };

// The facts about the position that the prompt and buttons depend on.
// pcRule: whether the player can declare potential checks (the Settings tab's switch; controller.js pcRule).
function statusContext(game, state, multiplayer, pcRule, replayAtEnd) {
	// The checks to describe in the prompt. While the side to move is declaring a potential check, these
	// describe the side being checked.
	let checks = { autoCheck: game.autoCheck, potCheck: game.potCheck };
	if (game.pcKing >= 0 && game.pcColor == oppColor(game.turnColor)) {
		checks = findChecks(game, game.pcColor);
	}
	// The potential check being declared: the king's square and its attackers', e.g. "f1" and ["e2"]
	const declared = state == "selectPCAttackers" ? findChecks(game, oppColor(game.turnColor)) : null;
	// The check the mover has walked into: their king's square and its attackers'
	const intoCheck = state == "invalidMoveIntoCheck" ? findChecks(game, game.turnColor) : null;
	return {
		multiplayer,
		replayAtEnd,
		intoCheckKing: intoCheck ? coords2text(intoCheck.kingCoords) : "",
		intoCheckAttackers: intoCheck ? intoCheck.attackerCoords.map(coords2text) : [],
		pcKing: declared ? coords2text(declared.kingCoords) : "",
		pcAttackers: declared ? declared.attackerCoords.map(coords2text) : [],
		checks,
		result: game.result,
		toMove: game.turnColor,
		pcRule,
		inPotentialCheck: checks.potCheck,
		canAddPC: pcRule && state == "showCompleteMove" && findPotentialKings(game).length > 0,
		hasPCAttackers: declared !== null && declared.attackerCoords.length > 0,
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
	const ctx = statusContext(game, view.state, view.multiplayer, view.pcRule, view.replayNumber * 2 >= view.record.length);
	const value = v => typeof v == "function" ? v(ctx) : v;

	let heading = promptHeading(game, ctx.checks);
	if (view.multiplayer?.color && view.replayNumber == -1) {
		heading += game.turnColor == view.multiplayer.color ? " (you)" : " (opponent)";
	}
	const prompt = document.createElement("span");
	prompt.className = "prompt-who";
	prompt.textContent = heading;
	dom.prompt.replaceChildren(prompt, " — " + value(step.prompt));

	drawMultiplayerBadge(view.multiplayer);

	const buttons = view.replayNumber > -1 ? (view.multiplayer ? REPLAY_MULTIPLAYER : REPLAY) : step;
	setButton(dom.sideButton1, value(buttons.button1));
	setButton(dom.sideButton2, value(buttons.button2));
	// The same cursors as the board's (style.css 7.2), so the tick and cross on the squares are easy to learn
	dom.sideButton2.classList.toggle("submitOnClick", buttons === step && dom.sideButton2.innerText == "Submit");
	dom.sideButton2.classList.toggle("cancelOnClick", buttons === step && dom.sideButton2.innerText == "Cancel");

	dom.stagedMove.textContent = game.thisMove + pcMoveText(game);

	drawGameOver(view);
}

// The banner over the board when the game has ended (style.css 7.6). It isn't shown while stepping through the
// history, and once clicked away it stays away until the game changes.
let gameOverDismissed = null; // the history of the game whose banner was clicked away
dom.gameOver.addEventListener("click", () => {
	gameOverDismissed = dom.gameOver.dataset.history;
	dom.gameOver.hidden = true;
});

function drawGameOver(view) {
	const game = view.game;
	const show = view.state == "gameOver" && view.replayNumber == -1 && game.history !== gameOverDismissed;
	dom.gameOver.hidden = !show;
	if (!show) { return; }
	const checkmate = game.result == "checkmate";
	dom.gameOver.dataset.history = game.history;
	dom.gameOver.classList.toggle("checkmate", checkmate);
	dom.gameOver.classList.toggle("draw", !checkmate);
	dom.gameOverTitle.textContent = checkmate ? "Checkmate" : "Draw";
	dom.gameOverDetail.textContent = checkmate ? (game.turnColor == "w" ? "Black" : "White") + " wins" : "Stalemate";
}

// The line above the prompt in a multiplayer game: the code, your colour, and how the connections are
function drawMultiplayerBadge(mp) {
	const badge = dom.mpBadge;
	badge.hidden = !mp;
	if (!mp) { return; }
	const parts = ["Multiplayer"];
	if (mp.code) { parts.push(mp.code); }
	if (mp.color) { parts.push("you are " + (mp.color == "w" ? "White" : "Black")); }
	let problem = "";
	if (mp.phase == "playing") {
		if (mp.connection == "reconnecting") {
			problem = "reconnecting…";
		} else if (mp.opponent == "disconnected") {
			problem = "opponent disconnected";
		} else if (mp.opponent == "waiting") {
			problem = "waiting for opponent";
		}
	} else if (mp.phase == "connecting") {
		problem = mp.serverStarting ? "starting the server (up to a minute)…" : "connecting…";
	} else {
		problem = "game over";
	}
	badge.textContent = parts.join(" · ") + (problem ? " · " + problem : "");
	badge.classList.toggle("mp-badge-problem", problem !== "");
}

export { drawStatus };
