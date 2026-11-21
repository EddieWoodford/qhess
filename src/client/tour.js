"use strict";

// The demo play-through: a short game (tour-text.js) played out on the real board, step by step, with a thought
// bubble saying why each move is made. It never draws the board itself: each move is made through the same
// controller.js calls a player's clicks make (pick the piece, choose the square, Add PC, pick the king and the
// attackers, Submit), so the board, its theme, highlights, prompts and animations are always the game's own.
// Stepping back (or jumping) rebuilds the position from the plies, as the History tab's replay does.
//
// While it runs, controller.js ui.tour is set: the player's clicks on the board do nothing and the game isn't saved.
// The player's own game is put back on Exit; "Play from here" keeps the position shown as the game instead.

import * as game from "./controller.js";
import { holdSetting } from "./settings.js";
import { parseTour, pliesUpTo } from "./tour-script.js";
import { TOUR_TEXT } from "./tour-text.js";
import { parseMoveText } from "../engine/notation.js";
import { coordstext2coords } from "../engine/utils.js";

const STAGE_MS = 1200; // the pause between the stages of a move being acted out
const PRESS_MS = 500;  // how long a side button shows as pressed

const $ = id => document.getElementById(id);
const el = {
	area: $("gameArea"),
	bubble: $("tourBubble"),
	speaker: $("tourSpeaker"),
	text: $("tourText"),
	bar: $("tourBar"),
	count: $("tourCount"),
	back: $("tourBack"),
	next: $("tourNext"),
};

let steps = null;    // the tour's steps (tour-script.js parseTour) while it runs, else null
let index = -1;      // the step being shown
let savedGame = "";  // the player's own game, to put back on Exit
let timers = [];     // the stages of the move being acted out, still to come
let anchor = null;   // [r,c] of the square the bubble points at, or null (over the middle of the board)

function running() {
	return steps !== null;
}

function start() {
	if (running() || !game.setTour(true)) { return; } // not in a multiplayer game
	savedGame = game.ui.record.join("\n");
	steps = parseTour(TOUR_TEXT).steps;
	holdSetting("showCoords", true); // the thought bubbles name squares
	el.bar.hidden = false;
	show(0, false);
}

// End the tour. keep: the position shown becomes the player's game; otherwise their own game comes back.
function stop(keep = false) {
	if (!running()) { return; }
	settle();
	const shown = game.ui.record.join("\n");
	steps = null;
	index = -1;
	el.bar.hidden = true;
	el.bubble.hidden = true;
	holdSetting("showCoords");
	game.setTour(false);
	const text = keep ? shown : savedGame;
	if (text.trim() == "") {
		game.newGame();
	} else {
		game.restoreGameHistory(text);
	}
}

function next() {
	if (running() && index < steps.length - 1) { show(index + 1, true); }
}

function back() {
	if (running() && index > 0) { show(index - 1, false); }
}

// Show step i. act: a ply is acted out from the position before it; otherwise the position after it is shown at once.
function show(i, act) {
	settle();
	index = i;
	const step = steps[i];
	if (act && step.kind == "ply") {
		const before = pliesUpTo(steps, i - 1);
		if (game.ui.record.join("\n") != before.text) {
			game.restoreGameHistory(before.text);
		}
		actOut(step);
	} else {
		game.restoreGameHistory(pliesUpTo(steps, i).text);
		// A note after the last move looks at the board: put the game over banner away, as a click on it does
		if (step.kind == "note" && !$("gameOver").hidden) { $("gameOver").click(); }
		const move = step.kind == "ply" ? parseMoveText(step.text) : null;
		showBubble(step, step.kind == "note" ? square(step.at) : move.to ?? move.pcKing);
	}
	drawBar();
}

// A move acted out through the controller, a stage at a time, as a player would make it
function actOut(step) {
	const move = parseMoveText(step.text);
	if (move.resign) { // nothing to act out (and Surrender would ask first)
		game.restoreGameHistory(pliesUpTo(steps, index).text);
		showBubble(step, null);
		return;
	}
	const stages = [];
	if (move.notAKing) {
		stages.push(() => press(1, () => game.sideButton1Action())); // Declare 'Not a King'
	}
	if (move.from) {
		stages.push(() => game.showPartialMove(move.from));
		stages.push(() => {
			game.showCompleteMove(move.to, move.enPassant, move.promotion, move.castle);
			placeBubble(move.to);
		});
	}
	if (move.pcKing) {
		stages.push(() => press(1, () => game.sideButton1Action())); // Add PC
		stages.push(() => game.selectPCKing(move.pcKing, move.pcAttackers)); // the attackers the script names
	}
	stages.push(() => press(2, () => game.sideButton2Action())); // Submit (or Pass to white)
	stages.push(() => {
		timers = [];
		if (game.ui.record.at(-1) != step.text) {
			// The page made something else of it (the script and the controller disagree): show the ply as written
			console.warn("Demo: acting out '" + step.text + "' gave '" + game.ui.record.at(-1) + "'");
			game.restoreGameHistory(pliesUpTo(steps, index).text);
		}
	});

	showBubble(step, move.from ?? move.pcKing);
	stages.forEach((stage, n) => timers.push(setTimeout(stage, STAGE_MS * (n + 1))));
}

// Stop acting out a move part-way: show the position after it at once
function settle() {
	if (timers.length == 0) { return; }
	timers.forEach(clearTimeout);
	timers = [];
	game.restoreGameHistory(pliesUpTo(steps, index).text);
	if (steps[index].kind == "ply") {
		const move = parseMoveText(steps[index].text);
		placeBubble(move.to ?? move.pcKing);
	}
}

// Show a side button pressed for a moment, as it is pressed
function press(n, action) {
	const button = n == 1 ? $("sideButton1") : $("sideButton2");
	button.classList.add("tour-press");
	setTimeout(() => button.classList.remove("tour-press"), PRESS_MS);
	action();
}

function square(text) {
	return text ? coordstext2coords(text) : null;
}

////////////////////////////////
// The bubble and the bar
////////////////////////////////

function showBubble(step, at) {
	const side = step.kind == "ply" ? step.side : null;
	el.bubble.dataset.speaker = side ?? "narrator";
	el.speaker.textContent = side == "w" ? "White thinks" : side == "b" ? "Black thinks" : "";
	el.speaker.hidden = side === null;
	el.text.textContent = step.kind == "ply" ? step.thought : step.text;
	el.bubble.hidden = false;
	placeBubble(at);
}

const OPPOSITE = { left: "right", right: "left", above: "below", below: "above" };

// Put the bubble beside the square at [r,c], or over the middle of the board for null. The step's place
// (tour-script.js: left, right, above or below, as seen from White's side) says which side of the square, or for
// null which edge of the board; without one it goes on the side of the square nearer the middle of the board (to
// its left on the right half), so the file it is on stays in view. If it doesn't fit on that side it goes on the
// other, else on one of the sides across (nearer the middle first), else wherever there is most room: on a small
// board a long bubble may not fit anywhere. Measured from the square's button, so a flipped board works too.
function placeBubble(at) {
	anchor = at;
	if (el.bubble.hidden) { return; }
	const area = el.area.getBoundingClientRect();
	const b = el.bubble;
	const w = b.offsetWidth;
	const h = b.offsetHeight;
	const within = (value, size, room) => Math.min(Math.max(0, value), Math.max(0, room - size));
	let place = steps[index].place;
	if (place && $("board").classList.contains("flipped")) { place = OPPOSITE[place]; }
	b.classList.remove("left", "right", "above", "below");
	if (!at) {
		const left = place == "left" ? 0 : place == "right" ? area.width : (area.width - w) / 2;
		const top = place == "above" ? 0 : place == "below" ? area.height : (area.height - h) / 2;
		b.style.left = within(left, w, area.width) + "px";
		b.style.top = within(top, h, area.height) + "px";
		return;
	}
	const sq = $("square" + at[0] + at[1]).getBoundingClientRect();
	const x = sq.left + sq.width / 2 - area.left;
	const y = sq.top + sq.height / 2 - area.top;
	const gap = sq.width * 0.8;
	// How much room is spare on each side of the square, once the bubble is there
	const spare = { left: x - gap - w, right: area.width - x - gap - w, above: y - gap - h, below: area.height - y - gap - h };
	const towardsMiddle = { across: x > area.width / 2 ? "left" : "right", down: y > area.height / 2 ? "above" : "below" };
	place ??= towardsMiddle.across;
	const across = place == "left" || place == "right" ? towardsMiddle.down : towardsMiddle.across;
	const order = [place, OPPOSITE[place], across, OPPOSITE[across]];
	place = order.find(p => spare[p] >= 0) ?? order.reduce((most, p) => spare[p] > spare[most] ? p : most);
	const beside = place == "left" || place == "right";
	const left = within(beside ? (place == "left" ? x - gap - w : x + gap) : x - w / 2, w, area.width);
	const top = within(beside ? y - h / 2 : (place == "above" ? y - gap - h : y + gap), h, area.height);
	b.style.left = left + "px";
	b.style.top = top + "px";
	// The tail points at the square, kept off the bubble's rounded corners
	const corner = parseFloat(getComputedStyle(b).fontSize) * 1.2;
	const tail = (pos, size) => Math.min(Math.max(pos, corner), size - corner) + "px";
	b.style.setProperty(beside ? "--tail-y" : "--tail-x", beside ? tail(y - top, h) : tail(x - left, w));
	b.classList.add(place);
}

function drawBar() {
	el.count.textContent = "Step " + (index + 1) + " of " + steps.length;
	el.back.disabled = index <= 0;
	el.next.disabled = index >= steps.length - 1;
}

// The bubble follows its square when the board changes size or is turned round
function refresh() {
	if (running()) { placeBubble(anchor); }
}
new ResizeObserver(refresh).observe(el.area);
// (and once the coordinates' strip has slid in at the start, as the squares shrink to make room for it)
$("board").addEventListener("transitionend", e => { if (e.propertyName == "--coord-strip") { refresh(); } });

$("tourBack").addEventListener("click", back);
$("tourNext").addEventListener("click", next);
$("tourPlay").addEventListener("click", () => stop(true));
$("tourExit").addEventListener("click", () => stop(false));
document.addEventListener("keydown", e => {
	if (!running() || e.target.closest?.("input, textarea") || [...document.querySelectorAll(".modalWrapper")].some(m => m.style.display == "block")) { return; }
	if (e.key == "ArrowRight") { next(); }
	else if (e.key == "ArrowLeft") { back(); }
	else if (e.key == "Escape" && !document.body.classList.contains("panel-open")) { stop(false); }
});

export { start, stop, running, next, back, refresh };
