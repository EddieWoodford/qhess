"use strict";

// Check and potential check. Pure functions of the game state; no page code.

import { ismember } from "./utils.js";
import { getPieces, oppColor, defPiece } from "./state.js";
import { getPotentialMoves, getCertainMoves } from "./moves.js";

// Is the king of `color` in check?
// Returns { autoCheck, potCheck, kingCoords, attackerCoords }:
//   autoCheck: true if `color` has a fully collapsed king that an opponent piece could capture.
//              kingCoords/attackerCoords are then that king and every piece attacking it.
//   potCheck:  true if there is no collapsed king, but a potential check was declared on `color` and its
//              potential king is still attacked by a piece that could make that capture in every one of its waves.
//              kingCoords is then the potential king (returned even with no attackers).
function findChecks(state, color) {
	// Search to see if a check exists. 
	// Should be called whenever the board state changes and is potentially in a valid move position
	// color is the color of the king to check for check. What a great sentance.
	
	// First look for Auto Check:
	let autoCheck = false;
	let potCheck = false;
	let defPieces = getPieces(state, color);
	let attPieces = getPieces(state, oppColor(color));
	let kingCoords = [];
	for (let pi=0; pi < 16; pi++) {
		if (defPieces[pi].captured==-1 && defPieces[pi].waves() == "K") {
			kingCoords = [defPieces[pi].r,defPieces[pi].c];
			break;
		}
	} 
	let attackerCoords = [];
	if (kingCoords.length > 0) {
		// There is a collapsed king, so look for auto check
		let moveCoords;
		for (let pi=0; pi < 16; pi++) {
			let attacker = attPieces[pi];
			if (attacker.captured > -1) {continue}
			moveCoords = getPotentialMoves(state, attacker.coords());
			if (ismember(kingCoords,moveCoords)) {
				attackerCoords.push(attacker.coords());
			}
		}
		if (attackerCoords.length > 0) {
			autoCheck = true;
			return { autoCheck, potCheck, kingCoords, attackerCoords };
		} else {
			// For auto check, only return anything if there are attackers
			return { autoCheck, potCheck, kingCoords: [], attackerCoords: [] };
		}
		
	} else {

		// If no auto check, then check if the defender of potential check has moved the potential king out of the way ...
		// of the potential attackers.
		if (state.pcKing == -1) {
			return { autoCheck, potCheck, kingCoords: [], attackerCoords: [] };
		}
		if (state.pcColor != color) {
			return { autoCheck, potCheck, kingCoords: [], attackerCoords: [] };
		}
		let defKing = defPieces[state.pcKing];
		if (!defKing.waves().includes("K")) {
			return { autoCheck, potCheck, kingCoords: [], attackerCoords: [] };
		}
		kingCoords = [defKing.r,defKing.c];
		let attacker;
		let moveCoords;
		for (let pi=0; pi < 16; pi++) {
			// Loop through the attacking pieces and see if it is unambiguously attacking the potential king.
			attacker = attPieces[pi];
			if (attacker.captured > -1) {continue}
			moveCoords = getCertainMoves(state, attacker.coords());
			if (ismember(kingCoords,moveCoords)) {
				attackerCoords.push(attacker.coords());
			}
		}
		if (attackerCoords.length > 0) {
			potCheck = true;
		}
		// even if no attackers exist, still return the kingCoords
		return { autoCheck, potCheck, kingCoords, attackerCoords };
		
	}
}

// The opponent's pieces that could still be the king and that at least one of the side to move's
// pieces could reach: the candidates for declaring a potential check. Returns a list of [r,c].
function findPotentialKings(state) {
	let pieces = getPieces(state, state.turnColor);
	let kings = [];
	for (let r = 0; r < 8; r++) {
		for (let c = 0; c < 8; c++) {
			let target = state.board[r][c];
			if (target === null) {continue};
			if (target.color == state.turnColor) {continue};
			if (!target.waves().includes("K")) {continue};
			for (const piece of pieces) {
				if (piece.captured > -1) {continue}
				if (ismember([r,c], getPotentialMoves(state, [piece.r,piece.c]))) {
					kings.push([r,c]);
					break;
				}
			}
		}
	}
	return kings;
}

// Once a potential-check king has been chosen (state.pcKing), the side to move's pieces that could
// attack it. Returns a list of [r,c].
function findPCAttackers(state) {
	let defKing = defPiece(state, state.pcKing);
	let attackers = [];
	for (const piece of getPieces(state, state.turnColor)) {
		if (piece.captured > -1) {continue}
		if (ismember(defKing.coords(), getPotentialMoves(state, piece.coords()))) {
			attackers.push([piece.r,piece.c]);
		}
	}
	return attackers;
}

export { findChecks, findPotentialKings, findPCAttackers };
