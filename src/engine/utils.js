"use strict";

// General helpers for arrays and board coordinates. No game state, no page code.
// Coordinates are [row, column] with row 0 = rank 8 and column 0 = file a.

function isequal(arr1, arr2) {
	if (arr1.length !== arr2.length) {
		return false;
	}
	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i] !== arr2[i]) {
			return false;
		}
	}
	return true;
}

function clone2DArray(arr) {
	return arr.map(row => [...row]);
}

// "e4" -> [4, 4]
function coordstext2coords(coordstext) {
	let c = coordstext[0].charCodeAt() - 97;
	let r = 8 - coordstext[1];
	return [r, c];
}

// [4, 4] -> "e4"
function coords2text(coords) {
	return String.fromCharCode(coords[1] + 97) + (8 - coords[0]);
}

function isValidCoord(coords) {
	return coords[0] >= 0 && coords[0] <= 7 && coords[1] >= 0 && coords[1] <= 7;
}

// 1 if coords is in coordlist, else 0
function ismember(coords, coordlist) {
	for (let i = 0; i < coordlist.length; i++) {
		if (coords[0] == coordlist[i][0] && coords[1] == coordlist[i][1]) {
			return 1;
		}
	}
	return 0;
}

function sum(x) {
	return x.reduce((a, b) => a + b, 0);
}

export { isequal, clone2DArray, coordstext2coords, coords2text, isValidCoord, ismember, sum };
