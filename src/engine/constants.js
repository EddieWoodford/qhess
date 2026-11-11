"use strict";

// Each side's 16 identities, in the order used by a piece's options array:
// P1,P2,P3,P4,P5,P6,P7,P8,R1,R2,N1,N2,Bb,Bw,Q, K
// 0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
// (Bb = dark-squared bishop, Bw = light-squared bishop)

// The option indexes of each piece type ("wave")
const WAVE_OPTIONS = {
	P: [0, 1, 2, 3, 4, 5, 6, 7],
	R: [8, 9],
	N: [10, 11],
	B: [12, 13],
	Q: [14],
	K: [15],
};

// The two bishops' option indexes
const DARK_BISHOP = 12;
const LIGHT_BISHOP = 13;

// Which option indexes belong to a piece type ("wave"), e.g. "R" -> [8, 9]
function wave2optidxs(wave) {
	return WAVE_OPTIONS[wave];
}

// Is [r, c] a light square? (a1, row 7 column 0, is dark)
function isLightSquare(r, c) {
	return (r + c) % 2 == 0;
}

export { wave2optidxs, DARK_BISHOP, LIGHT_BISHOP, isLightSquare };
