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

// "e4" -> [4, 4]. Text that isn't a square gives something that isn't one either (e.g. "" -> [NaN, NaN]).
function coordstext2coords(coordstext) {
	let c = coordstext.charCodeAt(0) - 97;
	let r = 8 - Number(coordstext[1]);
	return [r, c];
}

// [4, 4] -> "e4"
function coords2text(coords) {
	return String.fromCharCode(coords[1] + 97) + (8 - coords[0]);
}

function isValidCoord(coords) {
	return coords[0] >= 0 && coords[0] <= 7 && coords[1] >= 0 && coords[1] <= 7;
}

// Is v a board square: [r, c], two whole numbers from 0 to 7? (For checking moves from outside the engine.)
function isSquare(v) {
	return Array.isArray(v) && v.length == 2 && v.every(n => Number.isInteger(n) && n >= 0 && n <= 7);
}

// Is coords in coordlist (a list of [r, c])?
function ismember(coords, coordlist) {
	return coordlist.some(item => coords[0] == item[0] && coords[1] == item[1]);
}

export { isequal, coordstext2coords, coords2text, isValidCoord, isSquare, ismember };
