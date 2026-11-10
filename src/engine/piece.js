"use strict";

// One of a side's 16 pieces: where it is, and which of the 16 identities it could still be.

import { wave2optidxs } from "./constants.js";
import { ismember, sum } from "./utils.js";
import { getPotentialMoves } from "./moves.js";

class Piece {
	constructor(i, r, c, color) {
		this.i = i; // 1-16, to identify each piece uniquely from starting position
		this.r = r; // row
		this.c = c; // column
		this.color = color;
		this.captured = -1; // turn number when this piece was captured. -1 indicates not yet captured
		this.hasmoved = 0; // boolean for whether this piece has moved
		this.fullcollapsed = 0; // boolean for whether this piece is fully collapsed
		this.promoted = 0; // boolean for whether this piece is a promoted pawn
		this.promotedOptions = [];
		// options:
		// options is a 16 element array of 0/1 values to indicate the remaining options available to this piece
		// P1,P2,P3,P4,P5,P6,P7,P8,R1,R2,N1,N2,Bb,Bw,Q, K
		// 0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
		this.options = Array(16).fill(1);
		if ((this.r+this.c)%2==0) {
			// on a white square, so black bishop is not possible
			this.options[12] = 0;
		} else {
			// on a black square, so white bishop is not possible
			this.options[13] = 0;
		}
	}
	coords() {
		return [this.r,this.c];
	}
	removewaves(waves) {
		// Remove a wave from the options array
		for (let wi=0; wi < waves.length; wi++) {
			let optidxs = wave2optidxs(waves[wi]);
			for (let oi = 0; oi < optidxs.length; oi++) {
				if (this.promoted==0) {
					this.options[optidxs[oi]] = 0;
				} else {
					this.promotedOptions[optidxs[oi]] = 0;
				}
			}
		}
	}
	updateOptionsByDest(state, destCoords) {
		let currentWaves = this.waves();
		for (let wi=0; wi < currentWaves.length; wi++) {
			let waveDestinations = getPotentialMoves(state, [this.r,this.c],currentWaves[wi]);
			if (!ismember(destCoords,waveDestinations)) {
				this.removewaves(currentWaves[wi]);
			}
		}
	}
	waves() {
		// Waves string based on options array
		let allwaves = "KQBNRP";
		let wavesout = "";
		let subopts;
		for (let wi = 0; wi < 6; wi++) {
			let optidxs = wave2optidxs(allwaves[wi]);
			if (this.promoted == 0) {
				subopts = this.options.slice(optidxs[0],optidxs[optidxs.length-1]+1);
			} else {
				subopts = this.promotedOptions.slice(optidxs[0],optidxs[optidxs.length-1]+1);
		}
			if (sum(subopts) > 0) {
				wavesout = wavesout + allwaves[wi];
			}
		}
		return wavesout
	}
	wavesWithBishopColor() {
		let wavesout = this.waves();
		if (wavesout.includes('B')) {
			if (this.options[12]==1) {
				wavesout = wavesout.replace('B','Bb');
			} else {
				wavesout = wavesout.replace('B','Bw');
			}
		}
		return wavesout;
	}
}

export { Piece };
