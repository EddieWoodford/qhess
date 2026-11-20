"use strict";

// The board: making its squares, and drawing the pieces and highlights on them.

import { isequal, ismember } from "../engine/utils.js";
import { oppColor } from "../engine/state.js";
import { findChecks } from "../engine/check.js";
import { waveHTML } from "./glyphs.js";
import { dom } from "./dom.js";

// One board square on the page: its button and the highlight flags used when drawing it.
// The piece on the square lives in the game state; controller.js attaches the hover/click handlers.
class SquareView {
	constructor(r, c, button) {
		this.r = r;
		this.c = c;
		this.button = button;
		this.highlighted = 0;
		// 0 = not a potential move; 1-16 = bearing of potential move where 1=NNE, 2=NE, 3=ENE, 4=E, 5=ESE, etc.
		this.potentialMove = 0;
		this.highlightPotKing = 0; // 0 = not a PK; 1 = candidate for PK;
		this.highlightPotAttacker = 0; // 0 = not a PA; 1 = candidate for PA;
		this.color = (r + c) % 2 == 0 ? "w" : "b"; // square colour
	}
	resetButtonClasses() {
		this.button.className = "boardsquare " + (this.color == "w" ? "whitesquare" : "blacksquare");
	}
	// lost: the types the move being made has ruled out for this piece (see lostTypes)
	setWavetext(piece, lost = "") {
		if (piece === null) {
			this.button.innerHTML = "";
		} else {
			this.button.innerHTML = waveHTML(piece.waves(), piece.color, lost);
		}
	}
}

// Fill the empty board element with its rows: file letters along the top and bottom, rank numbers down
// both sides, and the 64 square buttons (id "square{r}{c}", r = 0 for rank 8, c = 0 for file a).
// Only builds the elements; controller.js attaches the handlers and drawBoard() draws into them.
function buildBoard(boardEl = dom.board) {
	const FILES = "abcdefgh";
	const cell = (tag, className, text = "") => {
		const el = document.createElement(tag);
		el.className = className;
		el.textContent = text;
		return el;
	};
	const row = cells => {
		const el = cell("div", "boardrow");
		el.append(...cells);
		return el;
	};
	// (the text in a span, which style.css 7.1 turns upright while the board turns)
	const label = (className, text) => {
		const el = cell("div", className);
		const span = document.createElement("span");
		span.textContent = text;
		el.append(span);
		return el;
	};
	const fileRow = () => row([
		cell("div", "cornercoord"),
		...[...FILES].map(f => label("filecoord", f)),
		cell("div", "cornercoord"),
	]);

	boardEl.replaceChildren();
	boardEl.append(fileRow());
	for (let r = 0; r <= 7; r++) {
		const rank = String(8 - r);
		const squares = [];
		for (let c = 0; c <= 7; c++) {
			const sq = cell("button", "boardsquare");
			sq.id = "square" + r + c;
			squares.push(sq);
		}
		boardEl.append(row([label("rankcoord", rank), ...squares, label("rankcoord", rank)]));
	}
	boardEl.append(fileRow());
}

////////////////////////////////
// Move animation
////////////////////////////////
// When view.animate is set (only for a move in live play, see controller.js), each piece that has moved since
// the last draw slides from its old square to its new one, and each piece that has gone from the board (taken)
// fades out where it was. The slide is a floating copy of the old square's piece ("ghost", style.css 7.5) on top
// of the board; the real piece is drawn on its new square straight away, hidden until the ghost arrives.

const SLIDE_MS = 180;
const FADE_MS = 220;

// Where each piece was at the last draw: "w5" (colour + piece number) -> [r, c]
let drawnPositions = new Map();
// The ghosts still moving, so a new move can finish them first
let runningAnimations = [];
let ghostCount = 0;

function piecePositions(game) {
	const positions = new Map();
	for (let r = 0; r <= 7; r++) {
		for (let c = 0; c <= 7; c++) {
			const piece = game.board[r][c];
			if (piece !== null) {
				positions.set(piece.color + piece.i, [r, c]);
			}
		}
	}
	return positions;
}

function prefersReducedMotion() {
	return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// Compare the board as last drawn with the one about to be drawn, and note what to animate: for each, the old
// square's piece HTML and its place on screen, read now, before the squares are redrawn.
function planAnimations(squares, before, after) {
	const plan = [];
	for (const [key, from] of before) {
		const to = after.get(key);
		if (to && isequal(from, to)) { continue; }
		const fromBtn = squares[from[0]][from[1]].button;
		if (fromBtn.innerHTML == "") { continue; }
		plan.push({
			html: fromBtn.innerHTML,
			fontSize: getComputedStyle(fromBtn).fontSize,
			fromRect: fromBtn.getBoundingClientRect(),
			toBtn: to ? squares[to[0]][to[1]].button : null, // null: taken
		});
	}
	return plan;
}

function makeGhost(item) {
	const ghost = document.createElement("div");
	ghost.className = "piece-ghost";
	ghost.innerHTML = item.html;
	const rect = item.fromRect;
	Object.assign(ghost.style, {
		left: rect.left + "px",
		top: rect.top + "px",
		width: rect.width + "px",
		height: rect.height + "px",
		fontSize: item.fontSize,
	});
	document.body.append(ghost);
	return ghost;
}

function runAnimations(plan) {
	for (const item of plan) {
		const ghost = makeGhost(item);
		let anim;
		if (item.toBtn) {
			const to = item.toBtn.getBoundingClientRect();
			const dx = to.left - item.fromRect.left;
			const dy = to.top - item.fromRect.top;
			// Hide the real piece until the ghost lands. A data attribute, as a redraw resets the classes.
			item.toBtn.dataset.arriving = ++ghostCount;
			ghost.style.zIndex = "2"; // moving pieces pass over the fading ones
			anim = ghost.animate(
				[{ transform: "translate(0, 0)" }, { transform: `translate(${dx}px, ${dy}px)` }],
				{ duration: SLIDE_MS, easing: "ease-out" });
		} else {
			anim = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: "ease-in" });
		}
		const id = String(ghostCount);
		const done = () => {
			ghost.remove();
			// (unless a later move's ghost is now heading for the same square)
			if (item.toBtn && item.toBtn.dataset.arriving === id) { delete item.toBtn.dataset.arriving; }
			runningAnimations = runningAnimations.filter(a => a !== anim);
		};
		anim.finished.then(done, done); // finished or cancelled
		runningAnimations.push(anim);
	}
}

////////////////////////////////
// Dragging a piece
////////////////////////////////
// While a piece is dragged (controller.js), a copy of it follows the pointer (style.css 7.8), above a finger so the
// finger doesn't hide it. It is hidden while the board shows the move to the square under the pointer instead.

let lifted = null; // { ghost, w, h, up }

function liftPiece(button, touch) {
	dropLifted();
	const rect = button.getBoundingClientRect();
	const ghost = makeGhost({ html: button.innerHTML, fontSize: getComputedStyle(button).fontSize, fromRect: rect });
	ghost.classList.add("piece-lifted");
	lifted = { ghost, w: rect.width, h: rect.height, up: touch ? 0.8 * rect.height : 0 };
	document.documentElement.classList.add("piece-dragging");
}

// Centre the copy on the pointer at (x, y) (client coordinates)
function moveLifted(x, y) {
	if (!lifted) {return}
	lifted.ghost.style.left = (x - lifted.w / 2) + "px";
	lifted.ghost.style.top = (y - lifted.h / 2 - lifted.up) + "px";
}

function dropLifted() {
	lifted?.ghost.remove();
	lifted = null;
	document.documentElement.classList.remove("piece-dragging");
}

// The [r, c] of the board square at (x, y) (client coordinates), or null if there isn't one there
function squareAt(x, y) {
	const button = document.elementFromPoint(x, y)?.closest(".boardsquare");
	const match = button && dom.board.contains(button) ? /^square(\d)(\d)$/.exec(button.id) : null;
	return match ? [Number(match[1]), Number(match[2])] : null;
}

////////////////////////////////
// The move arrow
////////////////////////////////
// An arrow over the board (style.css 7.9) from the centre of one square to the centre of another: a line with a
// two-stroke head, drawn twice (a dark edge under a light line) in an SVG laid over the 64 squares with a square as
// its unit, in White's view (the CSS turns it for Black's).

const SVG_NS = "http://www.w3.org/2000/svg";

// move: [[r, c], [r, c]], or null for no arrow
function drawArrow(move) {
	let svg = dom.board.querySelector(".move-arrow");
	if (!svg) {
		svg = document.createElementNS(SVG_NS, "svg");
		svg.setAttribute("class", "move-arrow");
		svg.setAttribute("viewBox", "0 0 8 8");
		svg.setAttribute("aria-hidden", "true");
		for (const part of ["arrow-edge", "arrow-line"]) {
			const path = document.createElementNS(SVG_NS, "path");
			path.setAttribute("class", part);
			svg.append(path);
		}
		dom.board.append(svg);
	}
	for (const path of svg.children) {
		if (move) {
			path.setAttribute("d", arrowPath(move[0], move[1]));
		} else {
			path.removeAttribute("d");
		}
	}
}

// An arrow from square `from` to square `to` (each [r, c]) as SVG path data in square units: the line from the tail
// to the tip, then the head's two strokes back from the tip
function arrowPath(from, to) {
	const HEAD_LENGTH = 0.22, HEAD_HALF_WIDTH = 0.13, TAIL_GAP = 0.12; // in squares
	const [x0, y0] = [from[1] + 0.5, from[0] + 0.5];
	const [x1, y1] = [to[1] + 0.5, to[0] + 0.5];
	const length = Math.hypot(x1 - x0, y1 - y0);
	const [ux, uy] = [(x1 - x0) / length, (y1 - y0) / length]; // along the arrow
	const [nx, ny] = [-uy, ux];                                   // across it
	const at = (along, across) => {
		const x = x0 + ux * along + nx * across, y = y0 + uy * along + ny * across;
		return x.toFixed(3) + " " + y.toFixed(3);
	};
	const base = length - HEAD_LENGTH;
	return "M" + at(TAIL_GAP, 0) + " L" + at(length, 0)
		+ " M" + at(base, HEAD_HALF_WIDTH) + " L" + at(length, 0) + " L" + at(base, -HEAD_HALF_WIDTH);
}

// The types a piece could be at the start of the turn (before: that state) that the move being made has ruled out,
// e.g. "BN"; "" if none, or no move is being made
function lostTypes(piece, before) {
	if (!before || piece === null) { return ""; }
	const now = piece.waves();
	return [...before.pieces[piece.color][piece.i].waves()].filter(t => !now.includes(t)).join("");
}

// Draw every square: its piece, and the classes for its highlights (see style.css sections 7.2 and 7.3).
// view: see render.js
function drawBoard(view) {
	const game = view.game;
	const STATE = view.state;

	// Any move still sliding lands now; then work out this draw's animations before the squares change. (Not while
	// the board is turning round: the squares' places on screen are on the move.)
	for (const anim of runningAnimations.slice()) { anim.finish(); }
	const positions = piecePositions(game);
	const plan = view.animate && !turnFrame && !prefersReducedMotion()
		? planAnimations(view.squares, drawnPositions, positions) : [];
	drawnPositions = positions;

	// Check to show on the board: on the side to move, or while choosing potential-check attackers, on the
	// king being checked
	let checks = findChecks(game, game.turnColor);
	if (STATE == "selectPCAttackers") {
		// Can only get here if player is not in check. Now we want to show the PCKing selected.
		checks = findChecks(game, oppColor(game.turnColor));
	}
	const showChecks = checks.autoCheck || checks.potCheck || STATE == "selectPCAttackers";

	// Whose pieces a press can drag (style.css 7.8), and the dragged piece's copy: shown unless the board shows its move
	if (view.draggable) {
		dom.board.dataset.drag = view.draggable;
	} else {
		delete dom.board.dataset.drag;
	}
	if (lifted) { lifted.ghost.style.visibility = view.drag?.lifted ? "visible" : "hidden"; }

	for (let r = 0; r <= 7; r++) {
		for (let c = 0; c <= 7; c++) {
			const sqr = view.squares[r][c];
			const piece = game.board[r][c];
			const classes = sqr.button.classList;

			sqr.resetButtonClasses();
			sqr.setWavetext(piece, lostTypes(piece, view.before));

			if (STATE == "clear" && view.replayNumber == -1) {
				if (piece !== null && piece.color == game.turnColor) {
					classes.add("selectable");
				}
			}

			// The move being made
			if (isequal([r,c], view.start)) {
				classes.add("selectedStart");
			}
			if (isequal([r,c], view.end)) {
				classes.add("selectedEnd");
			}
			if (view.drag?.lifted && isequal([r,c], view.start)) {
				classes.add("dragOrigin"); // the dragged piece's place, while its copy follows the pointer
			}
			// While a move is staged, show what a click will do (see controller.js squareClick): the staged
			// destination submits it, any other square cancels it. A move into check can only be cancelled.
			// While declaring a potential check, only the highlighted candidates can be chosen: any other square
			// cancels the move too.
			if (STATE == "showCompleteMove" && isequal([r,c], view.end)) {
				classes.add("submitOnClick");
			} else if (STATE == "showCompleteMove" || STATE == "invalidMoveIntoCheck"
					|| (STATE == "selectPCKing" && sqr.highlightPotKing != 1)
					|| (STATE == "selectPCAttackers" && sqr.highlightPotAttacker != 1)) {
				classes.add("cancelOnClick");
			}
			if (view.replayNumber > -1 || (view.multiplayer && STATE != "showPartialMove" && STATE != "showCompleteMove")) {
				// In replay, show the move that led to this position (and in multiplayer, the last move played)
				if (isequal([r,c], view.lastStart)) {
					classes.add("selectedStart");
				}
				if (isequal([r,c], view.lastEnd)) {
					classes.add("selectedEnd");
				}
			}

			// Potential-check candidates
			if (sqr.highlightPotKing == 1) {
				classes.add("potKing");
			}
			if (sqr.highlightPotAttacker == 1) {
				classes.add("potAttacker");
			}

			// A check (or the potential check being declared): the king and its attackers. Once chosen, these
			// replace the candidate backgrounds.
			if (showChecks) {
				if (isequal([r,c], checks.kingCoords)) {
					classes.remove("potKing");
					classes.add("checkKing");
				}
				if (ismember([r,c], checks.attackerCoords)) {
					classes.remove("potAttacker");
					classes.add("checkAttacker");
				}
			}

			// Hovering over a piece, and where it can move
			if (sqr.highlighted) {
				classes.add("hovered");
			}
			// A marker pointing the way the piece moves (style.css 7.3), in the capture colour where it takes a piece.
			// (Not on the square a dragged piece is shown on: it is ringed as the destination instead.)
			if (sqr.potentialMove > 0 && !(STATE == "dragging" && isequal([r,c], view.end))) {
				classes.add("destination", "destination" + sqr.potentialMove);
				if (piece !== null && piece.color != game.turnColor) {
					classes.add("destinationCapture");
				}
			}
		}
	}

	drawArrow(view.arrow);
	runAnimations(plan);
}

// Show the file letters and rank numbers round the board, or hide them. The strip they are in widens or narrows,
// and the squares shrink or grow with it, as a transition (style.css 7.1 and 7.4); but before the board is made
// (the page opening with them on) they just show.
function setCoordsShown(shown) {
	const board = dom.board;
	const instant = board.childElementCount == 0;
	if (instant) { board.style.transition = "none"; }
	board.classList.toggle("show-coords", shown);
	if (instant) {
		getComputedStyle(board).getPropertyValue("--coord-strip"); // (takes the new width now, with no transition)
		board.style.removeProperty("transition");
	}
}

////////////////////////////////
// Turning the board round
////////////////////////////////
// When the view changes between White's and Black's, the new view is laid out at once, and the board drawn turned
// half a turn, which looks just as the old view did; then it turns to rest. As it turns it shrinks, so its corners
// stay inside its place, and its pieces and labels turn back the other way, so they stay upright (style.css 7.1).

const TURN_MS = 500;

let turnAngle = 0; // how far the board is turned from rest as drawn, in degrees clockwise
let turnFrame = 0; // the next frame of the turn, while it is turning
let atRest = [];   // the promises setFlippedBoard gave, to resolve when the board stops

function easeInOut(t) {
	return t < 0.5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2;
}

function drawTurn(angle) {
	const board = dom.board;
	turnAngle = angle;
	board.classList.toggle("turning", angle != 0);
	if (angle == 0) {
		board.style.removeProperty("--turn");
		board.style.removeProperty("--turn-scale");
		return;
	}
	const rad = angle * Math.PI / 180;
	const sin = Math.abs(Math.sin(rad));
	// As large as it can be with its corners inside its place, but no larger than 72% through the middle of the
	// turn, so it doesn't swell back to full size at a quarter turn
	const scale = Math.min(1 / (Math.abs(Math.cos(rad)) + sin), 1 - 0.28 * Math.sqrt(sin));
	board.style.setProperty("--turn", angle + "deg");
	board.style.setProperty("--turn-scale", scale);
}

// Draw the board turned by from degrees, then turn it to rest (taking a time in proportion to how far that is)
function turnFrom(from) {
	drawTurn(from);
	if (from == 0) { return; }
	const start = performance.now();
	const ms = TURN_MS * Math.abs(from) / 180;
	const step = now => {
		const t = Math.min(1, Math.max(0, (now - start) / ms));
		drawTurn(from * (1 - easeInOut(t)));
		if (t < 1) {
			turnFrame = requestAnimationFrame(step);
		} else {
			turnFrame = 0;
			comeToRest();
		}
	};
	turnFrame = requestAnimationFrame(step);
}

function comeToRest() {
	for (const resolve of atRest.splice(0)) { resolve(); }
}

// Show Black's view (flipped true: Black at the bottom) or White's view. The CSS for .flipped reverses the rows
// and columns. The Settings tab's switch always shows which view it is, whether it or a multiplayer game set it.
// Once the board has been made, a change of view turns the board round (above): clockwise to Black's view, back
// the other way to White's. Returns a promise of the board being at rest in its new view.
function setFlippedBoard(flipped) {
	const board = dom.board;
	dom.settings.blackView.checked = flipped;
	if (board.classList.contains("flipped") != flipped) {
		board.classList.toggle("flipped", flipped);
		cancelAnimationFrame(turnFrame);
		turnFrame = 0;
		if (board.childElementCount == 0 || prefersReducedMotion()) {
			drawTurn(0);
		} else if (turnAngle == 0) {
			turnFrom(flipped ? -180 : 180);
		} else {
			// Changed back while still turning: half a turn on from where it was drawn looks the same in this view,
			// so it turns back from there
			turnFrom(turnAngle - Math.sign(turnAngle) * 180);
		}
	}
	const resting = new Promise(resolve => atRest.push(resolve));
	if (!turnFrame) { comeToRest(); }
	return resting;
}

export { SquareView, buildBoard, drawBoard, setFlippedBoard, setCoordsShown, squareAt, liftPiece, moveLifted, dropLifted };
