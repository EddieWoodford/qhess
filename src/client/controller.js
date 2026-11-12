"use strict";

// The click flow: what happens when the player hovers or clicks squares and buttons, and the history panel.
// The rules are in src/engine; drawing is in render.js.
//
// The official game state is held by a session (session.js). While a turn is being made, clicks change `game`, a
// working copy of `committed` (the session's state at the start of the turn), and the steps taken are recorded in
// `turnMove`. Submitting hands turnMove to the session, which plays it on the official state and sends back the
// new state; cancelling throws the working copy away.
//
// ui.state, the step of the turn the player is on:
//   "move0"                    Black's move 0: optionally add a potential check, then pass to White
//   "clear"                    waiting for the player to pick a piece
//   "highlightPotentialMoves"  a mouse is hovering over one of their pieces (its moves are shown); touch skips this
//   "showPartialMove"          a piece is picked; waiting for its destination
//   "showCompleteMove"         the move is made; Submit, or Add PC (potential check)
//   "invalidMoveIntoCheck"     the move leaves the player in check; it can only be cancelled
//   "selectPCKing"             choosing which opponent piece to declare potential check on
//   "selectPCAttackers"        choosing which pieces attack it; then Submit
//   "gameOver"                 checkmate or stalemate (the game state's result): nobody can move
// and in a multiplayer game, while the player can't move:
//   "waitJoin"                 the game is made, and waiting for the friend to join with the code
//   "waitOpponent"             the opponent's turn
//   "sendingMove"              the player's move is on its way to the server
//   "multiplayerOver"          the game has ended (the opponent left, or it couldn't be joined)
//
// Multiplayer: the session is a SocketSession (socket-session.js) instead of a LocalSession, and ui.multiplayer
// says what the Multiplayer tab and status bar show. Moves arrive from the server at any time, so its onChange
// redraws the page itself. Stepping back through the history then uses its own LocalSession (viewSession), so
// the real game is never rewound; stepping forward to the end returns to it.

import { isequal, ismember } from "../engine/utils.js";
import { createInitialState, cloneState, getPieces } from "../engine/state.js";
import { getPotentialMoves } from "../engine/moves.js";
import { getMoveDestinations } from "../engine/castling.js";
import { findPotentialKings, findPCAttackers } from "../engine/check.js";
import { declareNotAKing as engineDeclareNotAKing, startMove, choosePCKing, addPCAttacker, applyMove } from "../engine/game.js";
import { getHistoryLines, parseMoveText } from "../engine/notation.js";
import { SquareView, buildBoard, setFlippedBoard } from "./board-view.js";
import { render, debugPrint } from "./render.js";
import { dom } from "./dom.js";
import { showChoice } from "./modals.js";
import { LocalSession } from "./session.js";
import { SocketSession, savedSeat } from "./socket-session.js";

let session;            // the official game: a LocalSession, or a SocketSession in a multiplayer game
let viewSession = null; // multiplayer only: a LocalSession for stepping through the history (see boardSession)
let committed; // the session's game state at the start of the current turn: see src/engine/state.js
let game;      // the game state being shown and changed by clicks: a working copy of `committed`
let turnMove;  // the turn being made, as a move for session.submitMove (see newTurnMove)

// Page state: everything about what the page is showing, apart from the game itself
const ui = {
	state: "move0",  // the step of the turn (see the list above)
	start: [],       // [r,c] of the move being made, or [] if none
	end: [],
	lastStart: [],   // start square of the last submitted move, for replay highlighting
	lastEnd: [],     // end square of the last submitted move
	// The game record shown in the History tab, one ply per line. It follows the game as moves are made, and
	// stays as it is while replaying (so the later moves can be stepped forward through).
	record: [],
	// -1 when not replaying. While stepping through the history, the position being shown, in moves:
	// 0.5 = after Black's move 0, 1 = after White's move 1, 1.5 = after Black's move 1, ...
	replay: -1,
	// null in a single-player game. In a multiplayer game, what the page shows about it: SocketSession info()
	// ({ phase, code, color, opponent, connection, pending, endedReason }) and message (why it ended, or "").
	multiplayer: null,
	// The Settings tab's Potential Check switch. Off: no Add PC, and Black's move 0 is passed by itself.
	// A multiplayer game always uses the rule (see pcRule), as both players must play by the same rules.
	potentialCheck: true,
};

// The steps when the player can't do anything (see the list at the top): a multiplayer game's waits, and the end
const WAITING_STATES = ["waitJoin", "waitOpponent", "sendingMove", "multiplayerOver", "gameOver"];

// 8 x 8 array of SquareView objects (the board's buttons and their highlight flags). Made once, by init().
let squares;

////////////////////////////////
// Questions during a move
////////////////////////////////
// When a move is ambiguous, the engine (startMove) asks one of these and needs a true/false answer straight away.
// The page asks in a dialog instead, which answers later: see showCompleteMove.
const QUESTION_EN_PASSANT = "En passant?";
const QUESTION_PROMOTION = "Promote Pawn?";
const QUESTION_CASTLE = "Castle?";

// How each question is put to the player
const CHOICES = {
	[QUESTION_EN_PASSANT]: {
		text: "This piece could be a pawn. Take en passant? (It will be a pawn if you do, and not a pawn if you don't.)",
		yes: "Take en passant",
		no: "Normal move",
	},
	[QUESTION_PROMOTION]: {
		text: "This piece could be a pawn. Promote it? (It will be a promoted pawn if you do, and not a pawn if you don't.)",
		yes: "Promote",
		no: "Don't promote",
	},
	[QUESTION_CASTLE]: {
		text: "This piece could be the king. Castle? (It will be the king and the other piece a rook if you do, and it won't be the king if you don't.)",
		yes: "Castle",
		no: "Normal move",
	},
};

// Thrown by askInPage to stop the engine part-way through a move until the player has answered
class ChoiceNeeded extends Error {
	constructor(question) {
		super("Needs an answer: " + question);
		this.question = question;
	}
}

function askInPage(question) {
	throw new ChoiceNeeded(question);
}

// Show the question in the choice dialog; onAnswer(true / false), or onAnswer(null) if it's closed without answering
function askChoice(question, onAnswer) {
	const choice = CHOICES[question] ?? { text: question, yes: "Yes", no: "No" };
	showChoice(choice, onAnswer);
}

// For tests and automation: answer the questions straight away with handler(question) => true / false, instead
// of asking in the page. null puts the dialog back.
let choiceHandler = null;
function setChoiceHandler(handler) {
	choiceHandler = handler;
}

////////////////////////////////
// Turns
////////////////////////////////

// A turn with nothing done yet, in the same shape as notation.js parseMoveText
function newTurnMove() {
	return { notAKing: null, from: null, to: null, enPassant: false, promotion: false, castle: false, pcKing: null, pcAttackers: [] };
}

// Start a fresh turn from this game state
function adopt(state) {
	committed = state;
	game = cloneState(committed);
	turnMove = newTurnMove();
}

// Make s the official game. Whenever its state changes (a new game, or an accepted move), a fresh turn starts
// from it. In single player that happens inside the call that changed it, which then redraws; in multiplayer
// it can happen at any time (the opponent's move arriving), so liveChanged redraws.
function useSession(s) {
	session = s;
	s.onChange(state => {
		if (session !== s) { return; } // an old session
		if (isMultiplayer()) {
			liveChanged(state);
		} else {
			adopt(state);
		}
	});
}

// The session the board is replaying moves into: the official one, except while stepping through a
// multiplayer game's history, which mustn't rewind the real game
function boardSession() {
	if (isMultiplayer() && ui.replay > -1) {
		if (!viewSession) {
			viewSession = new LocalSession();
			viewSession.onChange(adopt);
		}
		return viewSession;
	}
	return session;
}

function isMultiplayer() {
	return ui.multiplayer !== null;
}

// Whether the player can declare potential checks: the Settings switch, except that a multiplayer game always can.
// (A potential check already declared still has to be answered either way: the engine's rules don't change.)
function pcRule() {
	return ui.potentialCheck || isMultiplayer();
}

// The Settings tab's Potential Check switch changed. Takes effect straight away.
function setPotentialCheckRule(on) {
	ui.potentialCheck = on;
	if (!squares) { return; } // the page is still starting: init() starts the game with the rule as set
	if (on && !isMultiplayer() && ui.replay == -1 && committed.history.trim() == "0b.") {
		// Nothing has happened beyond the skipped move 0: start again at move 0, so Black can use it
		newGame();
	} else {
		skipMove0();
	}
	draw();
}

// Without the Potential Check rule, Black's move 0 has nothing to do, so it is passed by itself (writing "0b.",
// as "Pass to white" does). Only at the live end of a single-player game, never while stepping through the history.
function skipMove0() {
	if (!pcRule() && ui.replay == -1 && ui.state == "move0") {
		submitMove();
		setState("clear");
	}
}

useSession(new LocalSession());

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
	if (ui.replay > -1 && isMultiplayer()) {
		// In a multiplayer game, sideButton1 is 'Back to game' while replaying
		exitReplay();
	} else if (ui.replay > -1) {
		// When in replay mode, sideButton1 is 'Resume Game From Here': the moves up to the one shown become the game
		const plies = 2 * ui.replay;
		ui.replay = -1;
		restoreGameHistory(null, plies);
	} else {
		sideButton1Action();
	}
}

function sideButton1Action() {
	if ((ui.state == "showCompleteMove" || ui.state == "move0") && pcRule()) {
		highlightPotentialKings();
		setState("selectPCKing");
	} else if (ui.state == "clear" && game.potCheck) {
		declareNotAKing();
		setState("clear");
	}
}

function sideButton2Click() {
	if (ui.replay > -1) {
		// When in replay mode (single player), sideButton2 is 'Back to game': the whole record, as it was
		ui.replay = -1;
		restoreGameHistory(null);
		return;
	}
	sideButton2Action();
}

function sideButton2Action() {
	if (ui.state == "showCompleteMove" || ui.state == "selectPCAttackers" || ui.state == "move0") {
		submitMove();
		setState("clear");
	} else if (ui.state == "invalidMoveIntoCheck") {
		cancelTurn();
		setState("clear");
	} else if (["clear", "highlightPotentialMoves", "showPartialMove"].includes(ui.state)) {
		surrender();
	}
}

// Before a move is staged, the Submit button is Surrender. Asks first; a surrender is a turn of its own.
const SURRENDER_CHOICE = { text: "Surrender the game? Your opponent wins.", yes: "Surrender", no: "Keep playing" };
function surrender() {
	const onAnswer = yes => {
		if (!yes || game.result || !["clear", "highlightPotentialMoves", "showPartialMove"].includes(ui.state)) {
			return; // changed its mind, or the game moved on while the dialog was open
		}
		cancelTurn();
		turnMove.resign = true;
		submitMove();
		setState("clear");
	};
	if (choiceHandler) {
		onAnswer(choiceHandler(SURRENDER_CHOICE.text));
	} else {
		showChoice(SURRENDER_CHOICE, onAnswer);
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
	// In multiplayer the answer comes later (result.pending): the move stays on the board meanwhile.
	const result = session.submitMove(turnMove);
	if (!result.ok) {
		debugPrint("Move not accepted: " + result.error);
		cancelTurn();
		return;
	}
	if (!result.pending) {
		followRecord();
	}
	// Remember this move's squares so replay can highlight the last move
	ui.lastStart = ui.start;
	ui.lastEnd = ui.end;
	clearFindPotentialCheckPieces();
}

////////////////////////////////
// Squares
////////////////////////////////
// Hovering is only a preview, for a mouse (or pen): a piece's moves are shown while the pointer is over it.
// Nothing depends on it. A tap (or a click without hovering first) picks the piece straight away.
function squareEnter(coords, event) {
	if (event.pointerType == "touch") {return}
	if (ui.state == "clear") {
		highlightPotentialMoves(coords);
	}
}

function squareLeave(coords, event) {
	if (event.pointerType == "touch") {return}
	if (ui.state == "highlightPotentialMoves") {
		setState("clear");
	}
}

function squareClick(coords) {
	if (ui.replay > -1) {return}
	if (WAITING_STATES.includes(ui.state)) {return}
	if (ui.state == "highlightPotentialMoves" || ui.state == "clear") {
		pickPiece(coords);
	} else if (ui.state == "showPartialMove") {
		chooseDestination(coords);
	} else if (ui.state == "selectPCKing") {
		selectPCKing(coords);
	} else if (ui.state == "selectPCAttackers") {
		selectPCAttackers(coords);
	} else if (ui.state == "move0") {
		setState("move0");
	} else if (ui.state == "showCompleteMove" && isequal(coords, ui.end)) {
		// Clicking the staged destination again submits the move, same as the Submit button
		sideButton2Action();
	} else {
		cancelTurn();
		setState("clear");
	}
}

// Mark the squares a piece could move to, with the direction of each move (for the arrow styling)
function markDestinations(coords) {
	let moves = getMoveDestinations(game, coords);
	for (let i=0; i < moves.length; i++) {
		let delY = coords[0] - moves[i][0];
		let delX = moves[i][1] - coords[1];
		// 1-16 = bearing of potential move where 1=NNE, 2=NE, 3=ENE, 4=E, 5=ESE, etc.
		let bearing = (Math.round(((Math.atan2(delX, delY) * 180) / Math.PI)/22.5) + 16 - 1) % 16 + 1;
		squares[moves[i][0]][moves[i][1]].potentialMove = bearing;
	}
}

function highlightPotentialMoves(coords) {
	// Highlight potential moves temporarily while mouse is over square
	let piece = game.board[coords[0]][coords[1]];
	if (piece === null) {return;}
	if (piece.captured > -1) {return;}
	if (piece.color == game.turnColor) {
		squares[coords[0]][coords[1]].highlighted = 1;
		markDestinations(coords);
		setState("highlightPotentialMoves");
	}
}

// A click while no piece is picked: pick it if it's one of the mover's pieces, otherwise do nothing
function pickPiece(coords) {
	const piece = game.board[coords[0]][coords[1]];
	if (piece !== null && piece.color == game.turnColor) {
		setState("clear"); // drop any hover preview
		showPartialMove(coords);
	} else {
		cancelTurn();
		setState("clear");
	}
}

// A click while a piece is picked: move it there if it can go there. Clicking another of the mover's pieces
// picks that one instead; clicking the picked piece again, or anywhere else, puts it back.
function chooseDestination(coords) {
	const piece = game.board[coords[0]][coords[1]];
	if (ismember(coords, getMoveDestinations(game, ui.start))) {
		showCompleteMove(coords);
	} else if (piece !== null && piece.color == game.turnColor && !isequal(coords, ui.start)) {
		setState("clear");
		showPartialMove(coords);
	} else {
		setState("clear");
	}
}

function showPartialMove(coords) {
	// Show potential moves after clicking on start location
	let piece = game.board[coords[0]][coords[1]];
	if (piece !== null && piece.color == game.turnColor) {
		ui.start = coords;
		markDestinations(coords);
		setState("showPartialMove");
	}
}

function showCompleteMove(endCoords,doEP,doPromotion,doCastle) {
	// After clicking on destination. doEP / doPromotion / doCastle (do en passant / promotion / castle) are normally
	// left out, and the player is asked if the move is ambiguous.
	// The move is tried on a copy of the working state, because the engine asks part-way through the move: if a
	// question comes up, the copy is thrown away, the player is asked in the page, and the move is tried again
	// with the answer.
	const trial = cloneState(game);
	let result;
	try {
		result = startMove(trial, ui.start, endCoords, { enPassant: doEP, promotion: doPromotion, castle: doCastle, ask: choiceHandler ?? askInPage });
	} catch (err) {
		if (!(err instanceof ChoiceNeeded)) {
			// A fault in the engine: drop the move rather than leave the board stuck part-way through it
			console.error(err);
			debugPrint("That move couldn't be made: " + err.message);
			setState("clear");
			return;
		}
		askChoice(err.question, answer => {
			if (answer === null) {
				setState("clear"); // cancelled
			} else if (err.question == QUESTION_EN_PASSANT) {
				showCompleteMove(endCoords, answer, doPromotion, doCastle);
			} else if (err.question == QUESTION_CASTLE) {
				showCompleteMove(endCoords, doEP, doPromotion, answer);
			} else {
				showCompleteMove(endCoords, doEP, answer, doCastle);
			}
		});
		return;
	}
	if (!result.ok) {
		setState("clear");
		return;
	}
	game = trial;
	ui.end = endCoords;
	turnMove.from = ui.start;
	turnMove.to = endCoords;
	turnMove.enPassant = result.enPassant;
	turnMove.promotion = result.promotion;
	turnMove.castle = result.castle;
	clearFindPotentialCheckPieces();
	// The piece slides to its destination, in live play only (never while stepping through the history)
	const animate = ui.replay == -1;
	if (result.movedIntoCheck) {
		// We will still display the invalid move, but make it impossible to submit, as
		// the player might want to inspect the board to understand how the check happened.
		setState("invalidMoveIntoCheck", animate);
	} else {
		setState("showCompleteMove", animate);
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
		squares[r][c].highlightPotKing = 1;
	}
	return kings.length;
}

// Highlight the side to move's pieces that could attack the chosen potential-check king, and
// un-highlight the rest. Returns their coordinates.
function highlightPCAttackers() {
	const attackers = findPCAttackers(game);
	for (const piece of getPieces(game, game.turnColor)) {
		if (piece.captured > -1) {continue}
		squares[piece.r][piece.c].highlightPotAttacker = ismember([piece.r, piece.c], attackers) ? 1 : 0;
	}
	return attackers;
}

function clearFindPotentialCheckPieces() {
	for (let r=0; r<8; r++) {
		for (let c=0; c<8; c++) {
			squares[r][c].highlightPotKing = 0;
			squares[r][c].highlightPotAttacker = 0;
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
	if (!ismember(attackerCoords, turnMove.pcAttackers)) { // (clicking one twice adds it once)
		turnMove.pcAttackers.push(attackerCoords);
	}
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
// Split history text (one ply per line, or pasted all on one line) into plies. Empty text gives no plies.
function parseRecord(historyText) {
	return getHistoryLines(historyText);
}

// During normal play, the record is the game's history. While replaying it is left alone.
function followRecord() {
	if (ui.replay == -1) {
		ui.record = parseRecord(game.history);
	}
}

function restoreGameHistory(historyText,nMoves) {
	// Restore a game from historyText, or if that's left out, from the record in the History tab.
	// nMoves: only replay the first nMoves plies (used when stepping through a replay).
	if (isMultiplayer() && ui.replay == -1) {
		debugPrint("A multiplayer game can't be replaced");
		return;
	}
	let historyLines;
	if (historyText != null) {
		historyLines = parseRecord(historyText);
		ui.record = historyLines;
	} else {
		historyLines = ui.record.slice();
	}
	setup(); // clears the record unless replaying; replaying the plies below rebuilds it
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
	skipMove0(); // nothing (or only up to move 0) was replayed, and the Potential Check rule is off
}

function replayPly(moveText) {
	// Apply one ply of notation to the game, without redrawing. Returns false (and shows why) if it can't be played.
	let move = parseMoveText(moveText);
	// Check that the move number eg "3w. " is correct.
	if (move.turn != game.turnNumber.toString() + game.turnColor) {
		debugPrint("Move text number + colour did not match expected");
	}
	const result = boardSession().submitMove(move);
	if (!result.ok) {
		debugPrint("Couldn't replay '" + moveText + "': " + result.error);
		cancelTurn();
		return false;
	}
	followRecord();
	// Remember this move's squares so replay can highlight the last move
	ui.lastStart = move.from ?? [];
	ui.lastEnd = move.to ?? [];
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

// Export: copy the whole record to the clipboard, one ply per line. Resolves to false if it couldn't be copied
// (there's no clipboard on a page opened from another device's http:// address, for example).
async function exportMoves() {
	try {
		await navigator.clipboard.writeText(ui.record.join("\r\n"));
		markExported();
		return true;
	} catch {
		return false;
	}
}

// The Edit / Import dialog: it opens with the record to edit (or replace with pasted moves), and Load plays it
function openImport() {
	dom.importText.value = ui.record.join("\n");
	dom.importError.textContent = "";
}

// The Edit / Import dialog's Load: play its moves as the game. They are checked first, so a mistake in them
// leaves the game as it was. Returns why they can't be played, for the dialog to show, or null once loaded.
function importMoves() {
	const problem = recordProblem(parseRecord(dom.importText.value));
	if (problem !== null) {
		return problem;
	}
	restoreGameHistory(dom.importText.value);
	return null;
}

// Why these plies can't be played as a game from the start, or null if they can
function recordProblem(lines) {
	const state = createInitialState();
	for (const line of lines) {
		const { turn, ...move } = parseMoveText(line);
		const result = applyMove(state, move);
		if (!result.ok) {
			return "Couldn't play '" + line + "': " + result.error;
		}
	}
	return null;
}

function stepBackAll() {
	ui.replay = 0.5;
	restoreGameHistory(null, 2*ui.replay);
}

function stepBackMove() {
	if (ui.replay == -1) {
		// starting replay from game state
		if (game.turnColor == "w") {
			ui.replay = game.turnNumber - 0.5;
		} else {
			ui.replay = game.turnNumber;
		}
	}
	ui.replay = ui.replay - 0.5;
	ui.replay = Math.max(ui.replay,0.5);
	restoreGameHistory(null, 2*ui.replay);
}

function stepForwardMove() {
	if (ui.replay < ui.record.length/2) {
		let moveText = ui.record[2*ui.replay];
		ui.replay = ui.replay + 0.5;
		if (isMultiplayer() && ui.replay >= ui.record.length/2) {
			// Stepped forward to the latest move: back to the game
			exitReplay();
			return;
		}
		doMoveFromText(moveText);
	}
}

function stepForwardAll() {
	if (isMultiplayer()) {
		exitReplay();
		return;
	}
	ui.replay = ui.record.length/2;
	restoreGameHistory(null, 2*ui.replay);
}

// Show the position after the ply on line i of the record (a click on a History tab line). The newest line, outside
// replay, is the game as it is: nothing to do.
function jumpToPly(i) {
	if (i < 0 || i >= ui.record.length) {return}
	if (ui.replay == -1 && i == ui.record.length - 1) {return}
	if (isMultiplayer() && i == ui.record.length - 1) {
		exitReplay();
		return;
	}
	ui.replay = (i + 1) / 2;
	restoreGameHistory(null, i + 1);
}

// Multiplayer: stop stepping through the history and show the game as it is now
function exitReplay() {
	ui.replay = -1;
	adopt(session.getState());
	ui.record = parseRecord(game.history);
	showLastMove();
	setState("clear");
}

////////////////////////////////
// Multiplayer
////////////////////////////////

// Start a multiplayer game. request: { create: "w" | "b" | "random" }, { join: code } or
// { resume: { code, token } } (see SocketSession start)
function startMultiplayer(request, options = {}) {
	if (isMultiplayer()) {
		if (ui.multiplayer.phase == "playing" || ui.multiplayer.phase == "connecting") { return; }
		session.leave();
	}
	const s = new SocketSession(options);
	ui.replay = -1;
	ui.multiplayer = { ...s.info(), message: "" };
	s.onEvent(event => multiplayerEvent(s, event));
	useSession(s);
	adopt(s.getState());
	ui.record = [];
	ui.lastStart = [];
	ui.lastEnd = [];
	dom.stagedMove.textContent = "";
	s.start(request);
	setState("clear");
}

// Leave the multiplayer game (the opponent is told) and go back to a new single-player game
function leaveMultiplayer() {
	if (isMultiplayer()) {
		session.leave();
	}
	backToSinglePlayer();
}

function backToSinglePlayer() {
	ui.multiplayer = null;
	viewSession = null;
	ui.replay = -1;
	setFlippedBoard(false);
	useSession(new LocalSession());
	resumeSavedGame();
}

// The session's connection or game changed: update what the page shows
function multiplayerEvent(s, event) {
	if (session !== s) { return; }
	let message = ui.multiplayer.message;
	if (event.type == "error") {
		debugPrint(event.message);
		if (event.fatal) { message = event.message; }
	}
	const wasColor = ui.multiplayer.color;
	ui.multiplayer = { ...s.info(), message };
	if (s.color && s.color != wasColor) {
		// Your own side at the bottom of the board
		setFlippedBoard(s.color == "b");
	}
	if (ui.replay == -1 && (WAITING_STATES.includes(ui.state) || ui.state == "clear" || ui.state == "move0" || ui.multiplayer.phase != "playing")) {
		setState("clear"); // works out again whether the player can move
	} else {
		draw();
	}
}

// A new state from the server (the opponent's move, the answer to this player's move, or a catch-up)
function liveChanged(state) {
	if (ui.replay > -1) {
		// Stepping through the history: leave the board alone, but let the record grow
		ui.record = parseRecord(state.history);
		draw();
		return;
	}
	if (state.history == committed.history && !WAITING_STATES.includes(ui.state)) {
		// The game hasn't changed (a catch-up after a reconnect): keep the move the player is making
		committed = state;
		draw();
		return;
	}
	// The opponent's move slides into place. Not the answer to this player's own move (already on the board),
	// nor a catch-up of more than one move (after a reload the board was showing something else).
	const before = parseRecord(committed.history);
	const after = parseRecord(state.history);
	const opponentMoved = after.length == before.length + 1 && before.every((ply, i) => ply == after[i])
		&& state.turnColor == ui.multiplayer.color;
	adopt(state);
	ui.record = after;
	showLastMove();
	clearFindPotentialCheckPieces();
	setState("clear", opponentMoved);
}

// For tests: close the multiplayer connection as if the network had dropped
function dropConnection() {
	session.ws?.close();
}

// Highlight the last move played in the multiplayer game
function showLastMove() {
	const last = session.moves?.at(-1);
	ui.lastStart = last?.from ?? [];
	ui.lastEnd = last?.to ?? [];
}

// In a multiplayer game, the step to show instead of letting the player move (see the list at the top), or
// null if they can move
function multiplayerWait() {
	if (!isMultiplayer() || ui.replay > -1) { return null; }
	const mp = ui.multiplayer;
	if (mp.phase == "ended" || mp.phase == "left") { return "multiplayerOver"; }
	if (mp.phase != "playing") { return "waitJoin"; }
	if (mp.pending) { return "sendingMove"; }
	if (mp.opponent == "waiting") { return "waitJoin"; }
	if (game.turnColor != mp.color) { return "waitOpponent"; }
	return null;
}

////////////////////////////////
// State Control
////////////////////////////////

// Move to a new step of the turn: reset the highlights that don't belong to it, then redraw.
// animate: slide the pieces that moved since the last draw (see draw)
function setState(stateIn, animate = false) {
	if (stateIn == "clear" && game.turnNumber == 0) {
		stateIn = "move0";
	}
	if (stateIn == "clear" || stateIn == "move0") {
		stateIn = game.result ? "gameOver" : multiplayerWait() ?? stateIn;
	}
	ui.state = stateIn;
	if (ui.state == "clear" || ui.state == "move0" || WAITING_STATES.includes(ui.state)) {
		ui.start = [];
		ui.end = [];
	}
	if (ui.state != "selectPCAttackers" && ui.state != "selectPCKing" && ui.state != "highlightPotentialMoves" && ui.state != "clear") {
		clearFindPotentialCheckPieces();
	}
	for (const row of squares) {
		for (const sqr of row) {
			if (ui.state == "clear" || ui.state == "move0" || WAITING_STATES.includes(ui.state)) {
				// For other states, the properties are set in calling functions, but you can always reset to clear by
				// just calling setState("clear")
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
				sqr.highlightPotKing = 0;
				sqr.highlightPotAttacker = 0;
			}
			if (ui.state == "showPartialMove") {
				sqr.highlighted = 0;
			}
			if (ui.state == "showCompleteMove" || ui.state == "invalidMoveIntoCheck") {
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
			}
			if (ui.state == "selectPCAttackers") {
				sqr.highlightPotKing = 0;
			}
		}
	}
	draw(animate);
}

// Redraw the page as it is. animate: slide the pieces that moved since the last draw to their new squares
// (board-view.js), for a move in live play.
function draw(animate = false) {
	saveRecord();
	render({
		game,
		state: ui.state,
		squares,
		start: ui.start,
		end: ui.end,
		lastStart: ui.lastStart,
		lastEnd: ui.lastEnd,
		replayNumber: ui.replay,
		record: ui.record,
		multiplayer: ui.multiplayer,
		pcRule: pcRule(),
		pcSetting: ui.potentialCheck,
		animate,
	});
}

////////////////////////////////
// Saved game
////////////////////////////////
// The single-player game's record is kept in this tab (sessionStorage), so reloading the page carries on with it,
// but closing the tab forgets it and a new tab starts a new game. Only Reset Game (or loading other moves) replaces
// it. A multiplayer game isn't saved here: it has its own way back in after a reload (socket-session.js savedSeat),
// and leaving it returns to the saved game.
const GAME_STORAGE_KEY = "qhess.game";
let savedRecord = null; // the record as last saved, so it is only written when it changes

function saveRecord() {
	if (isMultiplayer()) { return; }
	const text = ui.record.join("\n");
	if (text === savedRecord) { return; }
	savedRecord = text;
	try {
		sessionStorage.setItem(GAME_STORAGE_KEY, text);
	} catch {
		// The browser won't keep it (e.g. storage is blocked): the game lasts until the page is closed
	}
}

// The record as last exported (kept in this tab, like the saved game, so a reload remembers it). Reset only asks
// about exporting a game whose moves haven't been.
const EXPORTED_STORAGE_KEY = "qhess.exported";

function markExported() {
	try {
		sessionStorage.setItem(EXPORTED_STORAGE_KEY, ui.record.join("\n"));
	} catch {
		// The browser won't keep it: Reset will ask again
	}
}

// Whether Reset would lose moves that haven't been exported: the game has moves beyond an empty Black's move 0,
// and they aren't what was last exported. Always false in a multiplayer game, which can't be reset.
function hasUnexportedMoves() {
	if (isMultiplayer()) { return false; }
	const text = ui.record.join("\n");
	if (text.trim() == "" || text.trim() == "0b.") { return false; }
	try {
		return sessionStorage.getItem(EXPORTED_STORAGE_KEY) !== text;
	} catch {
		return true;
	}
}

function loadSavedRecord() {
	try {
		return sessionStorage.getItem(GAME_STORAGE_KEY) ?? "";
	} catch {
		return "";
	}
}

// Start the saved single-player game where it was left, or a new game if there isn't one
function resumeSavedGame() {
	const text = loadSavedRecord();
	if (text.trim() == "") {
		newGame();
	} else {
		restoreGameHistory(text);
	}
}

// Called once when the page loads: make the board and its squares, then start a game.
// joinCode: the code of a game to join, when the page was opened from its join link (join-link.js)
function init(joinCode = null) {
	buildBoard();
	squares = [];
	for (let r = 0; r <= 7; r++) {
		const viewRow = [];
		for (let c = 0; c <= 7; c++) {
			const sqr = new SquareView(r, c, document.getElementById("square" + r + c));
			const coords = [r, c];
			sqr.button.addEventListener("pointerenter", event => squareEnter(coords, event));
			sqr.button.addEventListener("pointerleave", event => squareLeave(coords, event));
			sqr.button.addEventListener("click", () => squareClick(coords));
			viewRow.push(sqr);
		}
		squares.push(viewRow);
	}
	resumeSavedGame();
	// Reloading the page during a multiplayer game goes back into it, as does opening that game's own join link
	// again. A link to another game joins that one instead.
	const seat = savedSeat();
	if (joinCode && seat?.code != joinCode) {
		startMultiplayer({ join: joinCode });
	} else if (seat) {
		startMultiplayer({ resume: seat });
	}
}

// Start a new game for the player: the Reset Game button, and when there's no saved game (see resumeSavedGame)
function newGame() {
	setup();
	skipMove0();
}

// Start a new game at Black's move 0 (also used to rewind before replaying a history, so it never skips move 0).
// The squares' highlight flags are cleared by setState("move0").
function setup() {
	boardSession().reset(); // its onChange sets committed, game and turnMove
	ui.start = [];
	ui.end = [];
	ui.lastStart = [];
	ui.lastEnd = [];

	dom.stagedMove.textContent = "";
	if (ui.replay == -1) {
		ui.record = [];
	}
	setState("move0");
}

////////////////////////////////
// Exports
////////////////////////////////
export {
	// Used by src/client/main.js to wire up the page
	init,
	newGame,
	setPotentialCheckRule,
	sideButton1Click,
	sideButton2Click,
	stepBackAll,
	stepBackMove,
	stepForwardMove,
	stepForwardAll,
	jumpToPly,
	restoreGameHistory,
	exportMoves,
	hasUnexportedMoves,
	openImport,
	importMoves,
	startMultiplayer,
	leaveMultiplayer,
	backToSinglePlayer,

	// Used by tests/test.html and tests/generate.html to drive and inspect the game
	setup,              // a new game at Black's move 0, whatever the Potential Check switch says
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
	setChoiceHandler,   // answer en passant / promotion questions without the dialog
	dropConnection,     // multiplayer: drop the connection, as a network blip would (it reconnects by itself)
	squares as SQUARES, // the highlight flags (e.g. which squares are potential-check candidates)
	ui,                 // page state: ui.state is the step of the turn
};
