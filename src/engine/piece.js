"use strict";

// One of a side's 16 pieces: where it is, and which of the 16 identities it could still be.

import { wave2optidxs, DARK_BISHOP, LIGHT_BISHOP, isLightSquare } from "./constants.js";
import { ismember } from "./utils.js";
import { getPotentialMoves } from "./moves.js";

// The piece types, in the order waves() lists them
const ALL_WAVES = "KQBNRP";

class Piece {
	constructor(i, r, c, color) {
		this.i = i; // 0-15: the piece's place in its side's list (state.pieces[color]), from its starting square
		this.r = r; // row
		this.c = c; // column
		this.color = color;
		this.captured = -1; // turn number when this piece was captured. -1 indicates not yet captured
		this.hasmoved = 0; // 1 once this piece has moved
		this.promoted = 0; // 1 once this piece is a promoted pawn
		// options:
		// options is a 16 element array of 0/1 values to indicate the remaining options available to this piece
		// P1,P2,P3,P4,P5,P6,P7,P8,R1,R2,N1,N2,Bb,Bw,Q, K
		// 0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
		// Once promoted, options keeps the pawn identity it was (so the army still adds up), and promotedOptions
		// holds what it could be now, in the same layout. See activeOptions.
		this.options = Array(16).fill(1);
		this.promotedOptions = [];
		this.ruleOutOtherBishop();
	}
	coords() {
		return [this.r,this.c];
	}
	clone() {
		// An independent copy (its options can be changed without affecting this piece)
		const copy = Object.assign(Object.create(Piece.prototype), this);
		copy.options = this.options.slice();
		copy.promotedOptions = this.promotedOptions.slice();
		return copy;
	}
	// The options array that says what this piece could be now
	activeOptions() {
		return this.promoted ? this.promotedOptions : this.options;
	}
	// A bishop stays on its colour of square: rule out the one for the other colour
	ruleOutOtherBishop() {
		this.activeOptions()[isLightSquare(this.r, this.c) ? DARK_BISHOP : LIGHT_BISHOP] = 0;
	}
	// Become a promoted pawn: a queen, rook, knight or bishop (of the colour of square it is on).
	// Its options stay as the pawn it was.
	promote() {
		this.promoted = 1;
		this.promotedOptions = Array(16).fill(1);
		this.removewaves("KP");
		this.ruleOutOtherBishop();
	}
	removewaves(waves) {
		// Rule out each of these types ("KQ" rules out king and queen)
		const options = this.activeOptions();
		for (const wave of waves) {
			for (const oi of wave2optidxs(wave)) {
				options[oi] = 0;
			}
		}
	}
	updateOptionsByDest(state, destCoords) {
		// Rule out the types that couldn't have moved to destCoords
		for (const wave of this.waves()) {
			if (!ismember(destCoords, getPotentialMoves(state, [this.r, this.c], wave))) {
				this.removewaves(wave);
			}
		}
	}
	waves() {
		// The types this piece could still be, e.g. "KQRP" (in the order K Q B N R P)
		const options = this.activeOptions();
		return [...ALL_WAVES].filter(wave => wave2optidxs(wave).some(oi => options[oi] == 1)).join("");
	}
	wavesWithBishopColor() {
		// waves(), with the bishop marked as dark-squared ("Bb") or light-squared ("Bw")
		const bishop = this.activeOptions()[DARK_BISHOP] == 1 ? "Bb" : "Bw";
		return this.waves().replace("B", bishop);
	}
}

export { Piece };
