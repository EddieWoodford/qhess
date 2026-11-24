"use strict";

// The demo play-through: a short game (tour-text.js) played out on the real board, a click at a time, with a thought
// bubble saying why each click is made. A pointer glides over the page and makes each click. It never draws the
// board itself: each click is made through the same controller.js call a player's click makes (pick the piece,
// choose the square, Add PC, pick the king, Submit), so the board, its theme, highlights, prompts and animations
// are always the game's own. Stepping back (or jumping) rebuilds the position from the plies and the clicks.
//
// While it runs, controller.js ui.tour is set: the player's clicks on the board do nothing and the game isn't saved.
// The player's own game is put back on Exit; "Play from here" keeps the position shown as the game instead.

import * as game from "./controller.js";
import { holdSetting } from "./settings.js";
import { parseTour, pliesUpTo } from "./tour-script.js";
import { TOUR_TEXT } from "./tour-text.js";
import { parseMoveText } from "../engine/notation.js";
import { coordstext2coords } from "../engine/utils.js";

const LEAD_MS = 400;   // after the thought shows, before the pointer sets off
const MOVE_MS = 700;   // the pointer's glide to what it clicks (style.css 7.7 .tour-cursor transition)
const PRESS_MS = 500;  // how long a side button shows as pressed

// (the page always has these elements)
const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const el = {
	area: $("gameArea"),
	bubble: $("tourBubble"),
	speaker: $("tourSpeaker"),
	text: $("tourText"),
	bar: $("tourBar"),
	count: $("tourCount"),
	back: /** @type {HTMLButtonElement} */ ($("tourBack")),
	next: /** @type {HTMLButtonElement} */ ($("tourNext")),
	cursor: makeCursor(),
};

/** @type {ReturnType<typeof parseTour>["steps"]} */
let steps = [];      // the tour's steps (tour-script.js parseTour) while it runs, else none
/** @type {{step: number, click: number}[]} */
let frames = [];     // what each Next shows: a note (click -1), or one click of a ply's (its thought's index)
let index = -1;      // the frame being shown
let shown = -1;      // the frame whose position is on the board (once its click is made)
let savedGame = "";  // the player's own game, to put back on Exit
let timers = [];     // the click still to come, while the pointer heads for it
let anchor = null;   // [r,c] of the square the bubble points at, or null (over the middle of the board)
/** @type {string | null} */
let place = null;    // the side of it the script puts the bubble, or null
/** @type {Element | null} */
let cursorAt = null; // what the pointer is on

// The pointer that makes the tour's clicks: an arrow, its tip at the point it is moved to
function makeCursor() {
	const cursor = document.createElement("div");
	cursor.className = "tour-cursor";
	cursor.hidden = true;
	cursor.setAttribute("aria-hidden", "true");
	cursor.innerHTML = "<svg viewBox='0 0 24 24'><path d='M3 2 L3 19 L7.5 15 L10.5 22 L13.8 20.6 L10.9 14 L17 14 Z'/></svg>";
	document.body.append(cursor);
	return cursor;
}

function running() {
	return steps.length > 0;
}

function start() {
	if (running() || !game.setTour(true)) { return; } // not in a multiplayer game
	savedGame = game.ui.record.join("\n");
	steps = parseTour(TOUR_TEXT).steps;
	frames = steps.flatMap((step, i) => step.kind == "ply" ? step.thoughts.map((_, k) => ({ step: i, click: k })) : [{ step: i, click: -1 }]);
	holdSetting("showCoords", true); // the thought bubbles name squares
	el.bar.hidden = false;
	el.cursor.hidden = false;
	moveCursor($("board"), false);
	show(0, false);
}

// End the tour. keep: the position shown becomes the player's game; otherwise their own game comes back.
function stop(keep = false) {
	if (!running()) { return; }
	settle();
	const shownGame = game.ui.record.join("\n");
	steps = [];
	frames = [];
	index = -1;
	shown = -1;
	el.bar.hidden = true;
	el.bubble.hidden = true;
	el.cursor.hidden = true;
	cursorAt = null;
	holdSetting("showCoords");
	game.setTour(false);
	const text = keep ? shownGame : savedGame;
	if (text.trim() == "") {
		game.newGame();
	} else {
		game.restoreGameHistory(text);
	}
}

function next() {
	if (running() && index < frames.length - 1) { show(index + 1, true); }
}

function back() {
	if (running() && index > 0) { show(index - 1, false); }
}

// Show frame i: its note, or its thought and click. act: the pointer goes and makes the click, from the position
// before it; otherwise the position after it is shown at once, the pointer already there.
function show(i, act) {
	settle();
	index = i;
	const { step: s, click } = frames[i];
	const step = steps[s];
	if (click < 0) {
		reach(i);
		// A note after the last move looks at the board: put the game over banner away, as a click on it does
		if (!$("gameOver").hidden) { $("gameOver").click(); }
		showBubble(null, step.text, step.place, square(step.at));
	} else {
		const thought = step.thoughts[click];
		const move = parseMoveText(step.text);
		if (act) {
			if (shown != i - 1) { reach(i - 1); }
			showBubble(step.side, thought.text, thought.place, anchorOf(move, thought.click));
			actOut(i);
		} else {
			reach(i);
			showBubble(step.side, thought.text, thought.place, anchorOf(move, thought.click));
			moveCursor(targetOf(move, thought.click), false);
		}
	}
	drawBar();
}

// Put the position after frame f on the board at once
function reach(f) {
	const { step: s, click } = frames[f];
	const step = steps[s];
	if (click < 0 || click == step.thoughts.length - 1) {
		game.restoreGameHistory(pliesUpTo(steps, s).text); // a note, or a ply's last click: the ply is made
	} else {
		game.restoreGameHistory(pliesUpTo(steps, s - 1).text);
		for (let k = 0; k <= click; k++) { makeClick(s, k, false); }
	}
	shown = f;
}

// The pointer glides to what frame i clicks, and clicks it
function actOut(i) {
	const { step: s, click } = frames[i];
	const move = parseMoveText(steps[s].text);
	const target = targetOf(move, steps[s].thoughts[click].click);
	moveCursor(target, true);
	timers.push(setTimeout(() => {
		timers = [];
		el.cursor.classList.remove("clicking");
		void el.cursor.offsetWidth; // (so the click shows again on the same thing)
		el.cursor.classList.add("clicking");
		makeClick(s, click, true);
		shown = i;
	}, target ? LEAD_MS + MOVE_MS : 0));
}

// Make click k of the ply at step s, through the controller's own calls, as a player's click would
function makeClick(s, k, pressed) {
	const step = steps[s];
	const move = parseMoveText(step.text);
	switch (step.thoughts[k].click) {
		case "nak": press(1, () => game.sideButton1Action(), pressed); break; // Declare 'Not a King'
		case "pick": game.showPartialMove(move.from); break;
		case "to": game.showCompleteMove(move.to, move.enPassant, move.promotion, move.castle); break;
		case "pc": press(1, () => game.sideButton1Action(), pressed); break; // Add PC
		case "king": game.selectPCKing(move.pcKing, move.pcAttackers); break; // the attackers the script names
		case "submit": press(2, () => game.sideButton2Action(), pressed); break; // Submit (or Pass to white)
		case "resign": break; // (Surrender would ask first)
	}
	if (k == step.thoughts.length - 1 && game.ui.record.at(-1) != step.text) {
		// The page made something else of it (the script and the controller disagree): show the ply as written
		if (!move.resign) { console.warn("Demo: acting out '" + step.text + "' gave '" + game.ui.record.at(-1) + "'"); }
		game.restoreGameHistory(pliesUpTo(steps, s).text);
	}
}

// What a click is on (the pointer goes there), and the square its thought points at
function targetOf(move, click) {
	const at = click == "nak" || click == "pc" ? "sideButton1" : click == "submit" ? "sideButton2"
		: click == "pick" ? squareId(move.from) : click == "to" ? squareId(move.to) : click == "king" ? squareId(move.pcKing) : null;
	return at ? $(at) : null;
}

function anchorOf(move, click) {
	return click == "nak" ? move.notAKing : click == "pick" ? move.from : click == "king" ? move.pcKing
		: click == "resign" ? null : move.to ?? move.pcKing;
}

function squareId(coords) {
	return "square" + coords[0] + coords[1];
}

// Stop a click on its way: make it at once, the pointer on what it clicks
function settle() {
	if (timers.length == 0) { return; }
	timers.forEach(clearTimeout);
	timers = [];
	reach(index);
	moveCursor(cursorAt, false);
}

// The pointer to the middle of the element (gliding there, or at once)
function moveCursor(target, glide) {
	cursorAt = target;
	if (!target) { return; }
	const r = target.getBoundingClientRect();
	el.cursor.classList.toggle("jump", !glide);
	el.cursor.style.transform = "translate(" + (r.left + r.width / 2) + "px, " + (r.top + r.height / 2) + "px)";
	if (!glide) {
		void el.cursor.offsetWidth; // (in place before the glide comes back)
		el.cursor.classList.remove("jump");
	}
}

// Show a side button pressed for a moment, as it is pressed
function press(n, action, pressed) {
	const button = n == 1 ? $("sideButton1") : $("sideButton2");
	if (pressed) {
		button.classList.add("tour-press");
		setTimeout(() => button.classList.remove("tour-press"), PRESS_MS);
	}
	action();
}

function square(text) {
	return text ? coordstext2coords(text) : null;
}

////////////////////////////////
// The bubble and the bar
////////////////////////////////

// side: "w" / "b" for a thought, null for the narrator. where: the side of the square the script puts it, or null.
function showBubble(side, text, where, at) {
	place = where;
	el.bubble.dataset.speaker = side ?? "narrator";
	el.speaker.textContent = side == "w" ? "White thinks" : side == "b" ? "Black thinks" : "";
	el.speaker.hidden = side === null;
	el.text.textContent = text;
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
	let side = place;
	if (side && $("board").classList.contains("flipped")) { side = OPPOSITE[side]; }
	b.classList.remove("left", "right", "above", "below");
	if (!at) {
		const left = side == "left" ? 0 : side == "right" ? area.width : (area.width - w) / 2;
		const top = side == "above" ? 0 : side == "below" ? area.height : (area.height - h) / 2;
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
	side ??= towardsMiddle.across;
	const across = side == "left" || side == "right" ? towardsMiddle.down : towardsMiddle.across;
	const order = [side, OPPOSITE[side], across, OPPOSITE[across]];
	side = order.find(p => spare[p] >= 0) ?? order.reduce((most, p) => spare[p] > spare[most] ? p : most);
	const beside = side == "left" || side == "right";
	const left = within(beside ? (side == "left" ? x - gap - w : x + gap) : x - w / 2, w, area.width);
	const top = within(beside ? y - h / 2 : (side == "above" ? y - gap - h : y + gap), h, area.height);
	b.style.left = left + "px";
	b.style.top = top + "px";
	// The tail points at the square, kept off the bubble's rounded corners
	const corner = parseFloat(getComputedStyle(b).fontSize) * 1.2;
	const tail = (pos, size) => Math.min(Math.max(pos, corner), size - corner) + "px";
	b.style.setProperty(beside ? "--tail-y" : "--tail-x", beside ? tail(y - top, h) : tail(x - left, w));
	b.classList.add(/** @type {string} */ (side));
}

function drawBar() {
	el.count.textContent = "Step " + (index + 1) + " of " + frames.length;
	el.back.disabled = index <= 0;
	el.next.disabled = index >= frames.length - 1;
}

// The bubble and the pointer follow their squares when the board changes size or is turned round
function refresh() {
	if (running()) {
		placeBubble(anchor);
		if (timers.length == 0) { moveCursor(cursorAt, false); }
	}
}
new ResizeObserver(refresh).observe(el.area);
// (and once the coordinates' strip has slid in at the start, as the squares shrink to make room for it)
$("board").addEventListener("transitionend", e => { if (e.propertyName == "--coord-strip") { refresh(); } });

$("tourBack").addEventListener("click", back);
$("tourNext").addEventListener("click", next);
$("tourPlay").addEventListener("click", () => stop(true));
$("tourExit").addEventListener("click", () => stop(false));
document.addEventListener("keydown", e => {
	if (!running() || /** @type {Element} */ (e.target).closest?.("input, textarea") || [.../** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".modalWrapper"))].some(m => m.style.display == "block")) { return; }
	if (e.key == "ArrowRight") { next(); }
	else if (e.key == "ArrowLeft") { back(); }
	else if (e.key == "Escape" && !document.body.classList.contains("panel-open")) { stop(false); }
});

export { start, stop, running, next, back, refresh };
