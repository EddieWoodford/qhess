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

import { isequal, ismember, coords2text } from "./utils.js";
import { oppColor, defPiece, attPiece } from "./state.js";
import { getPotentialMoves } from "./moves.js";
import { findChecks, findPotentialKings, findPCAttackers } from "./check.js";
import { updateOptionsFromEntanglement } from "./entanglement.js";

// Search for check against `color` and store the result in state.autoCheck / state.potCheck.
// Returns the full result from findChecks.
function refreshChecks(state, color) {
	const result = findChecks(state, color);
	state.autoCheck = result.autoCheck;
	state.potCheck = result.potCheck;
	return result;
}

// Declare that the side to move's potential-check king is not a king.
// Returns { ok: false, error } if no potential check is declared on the side to move.
function declareNotAKing(state) {
	if (state.pcKing < 0 || state.pcColor != state.turnColor) {
		return { ok: false, error: "no potential check to answer" };
	}
	let defKing = attPiece(state, state.pcKing);
	defKing.removewaves("K");
	state.thisMove = state.thisMove + "[" + coords2text([defKing.r, defKing.c]) + "]";
	updateOptionsFromEntanglement(state, state.turnColor);
	state.pcKing = -1;
	state.pcColor = "";
	refreshChecks(state, state.turnColor);
	return { ok: true };
}

// Move the piece on `from` to `to`, collapsing every piece's possibilities to match.
// choices: { enPassant, promotion, ask }
//   enPassant / promotion: true or false when the move is ambiguous (the piece could be a pawn but could also
//     be something else). Leave undefined to have ask(question) called instead, with "En passant?" or
//     "Promote Pawn?", which should return true or false.
// Returns:
//   { ok: false, error }               the move isn't possible (the state is unchanged)
//   { ok: true, movedIntoCheck }        the move was made. If movedIntoCheck, it leaves the mover in check,
//                                       so it must not be submitted.
function startMove(state, from, to, choices = {}) {
	let movingPiece = state.board[from[0]][from[1]];
	if (movingPiece === null || movingPiece.color != state.turnColor) {
		return { ok: false, error: "no piece of the side to move on " + coords2text(from) };
	}
	if (!ismember(to, getPotentialMoves(state, from))) {
		return { ok: false, error: coords2text(from) + " can't move to " + coords2text(to) };
	}
	const choose = (given, question) => {
		if (given !== undefined) { return given; }
		if (choices.ask) { return choices.ask(question); }
		throw new Error("Move " + coords2text(from) + coords2text(to) + " needs an answer to: " + question);
	};
	let doEP = choices.enPassant;
	let doPromotion = choices.promotion;

	state.thisMove = state.thisMove + "(" + movingPiece.waves() + ")" + coords2text(from);

	// Remove the options from this piece based on movement:
	movingPiece.updateOptionsByDest(state, to);

	movingPiece.hasmoved = 1;
	movingPiece.r = to[0];
	movingPiece.c = to[1];

	// Move the piece:
	state.takenPiece = state.board[to[0]][to[1]];
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
	if (isequal(to, state.epCoords) && movingPiece.waves().includes("P")) {
		if (movingPiece.waves().length > 1) {
			// The mover needs to decide if they meant to do an en passant. If they do it collapses their piece to a pawn.
			doEP = choose(doEP, "En passant?");
		} else {
			doEP = true;
		}
		if (doEP) {
			state.thisMove = state.thisMove + "x";
			movingPiece.removewaves("KQNRB");
			state.takenPiece = state.board[to[0]+direction][to[1]];
			state.takenPiece.captured = state.turnNumber;
			state.takenPiece.removewaves("KQNRB");
			state.board[to[0]+direction][to[1]] = null;
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
				movingPiece.removewaves("KQNBR");
				movingPiece.promoted = 1;

				movingPiece.promotedOptions = Array(16).fill(1);
				movingPiece.removewaves("KP"); // can't be a king or pawn
				if ((movingPiece.r + movingPiece.c)%2==0) {
					// on a white square, so black bishop is not possible
					movingPiece.promotedOptions[12] = 0;
				} else {
					// on a black square, so white bishop is not possible
					movingPiece.promotedOptions[13] = 0;
				}
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

	// Has the mover put themselves in check? Then the move can be looked at but not submitted.
	if (refreshChecks(state, state.turnColor).attackerCoords.length > 0) {
		return { ok: true, movedIntoCheck: true };
	}
	// Has the mover put the opponent in check?
	refreshChecks(state, oppColor(state.turnColor));
	if (state.autoCheck) {
		state.thisMove = state.thisMove + "+";
	}
	return { ok: true, movedIntoCheck: false };
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

// The "<king+ attacker attacker>" notation for a potential check declared by the side to move, or ""
function pcMoveText(state) {
	let txt = "";
	if (state.pcKing >= 0 && state.pcColor == oppColor(state.turnColor)) {
		let piece = defPiece(state, state.pcKing);
		txt = "<" + coords2text([piece.r, piece.c]) + "+";
		let attackerCoords = refreshChecks(state, state.pcColor).attackerCoords;
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

	if (state.history.length > 0) {
		state.history = state.history + "\r\n";
	}
	state.history = state.history + state.thisMove + pcMoveText(state);

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
}

// Play a whole turn from parsed notation (notation.js parseMoveText): the same steps a player would take.
// choices.ask is only needed if the move leaves an en passant or promotion choice unanswered.
// Returns { ok: true } or { ok: false, error }. On failure the state may be part-way through the turn.
function applyMove(state, move, choices = {}) {
	if (move.notAKing) {
		const result = declareNotAKing(state);
		if (!result.ok) { return result; }
	}
	if (state.turnNumber > 0) {
		if (!move.from || !move.to) {
			return { ok: false, error: "no move given" };
		}
		const result = startMove(state, move.from, move.to,
			{ enPassant: move.enPassant, promotion: move.promotion, ask: choices.ask });
		if (!result.ok) { return result; }
		if (result.movedIntoCheck) { return { ok: false, error: "the move leaves the mover in check" }; }
	}
	if (move.pcKing) {
		const kingResult = choosePCKing(state, move.pcKing);
		if (!kingResult.ok) { return kingResult; }
		for (const attacker of move.pcAttackers) {
			const result = addPCAttacker(state, attacker);
			if (!result.ok) { return result; }
			if (result.movedIntoCheck) { return { ok: false, error: "the potential check leaves the mover in check" }; }
		}
	}
	endTurn(state);
	return { ok: true };
}

export { refreshChecks, declareNotAKing, startMove, choosePCKing, addPCAttacker, pcMoveText, endTurn, applyMove };
