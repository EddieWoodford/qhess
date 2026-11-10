"use strict";

// Where a piece could move. Pure functions of the game state; no page code.

import { isequal, clone2DArray, isValidCoord, ismember } from "./utils.js";

function getCertainMoves(state, coords) {
	// Get a list of the certain move destinations. That is - the desinations that a piece can definitely move to in all of their available waves.
	
	let piece = state.board[coords[0]][coords[1]]; // Find the source pieceID
	if (piece === null) {
		return [];
	}
	let waves = piece.waves();
	let moves;
	let thismoves;
	for (let wi=0; wi < waves.length; wi++) {
		// Loop through the waves and intersec the resulting moves
		thismoves = getPotentialMoves(state, coords,waves[wi]);
		if (wi==0) {
			moves = clone2DArray(thismoves);
		} else {
			let mi=0;
			while (mi < moves.length) {
				if (!ismember(moves[mi],thismoves)) {
					moves.splice(mi,1);
					if (moves.length == 0) {
						return [];
					}
				} else {
					mi++;
				}
			}
		}
	}
	return moves;
	
}

function getPotentialMoves(state, coords,waves) {
	// Get a list of all potential destination coordinates.
	// Optional input waves only returns destination for those passed in, otherwise use waves available to piece
	
	let piece = state.board[coords[0]][coords[1]]; // Find the source pieceID
	if (piece === null) {
		return []
	}
	if (piece.captured > -1) {
		return []
	}
	if (waves == undefined) {
		waves = piece.waves();
	}
	let opponentColor = "w";
	let direction  = -1;
	if (piece.color == "w") {
		opponentColor = "b";
		direction = 1;
	}
	let newcoords = [];
	let moves = [];
	// Switch through difference piece types, adding to the growing moves array
	
	// King:
	if (waves.includes("K")) {
		for (let r=-1; r<=1; r++) {
			for (let c=-1; c<=1; c++) {
				newcoords = [coords[0]+r,coords[1]+c];
				if (isValidCoord(newcoords) && state.board[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
			}	
		}
	}
	
	// Pawn:
	if (waves.includes("P")) {
		newcoords = [coords[0]-direction,coords[1]]
		if (isValidCoord(newcoords) && state.board[newcoords[0]][newcoords[1]] === null) {
			moves.push(newcoords)
			// if it can go 1 forward then it might be able to go 2 on its first move:
			if (piece.hasmoved == 0) {
				newcoords = [coords[0]-2*direction,coords[1]]
				if (isValidCoord(newcoords) && state.board[newcoords[0]][newcoords[1]] === null) {
					moves.push(newcoords)
				}
			}
		}
		
		newcoords = [coords[0]-direction,coords[1]-1]
		if (isValidCoord(newcoords)) {
			if (enPassantVictim(state, newcoords, piece.color) !== null || state.board[newcoords[0]][newcoords[1]]?.color == opponentColor) {
				moves.push(newcoords)
			}
		}
		newcoords = [coords[0]-direction,coords[1]+1]
		if (isValidCoord(newcoords)) {
			if (enPassantVictim(state, newcoords, piece.color) !== null || state.board[newcoords[0]][newcoords[1]]?.color == opponentColor) {
				moves.push(newcoords)
			}
		}
	}
	
	// Rooks and Queens:
	if (waves.includes("R") || waves.includes("Q")) {
		for (let i=coords[0]+1; i<=7; i++) {
			newcoords = [i,coords[1]]
			if (state.board[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
			moves.push(newcoords)
			if (state.board[newcoords[0]][newcoords[1]] !== null) {break;}
		}
		for (let i=coords[0]-1; i>=0; i--) {
			newcoords = [i,coords[1]]
			if (state.board[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
			moves.push(newcoords)
			if (state.board[newcoords[0]][newcoords[1]] !== null) {break;}
		}
		for (let i=coords[1]+1; i<=7; i++) {
			newcoords = [coords[0],i]
			if (state.board[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
			moves.push(newcoords)
			if (state.board[newcoords[0]][newcoords[1]] !== null) {break;}
		}
		for (let i=coords[1]-1; i>=0; i--) {
			newcoords = [coords[0],i]
			if (state.board[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
			moves.push(newcoords)
			if (state.board[newcoords[0]][newcoords[1]] !== null) {break;}
		}
	}
	
	// Bishops and Queens:
	if (waves.includes("B") || waves.includes("Q")) {
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]+i,coords[1]+i]
			if (isValidCoord(newcoords)) {
				if (state.board[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
				moves.push(newcoords)
				if (state.board[newcoords[0]][newcoords[1]] !== null) {break;}
			}
		}
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]+i,coords[1]-i]
			if (isValidCoord(newcoords)) {
				if (state.board[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
				moves.push(newcoords)
				if (state.board[newcoords[0]][newcoords[1]] !== null) {break;}
			}
		}
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]-i,coords[1]-i]
			if (isValidCoord(newcoords)) {
				if (state.board[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
				moves.push(newcoords)
				if (state.board[newcoords[0]][newcoords[1]] !== null) {break;}
			}
		}
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]-i,coords[1]+i]
			if (isValidCoord(newcoords)) {
				if (state.board[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
				moves.push(newcoords)
				if (state.board[newcoords[0]][newcoords[1]] !== null) {break;}
			}
		}
	}
	
	// Knights:
	if (waves.includes("N")) {
		newcoords = [coords[0]+2,coords[1]+1];
		if (isValidCoord(newcoords) && state.board[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]+2,coords[1]-1];
		if (isValidCoord(newcoords) && state.board[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-2,coords[1]+1];
		if (isValidCoord(newcoords) && state.board[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-2,coords[1]-1];
		if (isValidCoord(newcoords) && state.board[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]+1,coords[1]+2];
		if (isValidCoord(newcoords) && state.board[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]+1,coords[1]-2];
		if (isValidCoord(newcoords) && state.board[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-1,coords[1]+2];
		if (isValidCoord(newcoords) && state.board[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-1,coords[1]-2];
		if (isValidCoord(newcoords) && state.board[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
	}
	
	for (let i=moves.length-1; i>=0; i--) {
		if (moves[i][0]==coords[0] && moves[i][1]==coords[1]) {
			moves.splice(i,1)
		}
	}
	
	return moves
}

// The piece a pawn of `color` would take en passant by landing on `coords`, or null if there isn't one.
// That is the opponent's piece that has just stepped two squares forward over `coords`, as long as it could
// still be a pawn: a potential check declared on the same move can rule its pawn out.
function enPassantVictim(state, coords, color) {
	if (state.epColor == "" || state.epColor == color || !isequal(coords, state.epCoords)) {
		return null;
	}
	// It stands one square on from the square it passed over, in its own direction of travel
	const r = coords[0] + (state.epColor == "w" ? -1 : 1);
	const piece = state.board[r][coords[1]];
	return piece !== null && piece.color == state.epColor && piece.waves().includes("P") ? piece : null;
}

export { getPotentialMoves, getCertainMoves, enPassantVictim };
