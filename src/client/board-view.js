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
	setWavetext(piece) {
		if (piece === null) {
			this.button.innerHTML = "";
		} else {
			this.button.innerHTML = waveHTML(piece.waves(), piece.color);
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
	const fileRow = () => row([
		cell("div", "cornercoord"),
		...[...FILES].map(f => cell("div", "filecoord", f)),
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
		boardEl.append(row([cell("div", "rankcoord", rank), ...squares, cell("div", "rankcoord", rank)]));
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

// Draw every square: its piece, and the classes for its highlights (see style.css sections 7.2 and 7.3).
// view: see render.js
function drawBoard(view) {
	const game = view.game;
	const STATE = view.state;

	// Any move still sliding lands now; then work out this draw's animations before the squares change
	for (const anim of runningAnimations.slice()) { anim.finish(); }
	const positions = piecePositions(game);
	const plan = view.animate && !prefersReducedMotion() ? planAnimations(view.squares, drawnPositions, positions) : [];
	drawnPositions = positions;

	// Check to show on the board: on the side to move, or while choosing potential-check attackers, on the
	// king being checked
	let checks = findChecks(game, game.turnColor);
	if (STATE == "selectPCAttackers") {
		// Can only get here if player is not in check. Now we want to show the PCKing selected.
		checks = findChecks(game, oppColor(game.turnColor));
	}
	const showChecks = checks.autoCheck || checks.potCheck || STATE == "selectPCAttackers";

	for (let r = 0; r <= 7; r++) {
		for (let c = 0; c <= 7; c++) {
			const sqr = view.squares[r][c];
			const piece = game.board[r][c];
			const classes = sqr.button.classList;

			sqr.resetButtonClasses();
			sqr.setWavetext(piece);

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
			// While a move is staged, show what a click will do (see controller.js squareClick): the staged
			// destination submits it, any other square cancels it. A move into check can only be cancelled.
			if (STATE == "showCompleteMove" && isequal([r,c], view.end)) {
				classes.add("submitOnClick");
			} else if (STATE == "showCompleteMove" || STATE == "invalidMoveIntoCheck") {
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
			if (sqr.potentialMove > 0) {
				classes.add("destination" + sqr.potentialMove);
			}
		}
	}

	runAnimations(plan);
}

// Show Black's view (flipped true: Black at the bottom) or White's view. The CSS for .flipped reverses the rows
// and columns. The Settings tab's switch always shows which view it is, whether it or a multiplayer game set it.
function setFlippedBoard(flipped) {
	dom.board.classList.toggle("flipped", flipped);
	dom.settings.blackView.checked = flipped;
}

export { SquareView, buildBoard, drawBoard, setFlippedBoard };
