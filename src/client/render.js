"use strict";

// Drawing the page. Everything here only reads the game state and the page state it is given;
// what happens on clicks lives in controller.js.

import { isequal, ismember } from "../engine/utils.js";
import { oppColor } from "../engine/state.js";
import { findChecks, findPotentialKings } from "../engine/check.js";
import { pcMoveText } from "../engine/game.js";
import { WK, WQ, WR, WB, WN, WP, BK, BQ, BR, BB, BN, BP, waveHTML } from "./glyphs.js";

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
		let prevClasses = this.button.className;
		prevClasses = prevClasses.split(" ");
		this.button.classList.remove(...prevClasses);
		this.button.classList.add("boardsquare");
		if (this.color == "w") {
			this.button.classList.add("whitesquare");
		} else {
			this.button.classList.add("blacksquare");
		}
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
// Only builds the elements; controller.js attaches the handlers and render() draws into them.
function buildBoard(boardEl) {
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

// Redraw everything. view = {
//   game:        the game state being shown
//   state:       the click-flow state ("clear", "move0", "showPartialMove", ... see controller.js)
//   squares:     8 x 8 SquareViews
//   start, end:  [r,c] of the move being made, or []
//   lastStart, lastEnd: [r,c] of the last submitted move (highlighted during replay)
//   findPiece:   piece type the find buttons are highlighting, or ""
//   replayNumber: -1, or the replay position (see controller.js)
// }
function render(view) {
	const game = view.game;
	const STATE = view.state;
	let promptlabel = document.getElementById("prompt");
	let moveTextarea = document.getElementById("thismove");
	let sideButton1 = document.getElementById("sideButton1");
	let sideButton2 = document.getElementById("sideButton2");
	let historyArea = document.getElementById("movehistory");
	if (STATE != "move0") {
		historyArea.contentEditable = false;
	}

	// The check flags to describe in the prompt. While the side to move is declaring a potential check, these
	// describe the side being checked (this is how the page has always shown it).
	let promptChecks = { autoCheck: game.autoCheck, potCheck: game.potCheck };
	if (game.pcKing >= 0 && game.pcColor == oppColor(game.turnColor)) {
		promptChecks = findChecks(game, game.pcColor);
	}

	let promptText = "";
	moveTextarea.value = game.thisMove + pcMoveText(game);
	if (game.turnNumber == 0) {
		promptText = "Black<br>Move 0 - ";
	}
	if (game.turnColor == "w") {
		promptText = promptText + "White<br>";
	} else {
		promptText = promptText + "Black<br>";
	}

	if (promptChecks.autoCheck) {
		promptText = promptText + " Check - ";
	}
	if (promptChecks.potCheck) {
		promptText = promptText + " Potential Check - ";
	}

	promptlabel.innerHTML = promptText + " select piece to move.";
	if (game.turnNumber == 0) {
		promptlabel.innerHTML = "Black<br>Move 0 - add Potential Check?";
	}
	if (STATE == "clear") {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
		if (promptChecks.potCheck) {
			sideButton1.style.visibility = "visible";
			sideButton1.innerText = "Declare 'Not a King'";
		}
	} else if (STATE == "move0") {
		sideButton2.style.visibility = "visible";
		sideButton1.style.visibility = "visible";
		sideButton1.innerText = "Add PC";
		sideButton2.innerText = "Pass to white";
	} else if (STATE == "highlightPotentialMoves") {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
	} else if (STATE == "showPartialMove") {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
		promptlabel.innerHTML = promptText + "Select destination";
	} else if (STATE == "showCompleteMove") {
		sideButton2.style.visibility = "visible";
		sideButton2.innerText = "Submit";
		if (findPotentialKings(game).length > 0) {
			promptlabel.innerHTML = promptText + "Add Potential Check / Submit";
			sideButton1.style.visibility = "visible";
			sideButton1.innerText = "Add PC";
		} else {
			promptlabel.innerHTML = promptText + "Submit";
			sideButton1.style.visibility = "hidden";
		}
	} else if (STATE == "invalidMoveIntoCheck") {
		promptlabel.innerHTML = promptText + "Invalid - moved into check";
		sideButton2.style.visibility = "visible";
		sideButton1.style.visibility = "hidden";
		sideButton2.innerText = "Cancel";
	} else if (STATE == "selectPCKing") {
		promptlabel.innerHTML = promptText + "Select King to attack";
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
	} else if (STATE == "selectPCAttackers") {
		promptlabel.innerHTML = promptText + "Select attacking pieces";
		sideButton2.style.visibility = "hidden"; // turned visible when an attacker is found in the loop below
		sideButton1.style.visibility = "hidden";
		sideButton2.innerText = "Submit";
	}

	// Replay Buttons
	let back2 = document.getElementById("back2");
	let back1 = document.getElementById("back1");
	let forward1 = document.getElementById("forward1");
	let forward2 = document.getElementById("forward2");
	let historyButtons = document.getElementsByClassName("historyButton");
	highlightReplayLine(view.replayNumber);
	if (view.replayNumber == -1) {
		followNewMoves(historyArea, game.history);
	}
	if (view.replayNumber == -1) {
		forward1.style.visibility = "hidden";
		forward2.style.visibility = "hidden";
		if (game.turnNumber > 0) {
			back2.style.visibility = "visible";
			back1.style.visibility = "visible";
		} else {
			back2.style.visibility = "hidden";
			back1.style.visibility = "hidden";
		}
		for (let bi = 0; bi < historyButtons.length; bi++) {
			historyButtons[bi].style.visibility = "visible";
		}
	} else {
		back2.style.visibility = "visible";
		back1.style.visibility = "visible";
		forward1.style.visibility = "visible";
		forward2.style.visibility = "visible";

		for (let bi = 0; bi < historyButtons.length; bi++) {
			historyButtons[bi].style.visibility = "hidden";
		}
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "visible";
		sideButton1.innerText = "Resume from here";
	}

	// Check to show on the board: on the side to move, or while choosing potential-check attackers, on the
	// king being checked
	let checks = findChecks(game, game.turnColor);
	if (STATE == "selectPCAttackers") {
		// Can only get here if player is not in check. Now we want to show the PCKing selected.
		checks = findChecks(game, oppColor(game.turnColor));
	}

	// Loop over all the squares and format them according to their current state
	for (let r = 0; r <= 7; r++) {
		for (let c = 0; c <= 7; c++) {
			const sqr = view.squares[r][c];
			const piece = game.board[r][c];

			// Default border:
			sqr.resetButtonClasses();
			if (STATE == "clear" && view.replayNumber == -1) {
				if (piece !== null && piece.color == game.turnColor) {
					sqr.button.classList.add("selectable");
				}
			}

			// Write text of pieces in squares:
			sqr.setWavetext(piece);

			// Change formatting if in non-default state:
			if (isequal([r,c], view.start)) {
				sqr.button.classList.add("selectedStart");
			}
			if (isequal([r,c], view.end)) {
				sqr.button.classList.add("selectedEnd");
			}
			// While a move is staged, show what a click will do (see controller.js squareClick): the staged
			// destination submits it, any other square cancels it. A move into check can only be cancelled.
			if (STATE == "showCompleteMove" && isequal([r,c], view.end)) {
				sqr.button.classList.add("submitOnClick");
			} else if (STATE == "showCompleteMove" || STATE == "invalidMoveIntoCheck") {
				sqr.button.classList.add("cancelOnClick");
			}
			if (view.replayNumber > -1) {
				// In replay, show the move that led to this position
				if (isequal([r,c], view.lastStart)) {
					sqr.button.classList.add("selectedStart");
				}
				if (isequal([r,c], view.lastEnd)) {
					sqr.button.classList.add("selectedEnd");
				}
			}

			if (sqr.highlightPotKing == 1) {
				sqr.button.classList.add("potKing");
			}
			if (sqr.highlightPotAttacker == 1) {
				sqr.button.classList.add("potAttacker");
			}

			// if they're selected then turn off the highlightPot* backgrounds
			if (checks.autoCheck || checks.potCheck || STATE == "selectPCAttackers") {
				if (isequal([r,c], checks.kingCoords)) {
					sqr.button.classList.remove("potKing");
					sqr.button.classList.add("checkKing");
				}
				if (ismember([r,c], checks.attackerCoords)) {
					sqr.button.classList.remove("potAttacker");
					sqr.button.classList.add("checkAttacker");
					if (STATE == "selectPCAttackers") {
						sideButton2.style.visibility = "visible";
					}
				}
			}
			if (sqr.highlighted) {
				sqr.button.classList.add("hovered");
			}
			if (sqr.potentialMove > 0) {
				sqr.button.classList.add("destination" + sqr.potentialMove);
			}
			if (piece !== null) {
				let waves = piece.waves();
				if (view.findPiece != "" && waves.includes(view.findPiece)) {
					sqr.button.classList.add("findHighlight");
				}
			}
		}
	}

	// Build list of captured pieces for display
	let whitecaptured = "<strong>White Captured</strong><br>";
	let blackcaptured = "<strong>Black Captured</strong><br>";
	let whiteorder = [];
	let blackorder = [];
	for (let i=0; i<16; i++) {
		whiteorder.push(game.pieces.w[i].captured);
		blackorder.push(game.pieces.b[i].captured);
	}
	for (let i=0; i <= game.turnNumber; i++) {
		let idx = whiteorder.indexOf(i);
		if (idx > -1) {whitecaptured = whitecaptured + i + '. ' + game.pieces.w[idx].wavesWithBishopColor() + "<br>";}
		idx = blackorder.indexOf(i);
		if (idx > -1) {blackcaptured = blackcaptured + i + '. ' + game.pieces.b[idx].wavesWithBishopColor() + "<br>";}
	}
	document.getElementById("whitecaptured").innerHTML = whitecaptured;
	document.getElementById("blackcaptured").innerHTML = blackcaptured;

	// Update the findpiece buttons to display the correct piece for this color
	const symbols = game.turnColor == "w"
		? { K: WK, Q: WQ, R: WR, N: WN, B: WB, P: WP }
		: { K: BK, Q: BQ, R: BR, N: BN, B: BB, P: BP };
	const removeClass = game.turnColor == "w" ? "blackpiececollapsed" : "whitepiececollapsed";
	const addClass = game.turnColor == "w" ? "whitepiececollapsed" : "blackpiececollapsed";
	for (const wave of "KQRNBP") {
		const el = document.getElementById("find" + wave + "piece");
		el.classList.remove(removeClass);
		el.classList.add(addClass);
		el.innerHTML = symbols[wave];
	}
}

// Highlight the history line for the current replay position (or none when not replaying), and scroll
// the history box so it stays in view
function highlightReplayLine(replayNumber) {
	let historyArea = document.getElementById("movehistory");
	let historyHTML = historyArea.innerHTML;

	let lineStyle = "<span style=\"background-color:lightgrey\">";
	historyHTML = historyHTML.replaceAll(lineStyle,"");
	historyHTML = historyHTML.replaceAll("</span>","");
	let historyLines = historyHTML.split("<br>");
	if (replayNumber > -1) {
		historyLines[replayNumber*2-1] = lineStyle + historyLines[replayNumber*2-1] + "</span>";
	}
	historyArea.innerHTML = historyLines.join("<br>");

	const highlighted = historyArea.querySelector("span");
	if (highlighted) {
		scrollIntoBox(historyArea, highlighted);
	}
}

// During normal play, scroll the history box to the bottom whenever the history changes, so the newest
// move is in view. Only on a change: redrawing for other reasons (hovering a square, say) leaves the box
// where the player scrolled it.
let historyLastShown = null;
function followNewMoves(historyArea, history) {
	if (history !== historyLastShown) {
		historyArea.scrollTop = historyArea.scrollHeight;
		historyLastShown = history;
	}
}

// Scroll box (a scrolling element) just enough that el, inside it, is fully visible.
// Unlike el.scrollIntoView(), this never scrolls the page itself.
function scrollIntoBox(box, el) {
	const boxRect = box.getBoundingClientRect();
	const elRect = el.getBoundingClientRect();
	const style = getComputedStyle(box);
	// The visible area inside the border, less the padding, so the line isn't tucked under the edge
	const visibleTop = boxRect.top + box.clientTop + parseFloat(style.paddingTop);
	const visibleBottom = boxRect.top + box.clientTop + box.clientHeight - parseFloat(style.paddingBottom);
	if (elRect.top < visibleTop) {
		box.scrollTop -= visibleTop - elRect.top;
	} else if (elRect.bottom > visibleBottom) {
		box.scrollTop += elRect.bottom - visibleBottom;
	}
}

function clearFindPieces() {
	for (const wave of "KQRNBP") {
		document.getElementById("find" + wave).classList.remove("findHighlight");
	}
}

// Switch between White's view and Black's view of the board (the CSS for .flipped reverses the rows and columns)
function toggleFlippedBoard() {
	document.getElementById("board").classList.toggle("flipped");
}

function debugPrint(txt) {
	document.getElementById("debug").innerText = txt;
}

export { SquareView, buildBoard, render, clearFindPieces, toggleFlippedBoard, debugPrint };
