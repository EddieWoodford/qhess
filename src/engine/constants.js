"use strict";

// Each side's 16 identities, in the order used by a piece's options array:
// P1,P2,P3,P4,P5,P6,P7,P8,R1,R2,N1,N2,Bb,Bw,Q, K
// 0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
// (Bb = dark-squared bishop, Bw = light-squared bishop)

// Which option indexes belong to a piece type ("wave")
function wave2optidxs(wave) {
	if (wave == "P") {
		return [0, 1, 2, 3, 4, 5, 6, 7];
	}
	if (wave == "R") {
		return [8, 9];
	}
	if (wave == "N") {
		return [10, 11];
	}
	if (wave == "B") {
		return [12, 13];
	}
	if (wave == "Q") {
		return [14];
	}
	if (wave == "K") {
		return [15];
	}
}

export { wave2optidxs };
