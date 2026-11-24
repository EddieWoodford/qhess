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
//   "dragging"                 a piece is being dragged (see Dragging a piece); dropping it stages the move
//   "showCompleteMove"         the move is made; Submit, or Add PC (potential check)
//   "invalidMoveIntoCheck"     the move leaves the player in check; it can only be cancelled
//   "selectPCKing"             choosing which opponent piece to declare potential check on
//   "showPotentialCheck"       the potential check declared, every piece that could attack the king attacking it;
//                              then Submit
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
import { createInitialState, cloneState, oppColor } from "../engine/state.js";
import { getPotentialMoves } from "../engine/moves.js";
import { getMoveDestinations } from "../engine/castling.js";
import { findChecks, findPotentialKings } from "../engine/check.js";
import { declareNotAKing as engineDeclareNotAKing, startMove, choosePCKing, addPCAttacker, applyMove } from "../engine/game.js";
import { getHistoryLines, parseMoveText } from "../engine/notation.js";
import { SquareView, buildBoard, setFlippedBoard, squareAt, liftPiece, moveLifted, dropLifted } from "./board-view.js";
import { render, debugPrint } from "./render.js";
import { dom } from "./dom.js";
import { showChoice } from "./modals.js";
import { LocalSession } from "./session.js";
import { SocketSession, savedSeat } from "./socket-session.js";

/**
 * @typedef {import("../engine/state.js").GameState} GameState
 * @typedef {"move0" | "clear" | "highlightPotentialMoves" | "showPartialMove" | "dragging" | "showCompleteMove"
 *   | "invalidMoveIntoCheck" | "selectPCKing" | "showPotentialCheck" | "gameOver"
 *   | "waitJoin" | "waitOpponent" | "sendingMove" | "multiplayerOver"} UiState
 * @typedef {ReturnType<SocketSession["info"]> & { message: string }} MultiplayerView
 */

let session;            // the official game: a LocalSession, or a SocketSession in a multiplayer game
/** @type {LocalSession | null} */
let viewSession = null; // multiplayer only: a LocalSession for stepping through the history (see boardSession)
/** @type {GameState} */
let committed; // the session's game state at the start of the current turn: see src/engine/state.js
/** @type {GameState} */
let game;      // the game state being shown and changed by clicks: a working copy of `committed`
let turnMove;  // the turn being made, as a move for session.submitMove (see newTurnMove)
/** @type {GameState | null} */
let beforeLastPly = null; // the game state before the last ply replayed (replayPly): while stepping through the
                          // history, the board fades the types that ply ruled out, as it does before Submit

// Page state: everything about what the page is showing, apart from the game itself
const ui = {
	/** @type {UiState} */
	state: "move0",  // the step of the turn (see the list above)
	/** @type {number[]} */
	start: [],       // [r,c] of the move being made, or [] if none
	/** @type {number[]} */
	end: [],
	/** @type {number[]} */
	lastStart: [],   // start square of the last submitted move (its arrow; the ply shown, in replay)
	/** @type {number[]} */
	lastEnd: [],     // end square of the last submitted move
	// The game record shown in the History tab, one ply per line. It follows the game as moves are made, and
	// stays as it is while replaying (so the later moves can be stepped forward through).
	/** @type {string[]} */
	record: [],
	// -1 when not replaying. While stepping through the history, the position being shown, in moves:
	// 0.5 = after Black's move 0, 1 = after White's move 1, 1.5 = after Black's move 1, ...
	replay: -1,
	// null in a single-player game. In a multiplayer game, what the page shows about it: SocketSession info()
	// ({ phase, code, color, opponent, connection, pending, endedReason }) and message (why it ended, or "").
	/** @type {MultiplayerView | null} */
	multiplayer: null,
	// The Settings tab's Potential Check switch. Off: no Add PC, and Black's move 0 is passed by itself.
	// A multiplayer game always uses the rule (see pcRule), as both players must play by the same rules.
	potentialCheck: true,
	// The Settings tab's Hint Level (protocol.js HINT_LEVELS): how much the board shows before Submit. A
	// multiplayer game plays at its creator's level instead, and the demo at "captures" (see hintLevel).
	/** @type {import("../shared/protocol.js").HintLevel} */
	hintLevel: "captures",
	// True while the demo play-through (tour.js) is driving the board: the player's clicks on the board and the
	// side buttons do nothing, the game isn't saved, and potential checks are allowed whatever the switch says.
	tour: false,
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
/** @type {((question: string) => boolean) | null} */
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
	return ui.potentialCheck || isMultiplayer() || ui.tour;
}

// The hint level the board uses now: the Settings tab's, except that a multiplayer game uses the one its creator
// chose (sent by the server; the player's own until it arrives) and the demo shows every hint.
function hintLevel() {
	if (ui.tour) { return "captures"; }
	return ui.multiplayer?.hintLevel ?? ui.hintLevel;
}

// Whether the board shows where a piece can move (lines and dots, and the move a dragged piece would make)
function showsMoves() {
	return hintLevel() == "moves" || hintLevel() == "captures";
}

// The Settings tab's Hint Level changed. Takes effect straight away.
function setHintLevel(level) {
	ui.hintLevel = level;
	if (squares) { draw(); }
}

// Multiplayer: a Hint Level button asks the opponent to change the game to that level. The game's own level withdraws
// this player's request, if one is open.
function requestHintLevel(level) {
	const mp = ui.multiplayer;
	if (mp === null) { return; }
	if (level == mp.hintLevel) {
		if (mp.hintRequest?.mine) { session.cancelHintLevel(); }
		return;
	}
	const result = session.requestHintLevel(level);
	if (!result.ok) { debugPrint(result.error); }
}

function cancelHintLevel() {
	if (isMultiplayer()) { session.cancelHintLevel(); }
}

// The Settings tab's Potential Check switch changed. Takes effect straight away.
function setPotentialCheckRule(on) {
	ui.potentialCheck = on;
	if (!squares) { return; } // the page is still starting: init() starts the game with the rule as set
	if (ui.tour) { draw(); return; } // the demo play-through always has the rule: it takes effect after it
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
	if (ui.tour) {return}
	const rewind = ui.multiplayer?.rewind;
	if (rewind) {
		// A rewind request is open: 'Agree' to the opponent's, or 'Withdraw' this player's own
		if (rewind.mine) {
			session.cancelRewind();
		} else {
			session.answerRewind(true);
		}
	} else if (ui.multiplayer?.hintRequest && !ui.multiplayer.hintRequest.mine) {
		session.answerHintLevel(true); // 'Agree' to the opponent's hint level change
	} else if (ui.replay > -1 && isMultiplayer()) {
		// In a multiplayer game, 'Resume from here' asks the opponent to rewind the game to the position shown
		const result = session.requestRewind(2 * ui.replay);
		if (!result.ok) { debugPrint(result.error); }
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
	if (ui.tour) {return}
	if (ui.multiplayer?.rewind && !ui.multiplayer.rewind.mine) {
		session.answerRewind(false); // 'Decline'
		return;
	}
	if (!ui.multiplayer?.rewind && ui.multiplayer?.hintRequest && !ui.multiplayer.hintRequest.mine) {
		session.answerHintLevel(false); // 'Decline' the opponent's hint level change
		return;
	}
	if (ui.replay > -1 && isMultiplayer()) {
		exitReplay(); // 'Back to game'
		return;
	}
	if (ui.replay > -1) {
		// When in replay mode (single player), sideButton2 is 'Back to game': the whole record, as it was
		ui.replay = -1;
		restoreGameHistory(null);
		return;
	}
	sideButton2Action();
}

function sideButton2Action() {
	if (ui.state == "showCompleteMove" || ui.state == "showPotentialCheck" || ui.state == "move0") {
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
	if (event.pointerType == "touch" || ui.tour) {return}
	if (ui.state == "clear") {
		highlightPotentialMoves(coords);
	}
}

function squareLeave(event) {
	if (event.pointerType == "touch") {return}
	if (ui.state == "highlightPotentialMoves") {
		setState("clear");
	}
}

function squareClick(coords) {
	if (ignoreClick) { ignoreClick = false; return; } // the release at the end of a drag, not a click
	if (ui.replay > -1 || ui.tour) {return}
	if (WAITING_STATES.includes(ui.state)) {return}
	if (ui.state == "highlightPotentialMoves" || ui.state == "clear") {
		pickPiece(coords);
	} else if (ui.state == "showPartialMove") {
		chooseDestination(coords);
	} else if (ui.state == "selectPCKing") {
		selectPCKing(coords);
	} else if (ui.state == "move0") {
		setState("move0");
	} else if (ui.state == "showCompleteMove" && isequal(coords, ui.end)) {
		// Clicking the staged destination again submits the move, same as the Submit button
		sideButton2Action();
	} else if (STAGED_STATES.includes(ui.state) && ismember(coords, restageSquares())) {
		// Not submitted yet, so the piece can still go elsewhere: straight there, or picked up again from its square
		const start = ui.start;
		cancelTurn();
		if (isequal(coords, start)) {
			setState("clear");
			showPartialMove(start);
		} else {
			showCompleteMove(coords);
		}
	} else {
		cancelTurn();
		setState("clear");
	}
}

// While a move is staged but not submitted (the move into check too), the piece can still be moved
const STAGED_STATES = ["showCompleteMove", "invalidMoveIntoCheck"];

// The squares a click (or a drop) on moves the staged piece instead of cancelling: where else it could have gone
// this turn, and its own square (picks it up again). [] when no move is staged.
function restageSquares() {
	if (!STAGED_STATES.includes(ui.state) || !ui.start.length) { return []; }
	return [ui.start, ...getMoveDestinations(committed, ui.start).filter(to => !isequal(to, ui.end))];
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
			debugPrint("That move couldn't be made: " + /** @type {Error} */ (err).message);
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
// Dragging a piece
////////////////////////////////
// Pressing one of the mover's pieces and moving the pointer drags it (mouse, pen or touch). While it is over a
// square it can move to, the board shows the position after that move: the piece on that square and every
// collapse, with the ruled-out types faded. Elsewhere a copy of the piece follows the pointer. Dropping it on such a
// square stages the move, exactly as clicking the square does, so it still waits for Submit (or Add PC). Dropped
// back on its own square it stays picked; dropped anywhere else, or Esc, it goes back. A press without moving is
// left to the click flow above.
// A staged move that isn't submitted yet can be dragged too: its piece, from where it was staged, to another of its
// destinations (or back to its own square, picked up). Pressing another of the mover's pieces drags that one instead.
// Dropped anywhere else, or Esc, the staged move is left as it was.

const DRAG_STATES = ["clear", "highlightPotentialMoves", "showPartialMove", ...STAGED_STATES]; // where a press can pick a piece
const DRAG_PX = { mouse: 4, touch: 8 }; // how far the pointer moves before a press becomes a drag

// The press on a piece: { pointerId, start: [r,c] (where the piece moves from), pressed: [r,c] (where it was
// pressed: the staged destination for a staged piece), x, y, touch, active (dragging), destinations, over: [r,c] or
// null, hover: the move tried there (dragPreview), staged: the staged move to put back if the drag comes to nothing }
/**
 * @typedef {{ state?: GameState, intoCheck?: boolean, question?: string }} DragHover
 * @typedef {{ game: GameState, turnMove: object, start: number[], end: number[], state: UiState }} StagedMove
 * @typedef {{ pointerId: number, start: number[], pressed: number[], x: number, y: number, touch: boolean,
 *   active: boolean, destinations: number[][], over: number[] | null, hover: DragHover | null,
 *   staged: StagedMove | null }} Drag
 */
/** @type {Drag | null} */
let drag = null;
let ignoreClick = false; // a drag has just ended: the click the release may make isn't one (cleared by the next press)

// Whether the player can drag their pieces now
function canDrag() {
	return ui.replay == -1 && !ui.tour && DRAG_STATES.includes(ui.state);
}

function squarePointerDown(coords, event) {
	ignoreClick = false;
	const piece = game.board[coords[0]][coords[1]];
	if (drag || !event.isPrimary || event.button != 0 || !canDrag() || piece?.color != game.turnColor) {return}
	drag = { pointerId: event.pointerId, start: coords, pressed: coords, x: event.clientX, y: event.clientY,
		touch: event.pointerType == "touch", active: false, destinations: [], over: null, hover: null, staged: null };
	window.addEventListener("pointermove", dragMove);
	window.addEventListener("pointerup", dragUp);
	window.addEventListener("pointercancel", dragCancel);
	window.addEventListener("keydown", dragKey);
}

function dragMove(event) {
	if (!drag || event.pointerId != drag.pointerId) {return}
	if (!drag.active) {
		if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_PX[drag.touch ? "touch" : "mouse"]) {return}
		if (!canDrag()) { endDrag(); return; } // the game moved on since the press
		// (Copied before the board is redrawn: a staged piece goes back to its own square)
		liftPiece(squares[drag.pressed[0]][drag.pressed[1]].button, drag.touch);
		if (STAGED_STATES.includes(ui.state)) {
			// Back to the start of the turn, keeping the staged move in case the drag comes to nothing
			drag.staged = { game, turnMove, start: ui.start, end: ui.end, state: ui.state };
			if (isequal(drag.pressed, ui.end)) { drag.start = ui.start; } // the staged piece moves from its own square
			cancelTurn();
		}
		setState("clear"); // drop the hover preview, or a piece picked before
		ui.start = drag.start;
		drag.destinations = getMoveDestinations(game, drag.start);
		markDestinations(drag.start);
		drag.active = true;
		setState("dragging");
	}
	moveLifted(event.clientX, event.clientY);
	const over = squareAt(event.clientX, event.clientY);
	if (!isequal(over ?? [], drag.over ?? [])) {
		drag.over = over;
		// (Below the Moves hint level the board doesn't show the move until it is dropped: that would show
		// where the piece can go)
		drag.hover = showsMoves() ? dragPreview(over) : null;
		draw();
	}
}

function dragUp(event) {
	if (!drag || event.pointerId != drag.pointerId) {return}
	if (!drag.active) { endDrag(); return; } // a press without dragging: the click that follows does the rest
	const start = drag.start, staged = drag.staged;
	const target = squareAt(event.clientX, event.clientY);
	const preview = dragPreview(target);
	endDrag();
	if (preview?.question) {
		setState("showPartialMove"); // the piece back on its square while the question is asked
		showCompleteMove(target);
	} else if (preview) {
		showCompleteMove(target); // the board already shows this move, so nothing slides
	} else if (isequal(target ?? [], start)) {
		setState("showPartialMove");
	} else {
		putBack(staged);
	}
}

// A drag came to nothing: put back the staged move it started from (staged: see drag), or else drop the piece
function putBack(staged) {
	if (!staged) { setState("clear"); return; }
	game = staged.game;
	turnMove = staged.turnMove;
	ui.start = staged.start;
	ui.end = staged.end;
	setState(staged.state);
}

function dragCancel(event) {
	if (event.pointerId == drag?.pointerId) { cancelDrag(); }
}

function dragKey(event) {
	if (event.key == "Escape") { cancelDrag(); }
}

function cancelDrag() {
	if (!drag) {return}
	const wasActive = drag.active, staged = drag.staged;
	endDrag();
	if (wasActive) { putBack(staged); }
}

// Stop following the pointer
function endDrag() {
	if (!drag) {return}
	ignoreClick = drag.active;
	drag = null;
	dropLifted();
	window.removeEventListener("pointermove", dragMove);
	window.removeEventListener("pointerup", dragUp);
	window.removeEventListener("pointercancel", dragCancel);
	window.removeEventListener("keydown", dragKey);
}

// The dragged piece's move to coords, tried on a copy of the working state: { state, intoCheck }, or { question }
// when the move is ambiguous (asked on the drop, see showCompleteMove), or null if the piece can't move there
function dragPreview(coords) {
	if (!drag || !coords || !ismember(coords, drag.destinations)) {return null}
	const trial = cloneState(game);
	try {
		const result = startMove(trial, drag.start, coords, { ask: choiceHandler ?? askInPage });
		return result.ok ? { state: trial, intoCheck: result.movedIntoCheck } : null;
	} catch (err) {
		if (err instanceof ChoiceNeeded) { return { question: err.question }; }
		console.error(err);
		return null;
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

function clearFindPotentialCheckPieces() {
	for (const row of squares) {
		for (const sqr of row) {
			sqr.highlightPotKing = 0;
		}
	}
}

// Get here after clicking on a square in "selectPCKing" state. Every piece of the mover's that could attack the
// chosen king attacks it (attackers: just these instead, for the demo and tests/generate.html, which replay a
// recorded set).
function selectPCKing(kingCoords, attackers) {
	const result = choosePCKing(game, kingCoords);
	if (!result.ok) {
		cancelTurn();
		setState("clear");
		return;
	}
	turnMove.pcKing = kingCoords;
	clearFindPotentialCheckPieces(); // stop highlighting the potential kings
	for (const attacker of attackers ?? result.attackers) {
		// (One attacker's collapse can rule another out: that one is left out)
		const added = addPCAttacker(game, attacker);
		if (!added.ok) { continue; }
		if (!ismember(attacker, turnMove.pcAttackers)) { turnMove.pcAttackers.push(attacker); }
		if (added.movedIntoCheck) {
			// By setting a potential check an attacker collapsed down to a true king and put themselves in check
			setState("invalidMoveIntoCheck");
			return;
		}
	}
	setState("showPotentialCheck");
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
	beforeLastPly = cloneState(committed);
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
	if (ui.tour) {return}
	if (i < 0 || i >= ui.record.length) {return}
	if (ui.replay == -1 && i == ui.record.length - 1) {return}
	if (isMultiplayer() && i == ui.record.length - 1) {
		exitReplay();
		return;
	}
	ui.replay = (i + 1) / 2;
	restoreGameHistory(null, i + 1);
}

// Step through the history to the position after the first `plies` plies of the record
function showPosition(plies) {
	ui.replay = plies / 2;
	restoreGameHistory(null, plies);
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
	if (ui.multiplayer !== null) {
		if (ui.multiplayer.phase == "playing" || ui.multiplayer.phase == "connecting") { return; }
		session.leave();
	}
	if (request.create) {
		request = { ...request, hintLevel: ui.hintLevel }; // the creator's level is the game's
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
	let message = ui.multiplayer?.message ?? "";
	if (event.type == "error") {
		debugPrint(event.message);
		if (event.fatal) { message = event.message; }
	}
	const wasColor = ui.multiplayer?.color;
	ui.multiplayer = { ...s.info(), message };
	if (s.color && s.color != wasColor) {
		// Your own side at the bottom of the board
		setFlippedBoard(s.color == "b");
	}
	if (event.type == "rewindAsked" && !event.mine) {
		// The opponent asks to rewind: show the position they want to go back to
		showPosition(event.keep);
		return;
	}
	if (event.type == "rewindEnded" && ui.replay > -1 && (event.result == "agreed" || !event.mine)) {
		// Rewound (or the question is over): back to the game as it now is. A player whose own request was
		// turned down stays where they were looking.
		exitReplay();
		return;
	}
	if (ui.replay == -1 && (WAITING_STATES.includes(ui.state) || ui.state == "clear" || ui.state == "move0" || ui.multiplayer?.phase != "playing")) {
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
		&& state.turnColor == ui.multiplayer?.color;
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
	const mp = ui.multiplayer;
	if (mp === null || ui.replay > -1) { return null; }
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
/** @param {UiState} stateIn @param {boolean} [animate] */
function setState(stateIn, animate = false) {
	if (stateIn != "dragging" && drag?.active) {
		endDrag(); // the game moved on under a dragged piece (e.g. a multiplayer catch-up)
	}
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
	if (ui.state != "selectPCKing" && ui.state != "highlightPotentialMoves" && ui.state != "clear") {
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
			}
			if (ui.state == "showPartialMove" || ui.state == "dragging") {
				sqr.highlighted = 0;
			}
			if (ui.state == "showCompleteMove" || ui.state == "invalidMoveIntoCheck") {
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
			}
		}
	}
	draw(animate);
}

// Redraw the page as it is. animate: slide the pieces that moved since the last draw to their new squares
// (board-view.js), for a move in live play.
function draw(animate = false) {
	saveRecord();
	// While a piece is dragged over a square it can move to, the board shows the move made there
	const dragging = ui.state == "dragging" && drag !== null;
	const hover = dragging && drag ? drag.hover : null;
	const end = (hover && drag?.over) ?? ui.end; // (a hover means it is over a square)
	// The arrows: the last move played, the move being made once it has a destination, and a red one from each
	// attacker to the king of a check, the only sign of it on the board: the check (or potential check) on the side
	// to move until it is answered, or the potential check being declared (at the Captures hint level only)
	const declared = ui.state != "showPotentialCheck" ? findChecks(game, game.turnColor)
		: hintLevel() == "captures" ? findChecks(game, oppColor(game.turnColor)) : null;
	const arrows = {
		last: ui.lastStart.length && ui.lastEnd.length ? [ui.lastStart, ui.lastEnd] : null,
		current: ui.start.length && end.length ? [ui.start, end] : null,
		attacks: declared ? declared.attackerCoords.map(from => [from, declared.kingCoords]) : [],
	};
	render({
		game: hover?.state ?? game,
		state: ui.state,
		squares,
		start: ui.start,
		end,
		arrows,
		restage: restageSquares(),
		draggable: canDrag() ? game.turnColor : null,
		drag: dragging ? { lifted: !hover?.state, over: hover !== null, question: hover?.question ?? null, intoCheck: hover?.intoCheck ?? false } : null,
		replayNumber: ui.replay,
		record: ui.record,
		multiplayer: ui.multiplayer,
		pcRule: pcRule(),
		pcSetting: ui.potentialCheck,
		tour: ui.tour,
		before: ui.replay == -1 ? committed : beforeLastPly,
		hintLevel: hintLevel(),
		// At the None hint level, nothing a move collapses shows until it is submitted: the pieces keep the types
		// they had at the start of the turn (not while stepping through the history, nor once it is sent)
		hideCollapses: hintLevel() == "none" && ui.replay == -1 && !WAITING_STATES.includes(ui.state),
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
/** @type {string | null} */
let savedRecord = null; // the record as last saved, so it is only written when it changes

function saveRecord() {
	if (isMultiplayer() || ui.tour) { return; }
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

// The demo play-through (tour.js) starts or stops driving the board. Not in a multiplayer game.
function setTour(on) {
	if (on && isMultiplayer()) { return false; }
	ui.tour = on;
	ui.replay = -1;
	return true;
}

// The turn being made (as for session.submitMove), for the demo play-through to see what is staged
function currentTurn() {
	return turnMove;
}

// Resolves once init() has made the board and started the game. main.js loads the themes before it calls init(),
// so this module can be loaded before the game has started: tests/test.html and generate.html wait for this.
let markReady;
const ready = new Promise(resolve => { markReady = resolve; });

// Called once when the page loads: make the board and its squares, then start a game.
// joinCode: the code of a game to join, when the page was opened from its join link (join-link.js)
/** @param {string | null} [joinCode] */
function init(joinCode = null) {
	buildBoard();
	squares = [];
	for (let r = 0; r <= 7; r++) {
		const viewRow = [];
		for (let c = 0; c <= 7; c++) {
			const sqr = new SquareView(r, c, document.getElementById("square" + r + c));
			const coords = [r, c];
			sqr.button.addEventListener("pointerenter", event => squareEnter(coords, event));
			sqr.button.addEventListener("pointerleave", squareLeave);
			sqr.button.addEventListener("click", () => squareClick(coords));
			sqr.button.addEventListener("pointerdown", event => squarePointerDown(coords, event));
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
	markReady();
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
	beforeLastPly = null;
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
	setHintLevel,
	requestHintLevel,
	cancelHintLevel,
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
	isMultiplayer,
	loadSavedRecord,
	setTour,
	currentTurn,
	declareNotAKing,

	// Used by tests/test.html and tests/generate.html to drive and inspect the game
	ready,              // a promise: the page has started its game, so the rest can be used
	setup,              // a new game at Black's move 0, whatever the Potential Check switch says
	game,
	sideButton1Action,
	sideButton2Action,
	getHistoryLines,
	doMoveFromText,
	showPartialMove,
	showCompleteMove,
	selectPCKing,
	getPotentialMoves,
	setChoiceHandler,   // answer en passant / promotion questions without the dialog
	dropConnection,     // multiplayer: drop the connection, as a network blip would (it reconnects by itself)
	squares as SQUARES, // the highlight flags (e.g. which squares are potential-check candidates)
	ui,                 // page state: ui.state is the step of the turn
};
