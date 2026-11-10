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
		// 0 = not a potential move; 1-16 = bearing of potential move where 1=NNE, 2=NE, 3=ENE, 3=E, 5=ESE, etc.
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

// Draw every square: its piece, and the classes for its highlights (see style.css sections 7.2 and 7.3).
// view: see render.js
function drawBoard(view) {
	const game = view.game;
	const STATE = view.state;

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
			if (view.replayNumber > -1) {
				// In replay, show the move that led to this position
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
}

// Switch between White's view and Black's view of the board (the CSS for .flipped reverses the rows and columns)
function toggleFlippedBoard() {
	dom.board.classList.toggle("flipped");
}

export { SquareView, buildBoard, drawBoard, toggleFlippedBoard };
