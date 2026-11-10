"use strict";

// The game state, as one plain object passed to every engine function:
// {
//   turnNumber:  0 for Black's move 0, then 1, 2, ...
//   turnColor:   "w" or "b", the side to move
//   board:       8 x 8 array, board[r][c] = the Piece on that square, or null
//   pieces:      { w: [16 Pieces], b: [16 Pieces] }, including captured ones, in starting order
//   history:     the move history so far, one ply per line
//   thisMove:    notation for the move being made
//   epCoords:    [r,c] of the square that can be taken en passant, or []
//   epColor:     the colour that made the double step ("" if none)
//   pcKing:      index (in pieces[pcColor]) of the declared potential-check king, or -1
//   pcColor:     colour of that king, or ""
//   takenPiece:  the Piece captured by the move being made, or null
//   autoCheck, potCheck: result of the most recent check search (see check.js)
// }

import { Piece } from "./piece.js";

function createInitialState() {
	const state = {
		turnNumber: 0,
		turnColor: "b",
		board: [],
		pieces: { w: [], b: [] },
		history: "",
		thisMove: "0b. ",
		epCoords: [],
		epColor: "",
		pcKing: -1,
		pcColor: "",
		takenPiece: null,
		autoCheck: false,
		potCheck: false,
	};
	for (let r = 0; r <= 7; r++) {
		state.board.push(Array(8).fill(null));
	}
	for (let r = 0; r <= 1; r++) {
		for (let c = 0; c <= 7; c++) {
			let i = r*8 + c;
			let piece = new Piece(i, r, c, "b");
			state.pieces.b.push(piece);
			state.board[r][c] = piece;
		}
	}
	for (let r = 6; r <= 7; r++) {
		for (let c = 0; c <= 7; c++) {
			let i = (r-6)*8 + c;
			let piece = new Piece(i, r, c, "w");
			state.pieces.w.push(piece);
			state.board[r][c] = piece;
		}
	}
	return state;
}

function oppColor(color) {
	if (color == "w") {
		return "b";
	}
	return "w";
}

function getPieces(state, color) {
	if (color == "w") {
		return state.pieces.w;
	} else {
		return state.pieces.b;
	}
}

// Piece i of the side not to move (the defender)
function defPiece(state, i) {
	return getPieces(state, oppColor(state.turnColor))[i];
}

// Piece i of the side to move (the attacker)
function attPiece(state, i) {
	return getPieces(state, state.turnColor)[i];
}

export { createInitialState, oppColor, getPieces, defPiece, attPiece };
