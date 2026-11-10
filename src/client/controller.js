"use strict";

// The click flow: what happens when the player hovers or clicks squares and buttons, and the history panel.
// The rules are in src/engine; drawing is in render.js.
//
// The official game state is held by a session (session.js). While a turn is being made, clicks change `game`, a
// working copy of `committed` (the session's state at the start of the turn), and the steps taken are recorded in
// `turnMove`. Submitting hands turnMove to the session, which plays it on the official state and sends back the
// new state; cancelling throws the working copy away.
//
// STATE, the step of the turn the player is on:
//   "move0"                    Black's move 0: optionally add a potential check, then pass to White
//   "clear"                    waiting for the player to pick a piece
//   "highlightPotentialMoves"  hovering over one of their pieces (its moves are shown)
//   "showPartialMove"          a piece is picked; waiting for its destination
//   "showCompleteMove"         the move is made; Submit, or Add PC (potential check)
//   "invalidMoveIntoCheck"     the move leaves the player in check; it can only be cancelled
//   "selectPCKing"             choosing which opponent piece to declare potential check on
//   "selectPCAttackers"        choosing which pieces attack it; then Submit

import { ismember } from "../engine/utils.js";
import { cloneState, getPieces } from "../engine/state.js";
import { getPotentialMoves } from "../engine/moves.js";
import { findPotentialKings, findPCAttackers } from "../engine/check.js";
import { declareNotAKing as engineDeclareNotAKing, startMove, choosePCKing, addPCAttacker } from "../engine/game.js";
import { getHistoryLines, parseMoveText } from "../engine/notation.js";
import { SquareView, render, clearFindPieces, debugPrint } from "./render.js";
import { LocalSession } from "./session.js";

const session = new LocalSession();
let committed; // the session's game state at the start of the current turn: see src/engine/state.js
let game;      // the game state being shown and changed by clicks: a working copy of `committed`
let turnMove;  // the turn being made, as a move for session.submitMove (see newTurnMove)

// Page state
let SQUARES; // 8 x 8 array of SquareView objects (the page's buttons)
let STARTCOORDS; // [r,c] of the move being made, or [] if none
let ENDCOORDS;
let LASTSTARTCOORDS; // start square of the last submitted move, for replay highlighting
let LASTENDCOORDS;   // end square of the last submitted move
let FINDPIECE;
let STATE;
// -1 when not replaying. While stepping through the history, the position being shown, in moves:
// 0.5 = after Black's move 0, 1 = after White's move 1, 1.5 = after Black's move 1, ...
let REPLAYNUMBER = -1;

const ask = question => confirm(question);

////////////////////////////////
// Turns
////////////////////////////////

// A turn with nothing done yet, in the same shape as notation.js parseMoveText
function newTurnMove() {
	return { notAKing: null, from: null, to: null, enPassant: false, promotion: false, pcKing: null, pcAttackers: [] };
}

// Whenever the session's game state changes (a new game, or an accepted move), start a fresh turn from it
session.onChange(state => {
	committed = state;
	game = cloneState(committed);
	turnMove = newTurnMove();
});

// Throw away the move being made and go back to the start of the turn
function cancelTurn() {
	game = cloneState(committed);
	turnMove = newTurnMove();
	clearFindPotentialCheckPieces();
}

////////////////////////////////
// Button Actions
////////////////////////////////
function sideButton1Click() {
	if (REPLAYNUMBER > -1) {
		// When in replay mode, sideButton1 is 'Resume Game From Here'
		let foo = REPLAYNUMBER;
		REPLAYNUMBER = -1;
		restoreGameHistory(null, 2*foo);
	} else {
		sideButton1Action();
	}
}

function sideButton1Action() {
	if (STATE == "showCompleteMove" || STATE == "move0") {
		highlightPotentialKings();
		setState("selectPCKing");
	} else if (STATE == "clear" && game.potCheck) {
		declareNotAKing();
		setState("clear");
	}
}

function sideButton2Click() {
	// Can put extra code here that will only happen when user clicks the button, rather than when the script calls
	// sideButton2Action() to replicate a user click
	sideButton2Action();
}

function sideButton2Action() {
	if (STATE == "showCompleteMove" || STATE == "selectPCAttackers" || STATE == "move0") {
		submitMove();
		setState("clear");
	} else if (STATE == "invalidMoveIntoCheck") {
		cancelTurn();
		setState("clear");
	}
}

function declareNotAKing() {
	const result = engineDeclareNotAKing(game);
	if (result.ok) {
		turnMove.notAKing = result.square;
	}
	clearFindPotentialCheckPieces();
}

function submitMove() {
	// Here after clicking Submit (or "Pass to white" on move 0) when a valid move is staged.
	// The session plays the recorded turn on the official game state; its onChange starts the next turn.
	const result = session.submitMove(turnMove);
	if (!result.ok) {
		debugPrint("Move not accepted: " + result.error);
		cancelTurn();
		return;
	}
	if (REPLAYNUMBER == -1) {
		document.getElementById("movehistory").innerText = game.history;
	}
	// Remember this move's squares so replay can highlight the last move
	LASTSTARTCOORDS = STARTCOORDS;
	LASTENDCOORDS = ENDCOORDS;
	clearFindPotentialCheckPieces();
}

function findPiecesClick(wave) {
	clearFindPieces();
	if (wave == FINDPIECE) {
		FINDPIECE = "";
	} else {
		FINDPIECE = wave;
		document.getElementById("find"+wave).classList.add("findHighlight");
	}
	setState(STATE);
}

////////////////////////////////
// Squares
////////////////////////////////
function squareEnter(coords) {
	if (STATE == "clear") {
		highlightPotentialMoves(coords);
	}
}

function squareLeave(coords) {
	if (STATE == "highlightPotentialMoves") {
		setState("clear");
	}
}

function squareClick(coords) {
	if (REPLAYNUMBER > -1) {return}
	FINDPIECE = "";
	clearFindPieces();
	if (STATE == "highlightPotentialMoves") {
		showPartialMove(coords);
	} else if (STATE == "showPartialMove") {
		showCompleteMove(coords);
	} else if (STATE == "selectPCKing") {
		selectPCKing(coords);
	} else if (STATE == "selectPCAttackers") {
		selectPCAttackers(coords);
	} else if (STATE == "move0") {
		setState("move0");
	} else {
		cancelTurn();
		setState("clear");
	}
}

// Mark the squares a piece could move to, with the direction of each move (for the arrow styling)
function markDestinations(coords) {
	let moves = getPotentialMoves(game, coords);
	for (let i=0; i < moves.length; i++) {
		let delY = coords[0] - moves[i][0];
		let delX = moves[i][1] - coords[1];
		// returns 1-16 = bearing of potential move where 1=NNE, 2=NE, 3=ENE, 3=E, 5=ESE, etc.
		let bearing = (Math.round(((Math.atan2(delX, delY) * 180) / Math.PI)/22.5) + 16 - 1) % 16 + 1;
		SQUARES[moves[i][0]][moves[i][1]].potentialMove = bearing;
	}
}

function highlightPotentialMoves(coords) {
	// Highlight potential moves temporarily while mouse is over square
	let piece = game.board[coords[0]][coords[1]];
	if (piece === null) {return;}
	if (piece.captured > -1) {return;}
	if (piece.color == game.turnColor) {
		SQUARES[coords[0]][coords[1]].highlighted = 1;
		markDestinations(coords);
		setState("highlightPotentialMoves");
	}
}

function showPartialMove(coords) {
	// Show potential moves after clicking on start location
	let piece = game.board[coords[0]][coords[1]];
	if (piece !== null && piece.color == game.turnColor) {
		STARTCOORDS = coords;
		markDestinations(coords);
		setState("showPartialMove");
	}
}

function showCompleteMove(endCoords,doEP,doPromotion) {
	// After clicking on destination. doEP / doPromotion (do en passant / promotion) are normally left out, and the
	// player is asked if the move is ambiguous.
	const result = startMove(game, STARTCOORDS, endCoords, { enPassant: doEP, promotion: doPromotion, ask });
	if (!result.ok) {
		setState("clear");
		return;
	}
	ENDCOORDS = endCoords;
	turnMove.from = STARTCOORDS;
	turnMove.to = endCoords;
	turnMove.enPassant = result.enPassant;
	turnMove.promotion = result.promotion;
	clearFindPotentialCheckPieces();
	if (result.movedIntoCheck) {
		// We will still display the invalid move, but make it impossible to submit, as
		// the player might want to inspect the board to understand how the check happened.
		setState("invalidMoveIntoCheck");
	} else {
		setState("showCompleteMove");
	}
}

////////////////////////////////
// Potential check
////////////////////////////////

// Highlight the opponent pieces that could be the king and are under attack (the candidates for a
// potential check). Returns how many there are.
function highlightPotentialKings() {
	const kings = findPotentialKings(game);
	for (const [r, c] of kings) {
		SQUARES[r][c].highlightPotKing = 1;
	}
	return kings.length;
}

// Highlight the side to move's pieces that could attack the chosen potential-check king, and
// un-highlight the rest. Returns their coordinates.
function highlightPCAttackers() {
	const attackers = findPCAttackers(game);
	for (const piece of getPieces(game, game.turnColor)) {
		if (piece.captured > -1) {continue}
		SQUARES[piece.r][piece.c].highlightPotAttacker = ismember([piece.r, piece.c], attackers) ? 1 : 0;
	}
	return attackers;
}

function clearFindPotentialCheckPieces() {
	for (let r=0; r<8; r++) {
		for (let c=0; c<8; c++) {
			SQUARES[r][c].highlightPotKing = 0;
			SQUARES[r][c].highlightPotAttacker = 0;
		}
	}
}

function selectPCKing(kingCoords) {
	// Get here after clicking on a square in "selectPCKing" state
	const result = choosePCKing(game, kingCoords);
	if (!result.ok) {
		cancelTurn();
		setState("clear");
		return
	}
	turnMove.pcKing = kingCoords;
	clearFindPotentialCheckPieces(); // stop highlighting the potential kings
	let potAttackerCoords = highlightPCAttackers();
	if (potAttackerCoords.length == 1) {
		selectPCAttackers(potAttackerCoords[0]);
	} else {
		setState("selectPCAttackers");
	}
}

function selectPCAttackers(attackerCoords) {
	// Get here when a PC attacker is selected by clicking on its square
	const result = addPCAttacker(game, attackerCoords);
	if (!result.ok) {
		// clicked on an empty square, or a piece which doesn't attack the PC king
		cancelTurn();
		setState("clear");
		return
	}
	turnMove.pcAttackers.push(attackerCoords);
	clearFindPotentialCheckPieces();
	if (result.movedIntoCheck) {
		// By setting a potential check the attacker collapsed down to a true king and put themselves in check
		setState("invalidMoveIntoCheck");
		return;
	}
	highlightPCAttackers();
	setState("selectPCAttackers");
}

////////////////////////////////
// Move History
////////////////////////////////
function restoreGameHistory(historyText,nMoves) {
	// Restore a game from historyText, or if that's left out from whatever is in the move history box.
	// nMoves: only replay the first nMoves plies (used when stepping through a replay).
	let historyArea = document.getElementById("movehistory");
	let historyLines;
	if (historyText != undefined) {
		historyLines = getHistoryLines(historyText);
		historyArea.innerText = historyLines.join("\r\n");
	} else {
		historyLines = getHistoryLines(historyArea.innerText);
	}
	setup();
	if (nMoves == undefined) {
		nMoves = historyLines.length;
	}
	let replayed = 0;
	for (let i=0; i < nMoves; i++) {
		if (historyLines[i] != "") {
			if (!replayPly(historyLines[i])) { break; }
			replayed++;
		}
	}
	if (replayed > 0) {
		setState("clear");
	}
}

function replayPly(moveText) {
	// Apply one ply of notation to the game, without redrawing. Returns false (and shows why) if it can't be played.
	let move = parseMoveText(moveText);
	// Check that the move number eg "3w. " is correct.
	if (move.turn != game.turnNumber.toString() + game.turnColor) {
		debugPrint("Move text number + colour did not match expected");
	}
	const result = session.submitMove(move);
	if (!result.ok) {
		debugPrint("Couldn't replay '" + moveText + "': " + result.error);
		cancelTurn();
		return false;
	}
	if (REPLAYNUMBER == -1) {
		document.getElementById("movehistory").innerText = game.history;
	}
	// Remember this move's squares so replay can highlight the last move
	LASTSTARTCOORDS = move.from ?? [];
	LASTENDCOORDS = move.to ?? [];
	clearFindPotentialCheckPieces();
	return true;
}

function doMoveFromText(moveText) {
	// Play one ply of notation and redraw. Returns false if it can't be played.
	if (!replayPly(moveText)) {
		return false;
	}
	setState("clear");
	return true;
}

function copyAllHistory() {
	let historyArea = document.getElementById("movehistory");
	let historyText = historyArea.innerText;
	navigator.clipboard.writeText(historyText);
}

function copyLastMove() {
	let historyArea = document.getElementById("movehistory");
	let historyText = historyArea.innerText;
	let historyLines = getHistoryLines(historyText);
	navigator.clipboard.writeText(historyLines[historyLines.length-1]);
}

function pasteAllRestore() {
	let historyArea = document.getElementById("movehistory");
	historyArea.innerText = "";
	navigator.clipboard.readText().then((clipText) => (restoreGameHistory(clipText)));
}

function pasteLineRestore() {
	let historyArea = document.getElementById("movehistory");
	let historyLines = getHistoryLines(historyArea.innerText);
	let historyText = historyLines.join("\r\n");
	navigator.clipboard.readText().then((clipText) => (restoreGameHistory(historyText + "\r\n" + clipText)));
}

function stepBackAll() {
	REPLAYNUMBER = 0.5;
	restoreGameHistory(null, 2*REPLAYNUMBER);
}

function stepBackMove() {
	if (REPLAYNUMBER == -1) {
		// starting replay from game state
		if (game.turnColor == "w") {
			REPLAYNUMBER = game.turnNumber - 0.5;
		} else {
			REPLAYNUMBER = game.turnNumber;
		}
	}
	REPLAYNUMBER = REPLAYNUMBER - 0.5;
	REPLAYNUMBER = Math.max(REPLAYNUMBER,0.5);
	restoreGameHistory(null, 2*REPLAYNUMBER);
}

function stepForwardMove() {
	let historyArea = document.getElementById("movehistory");
	let historyLines = getHistoryLines(historyArea.innerText);
	if (REPLAYNUMBER < historyLines.length/2) {
		let moveText = historyLines[2*REPLAYNUMBER];
		REPLAYNUMBER = REPLAYNUMBER + 0.5;
		doMoveFromText(moveText);
	}
}

function stepForwardAll() {
	let historyArea = document.getElementById("movehistory");
	let historyLines = getHistoryLines(historyArea.innerText);
	REPLAYNUMBER = historyLines.length/2;
	restoreGameHistory(null, 2*REPLAYNUMBER);
}

////////////////////////////////
// State Control
////////////////////////////////

// Move to a new step of the turn: reset the highlights that don't belong to it, then redraw
function setState(stateIn) {
	if (stateIn == "clear" && game.turnNumber == 0) {
		stateIn = "move0";
	}
	STATE = stateIn;
	if (STATE == "clear" || STATE == "move0") {
		STARTCOORDS = [];
		ENDCOORDS = [];
	}
	if (STATE != "selectPCAttackers" && STATE != "selectPCKing" && STATE != "highlightPotentialMoves" && STATE != "clear") {
		clearFindPotentialCheckPieces();
	}
	for (const row of SQUARES) {
		for (const sqr of row) {
			if (STATE == "clear" || STATE == "move0") {
				// For other states, the properties are set in calling functions, but you can always reset to clear by
				// just calling setState("clear")
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
				sqr.highlightPotKing = 0;
				sqr.highlightPotAttacker = 0;
			}
			if (STATE == "showPartialMove") {
				sqr.highlighted = 0;
			}
			if (STATE == "showCompleteMove" || STATE == "invalidMoveIntoCheck") {
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
			}
			if (STATE == "selectPCAttackers") {
				sqr.highlightPotKing = 0;
			}
		}
	}
	render({
		game,
		state: STATE,
		squares: SQUARES,
		start: STARTCOORDS,
		end: ENDCOORDS,
		lastStart: LASTSTARTCOORDS,
		lastEnd: LASTENDCOORDS,
		findPiece: FINDPIECE,
		replayNumber: REPLAYNUMBER,
	});
}

function setup() {
	session.reset(); // its onChange sets committed, game and turnMove
	SQUARES = []; // 8 x 8 array of SquareView objects (the page's buttons)
	STARTCOORDS = [];
	ENDCOORDS = [];
	LASTSTARTCOORDS = [];
	LASTENDCOORDS = [];
	FINDPIECE = "";

	let moveTextarea = document.getElementById("thismove");
	moveTextarea.value = "";
	if (REPLAYNUMBER == -1) {
		let historyArea = document.getElementById("movehistory");
		historyArea.innerText = "";
		historyArea.contentEditable = true;
	}

	for (let r = 0; r <= 7; r++) {
		let viewRow = [];
		for (let c = 0; c <= 7; c++) {
			const sqr = new SquareView(r, c, document.getElementById("square" + r + c));
			const coords = [r, c];
			sqr.button.onmouseenter = () => squareEnter(coords);
			sqr.button.onmouseleave = () => squareLeave(coords);
			sqr.button.onclick = () => squareClick(coords);
			viewRow.push(sqr);
		}
		SQUARES.push(viewRow);
	}
	setState("move0");
}

////////////////////////////////
// Exports
////////////////////////////////
export {
	// Used by src/client/main.js to wire up the page
	setup,
	sideButton1Click,
	sideButton2Click,
	findPiecesClick,
	stepBackAll,
	stepBackMove,
	stepForwardMove,
	stepForwardAll,
	restoreGameHistory,
	copyAllHistory,
	copyLastMove,
	pasteAllRestore,
	pasteLineRestore,

	// Used by tests/test.html and tests/generate.html to drive and inspect the game
	game,
	sideButton1Action,
	sideButton2Action,
	getHistoryLines,
	doMoveFromText,
	showPartialMove,
	showCompleteMove,
	selectPCKing,
	selectPCAttackers,
	getPotentialMoves,
	SQUARES,
	STATE,
};
