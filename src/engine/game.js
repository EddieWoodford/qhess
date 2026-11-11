"use strict";

// Making moves: the steps of a turn, each changing the game state (see state.js). No page code.
//
// A turn is made of these steps, in this order:
//   declareNotAKing(state)                  optional: if in potential check, declare that the potential king isn't one
//   startMove(state, from, to, choices)     move a piece (skipped on Black's move 0)
//   choosePCKing(state, kingCoords)         optional: declare potential check on an opponent piece...
//   addPCAttacker(state, attackerCoords)    ...attacked by one or more of your pieces
//   endTurn(state)                          record the move in the history and pass to the other side
// applyMove(state, move) runs a whole turn from parsed notation (see notation.js parseMoveText).
// After each turn, endTurn sets state.result: "checkmate" or "stalemate" if the side now to move has no legal
// turn (see gameResult), otherwise null. Once it is set, no more moves can be made.

import { isequal, ismember, coords2text, isSquare } from "./utils.js";
import { cloneState, oppColor, getPieces, defPiece, attPiece } from "./state.js";
import { getPotentialMoves, enPassantVictim } from "./moves.js";
import { findChecks, findPotentialKings, findPCAttackers } from "./check.js";
import { updateOptionsFromEntanglement } from "./entanglement.js";
import { getCastlingMoves, getMoveDestinations } from "./castling.js";

// Search for check against `color` and store the result in state.autoCheck / state.potCheck.
// Returns the full result from findChecks.
function refreshChecks(state, color) {
	const result = findChecks(state, color);
	state.autoCheck = result.autoCheck;
	state.potCheck = result.potCheck;
	return result;
}

// Declare that the side to move's potential-check king is not a king.
// Returns { ok: true, square } (where that piece is), or { ok: false, error } if no potential check is
// declared on the side to move, or the piece must be the king.
function declareNotAKing(state) {
	if (state.result) {
		return { ok: false, error: "the game is over" };
	}
	if (state.pcKing < 0 || state.pcColor != state.turnColor) {
		return { ok: false, error: "no potential check to answer" };
	}
	let defKing = attPiece(state, state.pcKing);
	if (defKing.waves() == "K") {
		// (Nothing else could be the king: there would be no complete army)
		return { ok: false, error: "the piece on " + coords2text(defKing.coords()) + " must be the king" };
	}
	defKing.removewaves("K");
	state.thisMove = state.thisMove + "[" + coords2text([defKing.r, defKing.c]) + "]";
	updateOptionsFromEntanglement(state, state.turnColor);
	state.pcKing = -1;
	state.pcColor = "";
	refreshChecks(state, state.turnColor);
	return { ok: true, square: [defKing.r, defKing.c] };
}

// Move the piece on `from` to `to`, collapsing every piece's possibilities to match.
// choices: { enPassant, promotion, castle, ask }
//   enPassant / promotion: true or false when the move is ambiguous (the piece could be a pawn but could also
//     be something else). Leave undefined to have ask(question) called instead, with "En passant?" or
//     "Promote Pawn?", which should return true or false.
//   castle: the same for a move that could be a castle (see castling.js) but could also be an ordinary move
//     by the piece's other possibilities; the question is "Castle?". A move only a castle can make castles.
// Returns:
//   { ok: false, error }               the move isn't possible (the state is unchanged)
//   { ok: true, movedIntoCheck, enPassant, promotion, castle }
//                                       the move was made. If movedIntoCheck, it leaves the mover in check,
//                                       so it must not be submitted. enPassant / promotion / castle say whether
//                                       the move was played as an en passant / a promotion / a castle (whether
//                                       given or asked).
function startMove(state, from, to, choices = {}) {
	if (state.result) {
		return { ok: false, error: "the game is over" };
	}
	let movingPiece = state.board[from[0]][from[1]];
	if (movingPiece === null || movingPiece.color != state.turnColor) {
		return { ok: false, error: "no piece of the side to move on " + coords2text(from) };
	}
	const ordinary = ismember(to, getPotentialMoves(state, from));
	const castle = getCastlingMoves(state, from).find(m => isequal(m.kingTo, to));
	if (!ordinary && !castle) {
		return { ok: false, error: coords2text(from) + " can't move to " + coords2text(to) };
	}
	if (choices.castle === true && !castle) {
		return { ok: false, error: coords2text(from) + coords2text(to) + " can't be a castle" };
	}
	if (choices.castle === false && !ordinary) {
		return { ok: false, error: coords2text(from) + coords2text(to) + " can only be a castle" };
	}
	const choose = (given, question) => {
		if (given !== undefined) { return given; }
		if (choices.ask) { return choices.ask(question); }
		throw new Error("Move " + coords2text(from) + coords2text(to) + " needs an answer to: " + question);
	};
	let doEP = choices.enPassant;
	let doPromotion = choices.promotion;
	let doCastle = false;
	if (castle) {
		// The mover decides whether they meant to castle, unless only a castle can make this move
		doCastle = ordinary ? choose(choices.castle, "Castle?") : true;
	}
	// The piece this move could take en passant (looked for before anything on the board changes)
	const epVictim = doCastle ? null : enPassantVictim(state, to, movingPiece.color);

	state.thisMove = state.thisMove + "(" + movingPiece.waves() + ")" + coords2text(from);

	if (doCastle) {
		// The king piece collapses to a king, the rook piece to a rook, and the rook jumps over the king
		const rook = state.board[castle.rookFrom[0]][castle.rookFrom[1]];
		movingPiece.removewaves("QBNRP");
		rook.removewaves("KQBNP");
		rook.hasmoved = 1;
		rook.r = castle.rookTo[0];
		rook.c = castle.rookTo[1];
		state.board[castle.rookTo[0]][castle.rookTo[1]] = rook;
		state.board[castle.rookFrom[0]][castle.rookFrom[1]] = null;
		state.takenPiece = null;
	} else {
		// Remove the options from this piece based on movement:
		movingPiece.updateOptionsByDest(state, to);
		state.takenPiece = state.board[to[0]][to[1]];
	}

	movingPiece.hasmoved = 1;
	movingPiece.r = to[0];
	movingPiece.c = to[1];

	// Move the piece:
	if (state.takenPiece !== null) {
		state.takenPiece.captured = state.turnNumber;
		state.takenPiece.removewaves('K');
		state.thisMove = state.thisMove + "x";
	}
	state.board[to[0]][to[1]] = movingPiece;
	state.board[from[0]][from[1]] = null;

	// Collapse the pieces
	updateOptionsFromEntanglement(state);

	let direction = -1;
	if (movingPiece.color == "w") {
		direction = 1;
	}

	// Check for en passant:
	if (epVictim !== null && movingPiece.waves().includes("P")) {
		if (movingPiece.waves().length > 1) {
			// The mover needs to decide if they meant to do an en passant. If they do it collapses their piece to a pawn.
			doEP = choose(doEP, "En passant?");
		} else {
			doEP = true;
		}
		if (doEP) {
			state.thisMove = state.thisMove + "x";
			movingPiece.removewaves("KQNRB");
			state.takenPiece = epVictim;
			epVictim.captured = state.turnNumber;
			epVictim.removewaves("KQNRB");
			state.board[epVictim.r][epVictim.c] = null;
			// update all the collapses again!
			updateOptionsFromEntanglement(state);
		} else {
			movingPiece.removewaves("P");
			updateOptionsFromEntanglement(state);
		}
	} else {
		doEP = false;
	}

	// Save the en passant square
	if (movingPiece.waves().includes("P")) {
		if (to[0]-from[0] == -2*direction) {
			state.epCoords = [from[0]-direction, from[1]];
			state.epColor = state.turnColor;
		}
	}

	// Check if the moving piece is a pawn to be promoted
	if (movingPiece.waves().includes("P")) {
		if ((state.turnColor=="w" && to[0]==0) || (state.turnColor=="b" && to[0]==7)) {
			if (movingPiece.waves().length > 1) {
				// The mover needs to decide if they want to promote the piece as though it were a pawn.
				doPromotion = choose(doPromotion, "Promote Pawn?");
			} else {
				doPromotion = true;
			}
			if (doPromotion) {
				// It was a pawn, and is now a new piece: a queen, rook, knight or bishop
				movingPiece.removewaves("KQNBR");
				movingPiece.promote();
			} else {
				movingPiece.removewaves("P");
			}
			updateOptionsFromEntanglement(state);
		}
	}

	// Finish move annotation
	if (doEP) {
		state.thisMove = state.thisMove + coords2text(to) + "(" + movingPiece.waves() + ")";
		state.thisMove = state.thisMove + " e.p.";
	} else if (doPromotion) {
		state.thisMove = state.thisMove + coords2text(to) + "(P)";
		state.thisMove = state.thisMove + "=(QRNB)";
	} else {
		state.thisMove = state.thisMove + coords2text(to) + "(" + movingPiece.waves() + ")";
	}
	if (doCastle) {
		// Towards the h-file is the short (king) side
		state.thisMove = state.thisMove + (to[1] > from[1] ? " O-O" : " O-O-O");
	}

	const played = { enPassant: doEP === true, promotion: doPromotion === true, castle: doCastle };
	// Has the mover put themselves in check? Then the move can be looked at but not submitted.
	if (refreshChecks(state, state.turnColor).attackerCoords.length > 0) {
		return { ok: true, movedIntoCheck: true, ...played };
	}
	// Has the mover put the opponent in check?
	refreshChecks(state, oppColor(state.turnColor));
	if (state.autoCheck) {
		state.thisMove = state.thisMove + "+";
	}
	return { ok: true, movedIntoCheck: false, ...played };
}

// Declare potential check on the opponent piece at kingCoords, which must be one of findPotentialKings(state).
// Returns { ok: false, error } or { ok: true, attackers }, where attackers are the side to move's pieces
// that could attack it (one or more of them must then be added with addPCAttacker).
function choosePCKing(state, kingCoords) {
	if (!ismember(kingCoords, findPotentialKings(state))) {
		return { ok: false, error: coords2text(kingCoords) + " isn't a possible king under attack" };
	}
	let king = state.board[kingCoords[0]][kingCoords[1]];
	state.pcKing = king.i;
	state.pcColor = king.color;
	return { ok: true, attackers: findPCAttackers(state) };
}

// Add the piece at attackerCoords as an attacker of the potential-check king, collapsing it to the waves
// that could make that capture.
// Returns { ok: false, error } or { ok: true, movedIntoCheck }: the collapse can turn the attacker into a
// true king and so put the mover in check, which makes the move invalid.
function addPCAttacker(state, attackerCoords) {
	let attackerPiece = state.board[attackerCoords[0]][attackerCoords[1]];
	if (attackerPiece === null || attackerPiece.color != state.turnColor) {
		return { ok: false, error: "no piece of the side to move on " + coords2text(attackerCoords) };
	}
	let defKing = defPiece(state, state.pcKing);
	if (!ismember(defKing.coords(), getPotentialMoves(state, attackerCoords))) {
		return { ok: false, error: coords2text(attackerCoords) + " can't attack the potential king" };
	}
	attackerPiece.updateOptionsByDest(state, defKing.coords());
	updateOptionsFromEntanglement(state, state.turnColor);
	refreshChecks(state, state.turnColor);
	return { ok: true, movedIntoCheck: state.autoCheck };
}

// The "<king+ attacker attacker>" notation for a potential check declared by the side to move, or "".
// Doesn't change the state.
function pcMoveText(state) {
	let txt = "";
	if (state.pcKing >= 0 && state.pcColor == oppColor(state.turnColor)) {
		let piece = defPiece(state, state.pcKing);
		txt = "<" + coords2text([piece.r, piece.c]) + "+";
		let attackerCoords = findChecks(state, state.pcColor).attackerCoords;
		for (let ai = 0; ai < attackerCoords.length; ai++) {
			txt = txt + " " + coords2text(attackerCoords[ai]);
		}
		txt = txt + ">";
	}
	return txt;
}

// Finish the turn: add it to the history and pass to the other side
function endTurn(state) {
	if (state.pcColor == state.turnColor) {
		// Must have gotten out of potential check
		state.pcKing = -1;
		state.pcColor = "";
	}

	// The ply is added to the history once the result is known, below, as checkmate changes its check mark
	const moveText = state.thisMove;
	const pcText = pcMoveText(state);

	if (state.takenPiece !== null) {
		state.takenPiece.captured = state.turnNumber;
	}
	state.takenPiece = null;

	if (state.turnColor == "w") {
		state.turnColor = "b";
	} else {
		state.turnNumber = state.turnNumber + 1;
		state.turnColor = "w";
	}
	if (state.turnColor == state.epColor) {
		state.epColor = "";
		state.epCoords = [];
	}
	state.thisMove = state.turnNumber.toString() + state.turnColor + ". ";
	refreshChecks(state, state.turnColor);
	state.result = gameResult(state);

	if (state.history.length > 0) {
		state.history = state.history + "\r\n";
	}
	state.history = state.history + checkmateText(moveText, pcText, state);
}

// The ply as written in the history. On checkmate, the "+" of the check that mates becomes "#": the automatic
// check's "...e5(B)#", or else the potential check's "<h8# e5>".
function checkmateText(moveText, pcText, state) {
	if (state.result != "checkmate") {
		return moveText + pcText;
	}
	if (state.autoCheck && moveText.endsWith("+")) {
		return moveText.slice(0, -1) + "#" + pcText;
	}
	return moveText + pcText.replace("+", "#");
}

// Could the piece on `from` move to `to` without leaving its side in check, for some answer to any question
// the move asks (en passant, promotion, castle)? Tries each answer on a copy of the state.
function canMoveLegally(state, from, to) {
	const untried = [{}];
	while (untried.length > 0) {
		const answers = untried.pop();
		// Answer each new question "no", and keep "yes" to try next
		const ask = question => {
			if (!(question in answers)) {
				untried.push({ ...answers, [question]: true });
				answers[question] = false;
			}
			return answers[question];
		};
		const result = startMove(cloneState(state), from, to, { ask });
		if (result.ok && !result.movedIntoCheck) {
			return true;
		}
	}
	return false;
}

// Does the side to move have any move that doesn't leave it in check?
function anyLegalMove(state) {
	for (const piece of getPieces(state, state.turnColor)) {
		if (piece.captured > -1) { continue; }
		for (const to of getMoveDestinations(state, piece.coords())) {
			if (canMoveLegally(state, piece.coords(), to)) {
				return true;
			}
		}
	}
	return false;
}

// Does the side to move have a legal turn? A move, or (in potential check) declaring "Not a King" and then a
// move. Declaring a potential check of its own is optional, so it never matters here. Doesn't change the state.
function hasLegalTurn(state) {
	if (state.turnNumber == 0) {
		return true; // Black's move 0 can always pass
	}
	if (anyLegalMove(state)) {
		return true;
	}
	if (state.pcColor == state.turnColor && state.pcKing >= 0) {
		// (declareNotAKing refuses a piece that must be the king)
		const declared = cloneState(state);
		if (declareNotAKing(declared).ok && anyLegalMove(declared)) {
			return true;
		}
	}
	return false;
}

// How the game stands for the side to move: "checkmate" (in check, automatic or potential, with no legal
// turn), "stalemate" (not in check, with no legal turn), or null (the game goes on). Uses state.autoCheck /
// state.potCheck, so refreshChecks for the side to move first. Doesn't change the state.
function gameResult(state) {
	if (hasLegalTurn(state)) {
		return null;
	}
	return state.autoCheck || state.potCheck ? "checkmate" : "stalemate";
}

// Play a whole turn from parsed notation (notation.js parseMoveText): the same steps a player would take.
// choices.ask is only needed if the move leaves an en passant, promotion or castling choice unanswered.
// Returns { ok: true } or { ok: false, error }, and never throws: a move from a network or a pasted history
// can be anything. On failure the state may be part-way through the turn, so play it on a copy (cloneState).
function applyMove(state, move, choices = {}) {
	try {
		return playTurn(state, move, choices);
	} catch (err) {
		// A move too malformed to play, or a fault in the engine: refuse the move rather than break the caller
		return { ok: false, error: "the move couldn't be played (" + (err?.message ?? err) + ")" };
	}
}

// Why a move isn't even the shape of one (see notation.js parseMoveText), or null if it is
function malformed(move) {
	if (move === null || typeof move != "object") {
		return "no move given";
	}
	for (const name of ["notAKing", "from", "to", "pcKing"]) {
		if (move[name] != null && !isSquare(move[name])) {
			return name + " isn't a square";
		}
	}
	const attackers = move.pcAttackers ?? [];
	if (!Array.isArray(attackers) || !attackers.every(isSquare)) {
		return "pcAttackers isn't a list of squares";
	}
	return null;
}

function playTurn(state, move, choices) {
	if (state.result) {
		return { ok: false, error: "the game is over" };
	}
	const problem = malformed(move);
	if (problem) {
		return { ok: false, error: problem };
	}
	if (move.notAKing) {
		const result = declareNotAKing(state);
		if (!result.ok) { return result; }
	}
	if (state.turnNumber > 0) {
		if (!move.from || !move.to) {
			return { ok: false, error: "no move given" };
		}
		const result = startMove(state, move.from, move.to,
			{ enPassant: move.enPassant, promotion: move.promotion, castle: move.castle, ask: choices.ask });
		if (!result.ok) { return result; }
		if (result.movedIntoCheck) { return { ok: false, error: "the move leaves the mover in check" }; }
	}
	if (move.pcKing) {
		const kingResult = choosePCKing(state, move.pcKing);
		if (!kingResult.ok) { return kingResult; }
		for (const attacker of move.pcAttackers ?? []) {
			const result = addPCAttacker(state, attacker);
			if (!result.ok) { return result; }
			if (result.movedIntoCheck) { return { ok: false, error: "the potential check leaves the mover in check" }; }
		}
		// At least one piece must now be certain to capture it (one added above, or one that already was)
		if (findChecks(state, state.pcColor).attackerCoords.length == 0) {
			return { ok: false, error: "the potential check has no attacker" };
		}
	}
	endTurn(state);
	return { ok: true };
}

export { refreshChecks, declareNotAKing, startMove, choosePCKing, addPCAttacker, pcMoveText, endTurn, applyMove, hasLegalTurn, gameResult };
