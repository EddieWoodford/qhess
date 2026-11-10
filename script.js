"use strict";

import { isequal, clone2DArray, coords2text, isValidCoord, ismember, sum } from "./src/engine/utils.js";
import { wave2optidxs } from "./src/engine/constants.js";
import { filterOptionMatrix, getOM } from "./src/engine/entanglement.js";
import { getHistoryLines, parseMoveText } from "./src/engine/notation.js";
import { WK, WQ, WR, WB, WN, WP, BK, BQ, BR, BB, BN, BP, waveHTML } from "./src/client/glyphs.js";

// Classes

// One board square on the page: its button, what happens when it is hovered or clicked,
// and the highlight flags used when drawing it. The piece on the square lives in BOARD.
class SquareView {
	constructor(r, c, button) {
		this.r = r;
		this.c = c;
		this.button = button;
		this.highlighted = 0;
		// 0 = not a potential move; 1-16 = bearing of potential move where 1=NNE, 2=NE, 3=ENE, 3=E, 5=ESE, etc.
		this.potentialMove = 0;
		this.highlightPotKing = 0; // 0 = not a PK; 1 = candidate for PK;
		this.highlightPotAttacker = 0; // 0 = not a PA; 1 = candidate for PA;
		this.color = (r + c) % 2 == 0 ? "w" : "b"; // square colour

		const coords = [r, c];
		this.button.onmouseenter = () => {
			if (STATE == "clear") {
				highlightPotentialMoves(coords);
			}
		}
		this.button.onmouseleave = () => {
			if (STATE == "highlightPotentialMoves") {
				setState("clear");
			}
		}
		this.button.onclick = () => {
			if (REPLAYNUMBER > -1) {return}
			FINDPIECE = "";
			clearFindPieces();
			if (STATE == "highlightPotentialMoves") {
				showPartialMove(coords);
			} else if (STATE == "showPartialMove") {
				showCompleteMove(coords);
			} else if (STATE == "selectPCKing") {
				selectPCKing(coords);
			} else if (STATE == "selectPCAttackers") {
				selectPCAttackers(coords);
			} else if (STATE == "move0") {
				setState("move0");
			} else {
				restoreGameHistory();
				setState("clear");
			}
		}
	}
	resetButtonClasses() {
		let prevClasses = this.button.className;
		prevClasses = prevClasses.split(" ");
		this.button.classList.remove(...prevClasses);
		this.button.classList.add("boardsquare");
		if (this.color == "w") {
			this.button.classList.add("whitesquare");
		} else {
			this.button.classList.add("blacksquare");
		}
	}
	setWavetext(piece) {
		if (piece === null) {
			this.button.innerHTML = "";
		} else {
			this.button.innerHTML = waveHTML(piece.waves(), piece.color);
		}
	}
}

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
	updateOptionsByDest(destCoords) {
		let currentWaves = this.waves();
		for (let wi=0; wi < currentWaves.length; wi++) {
			let waveDestinations = getPotentialMoves([this.r,this.c],currentWaves[wi]);
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


////////////////////////////////
// Button Actions
////////////////////////////////
function sideButton1Click() {
	if (REPLAYNUMBER > -1) {
		// When in replay mode, sideButton1 is 'Resume Game From Here'
		let foo = REPLAYNUMBER;
		REPLAYNUMBER = -1;
		restoreGameHistory(null, 2*foo);
	} else {
		sideButton1Action();
	}
}

function sideButton1Action() {
	if (STATE == "showCompleteMove" || STATE == "move0") {
		findPotentialKingsToAttack();
		setState("selectPCKing");
	} else if (STATE == "clear" && POTCHECK) {
		declareNotAKing();
		setState("clear");
	}
}

function sideButton2Click() {
	// Can put extra code here that will only happen when user clicks the button, rather than when the script calls
	// sideButton2Action() to replicate a user click (typically while restoring a game)
	
	/////////////////////
	sideButton2Action();
}

function sideButton2Action() {
	if (STATE == "showCompleteMove" || STATE == "selectPCAttackers" || STATE == "move0") {
		submitMove();
		setState("clear");
	} else if (STATE == "invalidMoveIntoCheck") {
		restoreGameHistory();
		setState("clear");
	}
}

function declareNotAKing() {
	let defKing = attPiece(PCKING);
	// THISMOVE = "[(" + defKing.waves() + ")" + coords2text([defKing.r, defKing.c]);
	defKing.removewaves("K");
	// THISMOVE = THISMOVE + "(" + defKing.waves() + ")]";
	THISMOVE = THISMOVE + "[" + coords2text([defKing.r, defKing.c]) + "]";
	updateOptionsFromEntanglement(TURNCOLOR);
	PCKING = -1; 
	PCCOLOR = "";
	clearFindPotentialCheckPieces();
	findChecks(TURNCOLOR);
}

function submitMove() {
	// Here after clicking sideButton1 when a valid move is chosen
		
	// Update move history label:
	// The move annotation itself is constructed in showCompleteMove(), but if there is a Potential Check declared,
	// then the contents of the <> in the move annotation is done here
	if (PCCOLOR == TURNCOLOR) {
		// Must have gotten out of potential check
		PCKING = -1;
		PCCOLOR = "";
	}
	
	if (MOVEHISTORY.length > 0) {
		MOVEHISTORY = MOVEHISTORY + "\r\n"
	}
	MOVEHISTORY = MOVEHISTORY + THISMOVE + pcMoveText();
	let historyArea = document.getElementById("movehistory");
	if (REPLAYNUMBER == -1) {
		historyArea.innerText = MOVEHISTORY;
	}
	

	if (TAKENPIECE !== null) {
		TAKENPIECE.captured = TURNNUMBER;
	}

	// Remember this move's squares so replay can highlight the last move
	LASTSTARTCOORDS = STARTCOORDS;
	LASTENDCOORDS = ENDCOORDS;

	if (TURNCOLOR == "w") {
		TURNCOLOR =	"b";
	} else {
		TURNNUMBER = TURNNUMBER + 1;
		TURNCOLOR = "w";
	}
	if (TURNCOLOR == EPCOLOR) {
		EPCOLOR = "";
		EPCOORDS = [];
	}
	THISMOVE = TURNNUMBER.toString() + TURNCOLOR + ". ";
	clearFindPotentialCheckPieces();
	findChecks(TURNCOLOR);
	
	// copyLastMove();
}

function findPiecesClick(wave) {
	clearFindPieces();
	if (wave == FINDPIECE) {
		FINDPIECE = "";
	} else {
		FINDPIECE = wave;
		//document.getElementById("find"+wave).style.background = "purple";
		//document.getElementById("find"+wave).style.backgroundImage = "none";
		document.getElementById("find"+wave).classList.add("findHighlight");
	}
	setState(STATE);
}

function toggleFlippedBoard() {
	if (document.documentElement.style.getPropertyValue('--board-flex-flow') == 'column-reverse nowrap') {
        document.documentElement.style.setProperty('--board-flex-flow', 'column nowrap');
		document.documentElement.style.setProperty('--boardrow-flex-flow', 'row nowrap');
    } else {
		document.documentElement.style.setProperty('--board-flex-flow', 'column-reverse nowrap');
		document.documentElement.style.setProperty('--boardrow-flex-flow', 'row-reverse nowrap');
    }
}

function clearFindPieces() {
	document.getElementById("findK").classList.remove("findHighlight");
	document.getElementById("findQ").classList.remove("findHighlight");
	document.getElementById("findR").classList.remove("findHighlight");
	document.getElementById("findN").classList.remove("findHighlight");
	document.getElementById("findB").classList.remove("findHighlight");
	document.getElementById("findP").classList.remove("findHighlight");
}

function highlightPotentialMoves(coords) {
	// Highlight potential moves temporarily while mouse is over square
	if (BOARD[coords[0]][coords[1]] === null) {return;}
	if (BOARD[coords[0]][coords[1]].captured > -1) {return;}
	if (BOARD[coords[0]][coords[1]].color == TURNCOLOR) {
		SQUARES[coords[0]][coords[1]].highlighted = 1;

		let moves = getPotentialMoves(coords);
		for (let i=0; i < moves.length; i++) {
			let delY = coords[0] - moves[i][0];
			let delX = moves[i][1] - coords[1];
			// returns 1-16 = bearing of potential move where 1=NNE, 2=NE, 3=ENE, 3=E, 5=ESE, etc.
			let bearing = (Math.round(((Math.atan2(delX, delY) * 180) / Math.PI)/22.5) + 16 - 1) % 16 + 1;
			SQUARES[moves[i][0]][moves[i][1]].potentialMove = bearing;
		}
		setState("highlightPotentialMoves");
	}
}

function showPartialMove(coords) {
	// Show potential moves after clicking on start location
	let piece = coords2piece(coords);
	if (piece !== null && piece.color == TURNCOLOR) {
		
		STARTCOORDS = coords;
		let moves = getPotentialMoves(coords);
		for (let i=0; i<moves.length; i++) {
			let delY = coords[0] - moves[i][0];
			let delX = moves[i][1] - coords[1];
			// returns 1-16 = bearing of potential move where 1=NNE, 2=NE, 3=ENE, 3=E, 5=ESE, etc.
			let bearing = (Math.round(((Math.atan2(delX, delY) * 180) / Math.PI)/22.5) + 16 - 1) % 16 + 1;
			SQUARES[moves[i][0]][moves[i][1]].potentialMove = bearing;
		}
		setState("showPartialMove");
	}
}

function showCompleteMove(endCoords,doEP,doPromotion) {
	// Input doEP (do en passant) is optional and typically empty, except for when restoring a move history
	
	// After clicking on destination:
	let startCoords = STARTCOORDS;
	let validDestinations = getPotentialMoves(startCoords);
	if (!ismember(endCoords,validDestinations)) {
		setState("clear");
		return;
	}
	let movingPiece = BOARD[startCoords[0]][startCoords[1]];
	THISMOVE = THISMOVE + "(" + movingPiece.waves() + ")" + coords2text(startCoords);
	
	// Remove the options from this piece based on movement:
	movingPiece.updateOptionsByDest(endCoords);
	
	
	movingPiece.hasmoved = 1;
	movingPiece.r = endCoords[0];
	movingPiece.c = endCoords[1];
	
	// Move the piece:
	ENDCOORDS = endCoords;
	TAKENPIECE = BOARD[endCoords[0]][endCoords[1]];
	if (TAKENPIECE !== null) {
		TAKENPIECE.captured = TURNNUMBER;
		TAKENPIECE.removewaves('K');
		THISMOVE = THISMOVE + "x";
	}
	BOARD[endCoords[0]][endCoords[1]] = movingPiece;
	BOARD[startCoords[0]][startCoords[1]] = null;
	
	
	// Collapse the pieces
	updateOptionsFromEntanglement();
	

	let direction  = -1;
	if (movingPiece.color == "w") {
		direction = 1;
	}
	
	// Check for en passant:
	if (isequal(endCoords,EPCOORDS) && movingPiece.waves().includes("P")) {
		if (movingPiece.waves().length > 1) {
			if (doEP == undefined) {
			// In this case the attacker needs to decide if they meant to do an en passant. If they do it collapses their piece to a pawn.
				doEP = confirm("En passant?");
			}
		} else {
			doEP = true;
		}
		if (doEP) {
			THISMOVE = THISMOVE + "x";
			movingPiece.removewaves("KQNRB");
			TAKENPIECE = BOARD[endCoords[0]+direction][endCoords[1]];
			TAKENPIECE.captured = TURNNUMBER;
			TAKENPIECE.removewaves("KQNRB");
			BOARD[endCoords[0]+direction][endCoords[1]] = null;
			// update all the collpases again!
			updateOptionsFromEntanglement();
		} else {
			movingPiece.removewaves("P");
			updateOptionsFromEntanglement();
		}
	} else {
		doEP = false;
	}
	
	
	// Save the en passant square
	if (movingPiece.waves().includes("P")) {
		if (endCoords[0]-startCoords[0] == -2*direction) {
			EPCOORDS = [startCoords[0]-direction,startCoords[1]];
			EPCOLOR = TURNCOLOR;
		}
	}
	
	// Check if the moving piece is a pawn to be promoted
	if (movingPiece.waves().includes("P")) {
		if ((TURNCOLOR=="w" && endCoords[0]==0) || (TURNCOLOR=="b" && endCoords[0]==7)) {
			if (movingPiece.waves().length > 1) {
				if (doPromotion == undefined) {
					// In this case the player needs to decide if they want to promote the piece as though it were a pawn.
					doPromotion = confirm("Promote Pawn?");
				}
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
			updateOptionsFromEntanglement();
		}
	}
	
	// Finish move annotation
	if (doEP) {
		THISMOVE = THISMOVE + coords2text(endCoords) + "(" + movingPiece.waves() + ")";
		THISMOVE = THISMOVE + " e.p.";
	} else if (doPromotion) {
		THISMOVE = THISMOVE + coords2text(endCoords) + "(P)";
		THISMOVE = THISMOVE + "=(QRNB)";
	} else {
		THISMOVE = THISMOVE + coords2text(endCoords) + "(" + movingPiece.waves() + ")"
	}
	
	// Now, look to see if attacker has put themselves in automatic check. If so, it's an invalid move
	clearFindPotentialCheckPieces();
	let [kingCoords,attackerCoords] = findChecks(TURNCOLOR);
	if (attackerCoords.length > 0) {
		// We will still display the invalid move, but make it impossible to submit, as
		// the player might want to inspect the board to understand how the check happened.
		setState("invalidMoveIntoCheck");
	} else {		
		// Check if the attacker has put the defender in auto check:
		clearFindPotentialCheckPieces();
		[kingCoords,attackerCoords] = findChecks(oppColor());
		if (AUTOCHECK) {
			THISMOVE = THISMOVE + "+";
		}
		setState("showCompleteMove");
	}

}

////////////////////////////////
// Move History
////////////////////////////////
function restoreGameHistory(historyText,nMoves) {
	// Restore a game from whatever history is in the move history textbox
	
	let historyArea = document.getElementById("movehistory");
	let historyLines;
	if (historyText != undefined) {
		historyLines = getHistoryLines(historyText);
		historyArea.innerText = historyLines.join("\r\n");
	} else {
		historyLines = getHistoryLines(historyArea.innerText);
	}
	let moveText;
	setup();
	if (nMoves == undefined) {
		nMoves = historyLines.length;
	}
	for (let i=0; i < nMoves; i++) {
		moveText = historyLines[i];
		if (moveText!="") {
			let resultText = doMoveFromText(moveText);
			sideButton2Action(); // submit
		}
	}
}

function doMoveFromText(moveText) {
	// Replay one ply of notation by performing the same actions a player would
	let move = parseMoveText(moveText);

	// Check that the move number eg "3w. " is correct.
	if (move.turn != TURNNUMBER.toString() + TURNCOLOR) {
		debugPrint("Move text number + colour did not match expected");
	}

	if (move.notAKing) {
		sideButton1Action(); // "Declare 'Not a King'" button
	}
	if (TURNNUMBER > 0) {
		// The ply should include an actual move
		showPartialMove(move.from);
		showCompleteMove(move.to, move.enPassant, move.promotion);
	}
	if (move.pcKing) {
		sideButton1Action(); // "Add Potential Check" button
		selectPCKing(move.pcKing);
		for (const attacker of move.pcAttackers) {
			selectPCAttackers(attacker);
		}
	}
	return THISMOVE
}

function copyAllHistory() {
	let historyArea = document.getElementById("movehistory");
	let historyText = historyArea.innerText;
	navigator.clipboard.writeText(historyText);
}

function copyLastMove() {
	let historyArea = document.getElementById("movehistory");
	let historyText = historyArea.innerText;
	let historyLines = getHistoryLines(historyText);
	navigator.clipboard.writeText(historyLines[historyLines.length-1]);
}

function pasteAllRestore() {
	let historyArea = document.getElementById("movehistory");
	historyArea.innerText = "";
	navigator.clipboard.readText().then((clipText) => (restoreGameHistory(clipText)));
}

function pasteLineRestore() {
	let historyArea = document.getElementById("movehistory");
	let historyLines = getHistoryLines(historyArea.innerText);
	let historyText = historyLines.join("\r\n");
	navigator.clipboard.readText().then((clipText) => (restoreGameHistory(historyText + "\r\n" + clipText)));
}

function stepBackAll() {
	REPLAYNUMBER = 0.5;
	restoreGameHistory(null, 2*REPLAYNUMBER);
}

function stepBackMove() {
	if (REPLAYNUMBER == -1) {
		// starting replay from game state
			if (TURNCOLOR == "w") {
			REPLAYNUMBER = TURNNUMBER - 0.5;
		} else {
			REPLAYNUMBER = TURNNUMBER;
		}
	}
	REPLAYNUMBER = REPLAYNUMBER - 0.5;
	REPLAYNUMBER = Math.max(REPLAYNUMBER,0.5);
	restoreGameHistory(null, 2*REPLAYNUMBER);
	
}

function stepForwardMove() {
	let historyArea = document.getElementById("movehistory");
	let historyLines = getHistoryLines(historyArea.innerText);
	if (REPLAYNUMBER < historyLines.length/2) {
		let moveText = historyLines[2*REPLAYNUMBER];
		REPLAYNUMBER = REPLAYNUMBER + 0.5;
		doMoveFromText(moveText);
		sideButton2Action(); // submit
		
		// restoreGameHistory(null, 2*REPLAYNUMBER);
	}
}

function stepForwardAll() {
	let historyArea = document.getElementById("movehistory");
	let historyLines = getHistoryLines(historyArea.innerText);
	REPLAYNUMBER = historyLines.length/2;
	restoreGameHistory(null, 2*REPLAYNUMBER);
}

function replaynumber2turnID() {
	if (REPLAYNUMBER == -1) {
		return "";
	} else if (REPLAYNUMBER % 1 == 0) {
		return TURNNUMBER.toString() + "w. ";
	} else {
		return TURNNUMBER.toString() + "b. ";
	}
}



////////////////////////////////
// Check
////////////////////////////////
function findPotentialKingsToAttack() {
	// FInd all candidate kings for potential check
	let pieces = getPieces(TURNCOLOR);
	let piece;
	let moves;
	let nPotKings = 0;
	
	for (let r=0; r<8; r++) {
		for (let c=0; c<8; c++) {
			if (BOARD[r][c] === null) {continue};
			if (BOARD[r][c].color == TURNCOLOR) {continue};
			if (!BOARD[r][c].waves().includes("K")) {continue};
			// Now we know the square has an opponent king-wave on it
			// If the square is being attacked by any piece then it is a valid candidate for a PC King, and then we want to
			// highlight it.
			for (let pi=0; pi < pieces.length; pi++) {
				piece = pieces[pi];
				if (piece.captured > -1) {continue}
				moves = getPotentialMoves([piece.r,piece.c]);
				if (ismember([r,c],moves)) {
					SQUARES[r][c].highlightPotKing = 1;
					nPotKings++;
				}
			}
		}
	}
	return nPotKings;
}

function findPCAttackers() {
	// Now a potential check king has been selected, so highlight the potential attacking pieces
	// Also called after every new PC attacker is selected, in case that selection collapses waves and changes
	// the remaining candidates
	
	let attackPieces = getPieces(TURNCOLOR);
	let piece;
	let moves;
	let defKing = defPiece(PCKING);
	
	let potAttackerCoords = [];
	for (let pi=0; pi < attackPieces.length; pi++) {
		piece = attackPieces[pi];
		if (piece.captured > -1) {continue}
		moves = getPotentialMoves(piece.coords());
		if (ismember(defKing.coords(),moves)) { 
			SQUARES[piece.r][piece.c].highlightPotAttacker = 1;
			potAttackerCoords.push([piece.r,piece.c]);
		} else {
			SQUARES[piece.r][piece.c].highlightPotAttacker = 0;
		}
	}
	return potAttackerCoords;
}

function clearFindPotentialCheckPieces() {
	for (let r=0; r<8; r++) {
		for (let c=0; c<8; c++) {
			SQUARES[r][c].highlightPotKing = 0;
			SQUARES[r][c].highlightPotAttacker = 0;
		}
	}
}

function selectPCKing(kingCoords) {
	// Get here after clicking on a square in "selectPCKing" state
	if (SQUARES[kingCoords[0]][kingCoords[1]].highlightPotKing == 0) {
		restoreGameHistory();
		setState("clear");
		return
	}
	clearFindPotentialCheckPieces(); // stop highlighting the potential kings
	
	// Make this piece the PC King
	PCKING = BOARD[kingCoords[0]][kingCoords[1]].i;
	PCCOLOR = BOARD[kingCoords[0]][kingCoords[1]].color;
	let potAttackerCoords = findPCAttackers();
	if (potAttackerCoords.length == 1) {
		selectPCAttackers(potAttackerCoords[0]);
	} else {
		setState("selectPCAttackers");
	}
}

function selectPCAttackers(attackerCoords) {
	// Get here when a PC attacker is selected by clicking on its square
	
	let attackerPiece = coords2piece(attackerCoords);
	if (attackerPiece === null || attackerPiece.color != TURNCOLOR) {
		// clicked on an empty square
		restoreGameHistory();
		setState("clear");
		return
	}
	
	let attackerMoves = getPotentialMoves(attackerCoords);
	let defKing = defPiece(PCKING);
	if (!ismember(defKing.coords(),attackerMoves)) {
		// clicked on a piece which doesn't attack the PC king
		restoreGameHistory();
		setState("clear");
		return
	}
	
	
	attackerPiece.updateOptionsByDest(defKing.coords());
	updateOptionsFromEntanglement(TURNCOLOR);
	
	// It is possible that by setting a potential check the attacker collapses down to a true king and thus puts 
	// themselves into auto check. That wouldn't be a valid move
	clearFindPotentialCheckPieces();
	findChecks(TURNCOLOR);
	if (AUTOCHECK) {
		setState("invalidMoveIntoCheck");
		return;
	}
	
	findPCAttackers();
	setState("selectPCAttackers");
}

function findChecks(color) {
	// Search to see if a check exists. 
	// Should be called whenever the board state changes and is potentially in a valid move position
	// color is the color of the king to check for check. What a great sentance.
	
	// First look for Auto Check:
	AUTOCHECK = false;
	POTCHECK = false;
	let defPieces = getPieces(color);
	let attPieces = getPieces(oppColor(color));
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
			moveCoords = getPotentialMoves(attacker.coords());
			if (ismember(kingCoords,moveCoords)) {
				attackerCoords.push(attacker.coords());
			}
		}
		if (attackerCoords.length > 0) {
			AUTOCHECK = true;
			return [kingCoords,attackerCoords];
		} else {
			// For auto check, only return anything if there are attackers
			return [[],[]];
		}
		
	} else {

		// If no auto check, then check if the defender of potential check has moved the potential king out of the way ...
		// of the potential attackers.
		if (PCKING == -1) {
			return [[],[]];
		}
		if (PCCOLOR != color) {
			return [[],[]];
		}
		let defKing = defPieces[PCKING];
		if (!defKing.waves().includes("K")) {
			return [[],[]];
		}
		kingCoords = [defKing.r,defKing.c];
		let attacker;
		let moveCoords;
		for (let pi=0; pi < 16; pi++) {
			// Loop through the attacking pieces and see if it is unambiguously attacking the potential king.
			attacker = attPieces[pi];
			if (attacker.captured > -1) {continue}
			moveCoords = getCertainMoves(attacker.coords());
			if (ismember(kingCoords,moveCoords)) {
				attackerCoords.push(attacker.coords());
			}
		}
		if (attackerCoords.length > 0) {
			POTCHECK = true;
		}
		// even if no attackers exist, still return the kingCoords
		return [kingCoords,attackerCoords];
		
	}
}

function pcMoveText() {
	// The PC notation can't be added onto THISMOVE since the king is the last entry.
	// This function returns the "<....>" text for the potential check notation
	let txt = "";
	if (PCKING >= 0 && PCCOLOR == oppColor()) {
		let piece = defPiece(PCKING);
		txt = "<" + coords2text([piece.r, piece.c]) + "+";
		
		let kingCoords;
		let attackerCoords;
		[kingCoords,attackerCoords] = findChecks(PCCOLOR);
		for (let ai=0; ai < attackerCoords.length; ai++) {
			txt = txt + " " + coords2text([attackerCoords[ai][0], attackerCoords[ai][1]]);
		}
		txt = txt + ">";
	}
	return txt;
}

////////////////////////////////
// Piece collapse
////////////////////////////////
function updateOptionsFromEntanglement(colors) {
	if (colors == undefined) {
		colors = ["w", "b"];
	}
	if (typeof colors === "string") {
		// The old code was sometimes called with a bare "w" or "b"
		colors = colors.split("");
	}
	for (const color of colors) {
		const pieces = getPieces(color);
		const filtered = filterOptionMatrix(getOM(pieces));
		if (filtered === null) {
			throw new Error('Original OM is not valid');
		}
		for (let pi = 0; pi < pieces.length; pi++) {
			pieces[pi].options = filtered[pi];
		}
	}
}






function getCertainMoves(coords) {
	// Get a list of the certain move destinations. That is - the desinations that a piece can definitely move to in all of their available waves.
	
	let piece = BOARD[coords[0]][coords[1]]; // Find the source pieceID
	if (piece === null) {
		return [];
	}
	let waves = piece.waves();
	let moves;
	let thismoves;
	for (let wi=0; wi < waves.length; wi++) {
		// Loop through the waves and intersec the resulting moves
		thismoves = getPotentialMoves(coords,waves[wi]);
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

function getPotentialMoves(coords,waves) {
	// Get a list of all potential destination coordinates.
	// Optional input waves only returns destination for those passed in, otherwise use waves available to piece
	
	let piece = BOARD[coords[0]][coords[1]]; // Find the source pieceID
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
				if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
			}	
		}
	}
	
	// Pawn:
	if (waves.includes("P")) {
		newcoords = [coords[0]-direction,coords[1]]
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]] === null) {
			moves.push(newcoords)
			// if it can go 1 forward then it might be able to go 2 on its first move:
			if (piece.hasmoved == 0) {
				newcoords = [coords[0]-2*direction,coords[1]]
				if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]] === null) {
					moves.push(newcoords)
				}
			}
		}
		
		newcoords = [coords[0]-direction,coords[1]-1]
		if (isValidCoord(newcoords)) {
			if (isequal(newcoords,EPCOORDS) || BOARD[newcoords[0]][newcoords[1]]?.color == opponentColor) {
				moves.push(newcoords)
			}
		}
		newcoords = [coords[0]-direction,coords[1]+1]
		if (isValidCoord(newcoords)) {
			if (isequal(newcoords,EPCOORDS) || BOARD[newcoords[0]][newcoords[1]]?.color == opponentColor) {
				moves.push(newcoords)
			}
		}
	}
	
	// Rooks and Queens:
	if (waves.includes("R") || waves.includes("Q")) {
		for (let i=coords[0]+1; i<=7; i++) {
			newcoords = [i,coords[1]]
			if (BOARD[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
			moves.push(newcoords)
			if (BOARD[newcoords[0]][newcoords[1]] !== null) {break;}
		}
		for (let i=coords[0]-1; i>=0; i--) {
			newcoords = [i,coords[1]]
			if (BOARD[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
			moves.push(newcoords)
			if (BOARD[newcoords[0]][newcoords[1]] !== null) {break;}
		}
		for (let i=coords[1]+1; i<=7; i++) {
			newcoords = [coords[0],i]
			if (BOARD[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
			moves.push(newcoords)
			if (BOARD[newcoords[0]][newcoords[1]] !== null) {break;}
		}
		for (let i=coords[1]-1; i>=0; i--) {
			newcoords = [coords[0],i]
			if (BOARD[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
			moves.push(newcoords)
			if (BOARD[newcoords[0]][newcoords[1]] !== null) {break;}
		}
	}
	
	// Bishops and Queens:
	if (waves.includes("B") || waves.includes("Q")) {
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]+i,coords[1]+i]
			if (isValidCoord(newcoords)) {
				if (BOARD[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
				moves.push(newcoords)
				if (BOARD[newcoords[0]][newcoords[1]] !== null) {break;}
			}
		}
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]+i,coords[1]-i]
			if (isValidCoord(newcoords)) {
				if (BOARD[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
				moves.push(newcoords)
				if (BOARD[newcoords[0]][newcoords[1]] !== null) {break;}
			}
		}
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]-i,coords[1]-i]
			if (isValidCoord(newcoords)) {
				if (BOARD[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
				moves.push(newcoords)
				if (BOARD[newcoords[0]][newcoords[1]] !== null) {break;}
			}
		}
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]-i,coords[1]+i]
			if (isValidCoord(newcoords)) {
				if (BOARD[newcoords[0]][newcoords[1]]?.color == piece.color) {break;}
				moves.push(newcoords)
				if (BOARD[newcoords[0]][newcoords[1]] !== null) {break;}
			}
		}
	}
	
	// Knights:
	if (waves.includes("N")) {
		newcoords = [coords[0]+2,coords[1]+1];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]+2,coords[1]-1];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-2,coords[1]+1];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-2,coords[1]-1];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]+1,coords[1]+2];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]+1,coords[1]-2];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-1,coords[1]+2];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-1,coords[1]-2];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]]?.color != piece.color) {moves.push(newcoords)};
	}
	
	for (let i=moves.length-1; i>=0; i--) {
		if (moves[i][0]==coords[0] && moves[i][1]==coords[1]) {
			moves.splice(i,1)
		}
	}
	
	return moves
}

////////////////////////////////
// Utilities
////////////////////////////////
function coords2piece(coords) {
	return BOARD[coords[0]][coords[1]];
}
function oppColor(color) {
	if (color == undefined) {
		color = TURNCOLOR;
	}
	if (color=="w") {
		return "b";
	}
	return "w";
}
function getPieces(color) {
	if (color == "w") {
		return WHITEPIECES;
	} else {
		return BLACKPIECES;
	}
}
function defPiece(i) {
	let pieces = getPieces(oppColor());
	return pieces[i];
}
function attPiece(i) {
	let pieces = getPieces(TURNCOLOR);
	return pieces[i];
}

////////////////////////////////
// State Control
////////////////////////////////

function debugPrint(txt) {
	let debugLabel = document.getElementById("debug");
	debugLabel.innerText = txt;
}

function setState(stateIn) {
	if (stateIn == "clear" && TURNNUMBER == 0) {
		stateIn = "move0";
	}
	let prevState = STATE;
	STATE = stateIn;
	let promptlabel = document.getElementById("prompt");
	let moveTextarea = document.getElementById("thismove");
	let sideButton1 = document.getElementById("sideButton1")
	let sideButton2 = document.getElementById("sideButton2")
	let historyArea = document.getElementById("movehistory");
	if (STATE != "move0") {
		historyArea.contentEditable = false;
	}
	
	// All the changing of the actual display happens here, always by simply looping over the squares and displaying 
	// them according to the variables in the object. 
	let defaultText;
	let promptText = "";
	moveTextarea.value = THISMOVE + pcMoveText();
	if (TURNNUMBER == 0) {
		promptText = "Black<br>Move 0 - ";
	}
	if (TURNCOLOR == "w") {
		promptText = promptText + "White<br>";
	} else {
		promptText = promptText + "Black<br>";
	}

	if (AUTOCHECK) {
		promptText = promptText + " Check - ";
	}
	if (POTCHECK) {
		promptText = promptText + " Potential Check - ";
	}
	
	promptlabel.innerHTML = promptText + " select piece to move.";
	if (TURNNUMBER == 0) {
		promptlabel.innerHTML = "Black<br>Move 0 - add Potential Check?";
	}
	if (STATE == "clear") {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
		STARTCOORDS = [];
		ENDCOORDS = [];
		TAKENPIECE = null;
		if (POTCHECK) {
			sideButton1.style.visibility = "visible";
			sideButton1.innerText = "Declare 'Not a King'";
		}
	} else if (STATE == "move0") {
		sideButton2.style.visibility = "visible";
		sideButton1.style.visibility = "visible";
		sideButton1.innerText = "Add PC";
		sideButton2.innerText = "Pass to white";
		STARTCOORDS = [];
		ENDCOORDS = [];
		TAKENPIECE = null;
	} else if (STATE == "highlightPotentialMoves") {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
	} else if (STATE == "showPartialMove") {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
		promptlabel.innerHTML = promptText + "Select destination";
	} else if (STATE == "showCompleteMove") {
		sideButton2.style.visibility = "visible";
		sideButton2.innerText = "Submit";
		let nPotKings = findPotentialKingsToAttack();
		clearFindPotentialCheckPieces();
		if (nPotKings > 0) {
			promptlabel.innerHTML = promptText + "Add Potential Check / Submit";
			sideButton1.style.visibility = "visible";
			sideButton1.innerText = "Add PC";
		} else {
			promptlabel.innerHTML = promptText + "Submit";
			sideButton1.style.visibility = "hidden";
		}
	} else if (STATE == "invalidMoveIntoCheck") {
		promptlabel.innerHTML = promptText + "Invalid - moved into check";
		sideButton2.style.visibility = "visible";
		sideButton1.style.visibility = "hidden";
		sideButton2.innerText = "Cancel";
	} else if (STATE == "selectPCKing") {
		promptlabel.innerHTML = promptText + "Select King to attack";
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
	} else if (STATE == "selectPCAttackers") {
		promptlabel.innerHTML = promptText + "Select attacking pieces";
		sideButton2.style.visibility = "hidden"; // turned visible when an attacker is found in the loop below
		sideButton1.style.visibility = "hidden";
		sideButton2.innerText = "Submit";
	}
	
	// Replay Buttons
	let back2 = document.getElementById("back2");
	let back1 = document.getElementById("back1");
	let forward1 = document.getElementById("forward1");
	let forward2 = document.getElementById("forward2");
	let historyButtons = document.getElementsByClassName("historyButton");
	highlightReplayLine();
	if (REPLAYNUMBER == -1) {
		forward1.style.visibility = "hidden";
		forward2.style.visibility = "hidden";
		if (TURNNUMBER > 0) {
			back2.style.visibility = "visible";
			back1.style.visibility = "visible";
		} else {
			back2.style.visibility = "hidden";
			back1.style.visibility = "hidden";
		}
		for (let bi = 0; bi < historyButtons.length; bi++) {
			historyButtons[bi].style.visibility = "visible";
		}
	} else {
		back2.style.visibility = "visible";
		back1.style.visibility = "visible";
		forward1.style.visibility = "visible";
		forward2.style.visibility = "visible";
		
		for (let bi = 0; bi < historyButtons.length; bi++) {
			historyButtons[bi].style.visibility = "hidden";
		}
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "visible";
		sideButton1.innerText = "Resume from here";
	}
	
	// Loop over all the squares and format them according to their current state
	let checkAttackerCoords = [];
	let checkKingCoords = [];
	if (STATE != "selectPCAttackers" && STATE != "selectPCKing" && STATE != "highlightPotentialMoves" && STATE != "clear") {
		clearFindPotentialCheckPieces();
	}
	[checkKingCoords,checkAttackerCoords] = findChecks(TURNCOLOR);
	if (STATE == "selectPCAttackers") {
		// Can only get here if player is not in check. Now we want to show the PCKing selected.
		[checkKingCoords,checkAttackerCoords] = findChecks(oppColor());
	}
	
	let sqr;
	let piece;
	for (let r = 0; r <= 7; r++) {
		for ( let c = 0; c <= 7; c++) {
			sqr = SQUARES[r][c];
			piece = BOARD[r][c];
			
			if (STATE == "clear" || STATE == "move0") {
				// For other states, the propertes are set in calling functions, but you can always reset to clear by 
				// just calling setState("clear")
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
				sqr.highlightPotKing = 0;
				sqr.highlightPotAttacker = 0;
			}
			if (STATE == "showPartialMove") {
				sqr.highlighted = 0;
			}
			if (STATE == "showCompleteMove") {
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
			}
			if (STATE == "invalidMoveIntoCheck") {
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
			}
			if (STATE == "selectPCAttackers") {
				sqr.highlightPotKing = 0;
			}
			
			// Default border:
			sqr.resetButtonClasses();
			if (STATE == "clear" && REPLAYNUMBER == -1) {
				if (piece !== null && piece.color == TURNCOLOR) {
					sqr.button.classList.add("selectable");
				}
			}
			
			/* sqr.button.style.borderWidth = "";
			sqr.button.style.borderColor = "black"; 
			let sqrcolor;
			if (sqr.color=='w') {
				sqrcolor = "darkgray" // default white square colour
			} else {
				sqrcolor = "dimgray" // default black square colour
			}
			sqr.button.style.background = sqrcolor; */
			
			// Write text of pieces in sqaures:
			sqr.setWavetext(piece);

			// Change formatting if in non-default state:
			if (isequal([r,c], STARTCOORDS)) {
				// sqr.button.style.borderColor = "orange";
				// sqr.button.style.borderWidth = "6px";
				sqr.button.classList.add("selectedStart");
			}
			if (isequal([r,c], ENDCOORDS)) {
				// sqr.button.style.borderColor = "green";
				// sqr.button.style.borderWidth = "6px";
				sqr.button.classList.add("selectedEnd");
			}
			if (REPLAYNUMBER > -1) {
				// In replay, show the move that led to this position
				if (isequal([r,c], LASTSTARTCOORDS)) {
					sqr.button.classList.add("selectedStart");
				}
				if (isequal([r,c], LASTENDCOORDS)) {
					sqr.button.classList.add("selectedEnd");
				}
			}

			
			if (sqr.highlightPotKing == 1) {
				// sqr.button.style.background = 'red';
				sqr.button.classList.add("potKing");
			}
			if (sqr.highlightPotAttacker == 1) {
				// sqr.button.style.background = 'blue';
				sqr.button.classList.add("potAttacker");
			}
			
			// if they're selected then turn off the highlightPot* backgrounds
			if (AUTOCHECK || POTCHECK || STATE == "selectPCAttackers") {
				if (isequal([r,c],checkKingCoords)) {
					sqr.button.classList.remove("potKing");
					sqr.button.classList.add("checkKing");
					/* sqr.button.style.background = sqrcolor;
					sqr.button.style.borderColor = "red";
					sqr.button.style.borderWidth = "6px"; */
				}
				if (ismember([r,c],checkAttackerCoords)) {
					sqr.button.classList.remove("potAttacker");
					sqr.button.classList.add("checkAttacker");
					/* sqr.button.style.background = sqrcolor;
					sqr.button.style.borderColor = "blue";
					sqr.button.style.borderWidth = "6px"; */
					if (STATE == "selectPCAttackers") {
						sideButton2.style.visibility = "visible";
					}
				}
			}
			if (sqr.highlighted) {
				sqr.button.classList.add("hovered");
				// sqr.button.style.background = 'orange';
			}
			if (sqr.potentialMove > 0) {
				sqr.button.classList.add("destination" + sqr.potentialMove);
				// sqr.button.style.background = 'green';
			}
			if (piece !== null) {
				let waves = piece.waves();
				if (FINDPIECE != "" && waves.includes(FINDPIECE)) {
					sqr.button.classList.add("findHighlight");
					// sqr.button.style.background = 'purple';
				}
			}
		}
	}
	
	// Built list of captured pieces for display
	let whitecaptured = "<strong>White Captured</strong><br>";
	let blackcaptured = "<strong>Black Captured</strong><br>";
	let whiteorder = [];
	let blackorder = [];
	let capturedwaves = [];
	for (let i=0; i<16; i++) {
		whiteorder.push(WHITEPIECES[i].captured);
		blackorder.push(BLACKPIECES[i].captured);
	}
	for (let i=0; i <= TURNNUMBER; i++) {
		let idx = whiteorder.indexOf(i);
		if (idx > -1) {whitecaptured = whitecaptured + i + '. ' + WHITEPIECES[idx].wavesWithBishopColor() + "<br>";}
		idx = blackorder.indexOf(i);
		if (idx > -1) {blackcaptured = blackcaptured + i + '. ' + BLACKPIECES[idx].wavesWithBishopColor() + "<br>";}
	}
	
	let capturedLabel;
	capturedLabel = document.getElementById("whitecaptured");
	capturedLabel.innerHTML = whitecaptured;
	capturedLabel = document.getElementById("blackcaptured");
	capturedLabel.innerHTML = blackcaptured;
	
	// Update the findpiece buttons to display the correct piece for this color
	if (TURNCOLOR == "w") {
		document.getElementById("findKpiece").classList.remove("blackpiececollapsed");
		document.getElementById("findQpiece").classList.remove("blackpiececollapsed");
		document.getElementById("findRpiece").classList.remove("blackpiececollapsed");
		document.getElementById("findNpiece").classList.remove("blackpiececollapsed");
		document.getElementById("findBpiece").classList.remove("blackpiececollapsed");
		document.getElementById("findPpiece").classList.remove("blackpiececollapsed");
		document.getElementById("findKpiece").classList.add("whitepiececollapsed");
		document.getElementById("findQpiece").classList.add("whitepiececollapsed");
		document.getElementById("findRpiece").classList.add("whitepiececollapsed");
		document.getElementById("findNpiece").classList.add("whitepiececollapsed");
		document.getElementById("findBpiece").classList.add("whitepiececollapsed");
		document.getElementById("findPpiece").classList.add("whitepiececollapsed");
		document.getElementById("findKpiece").innerHTML = WK;
		document.getElementById("findQpiece").innerHTML = WQ;
		document.getElementById("findRpiece").innerHTML = WR;
		document.getElementById("findNpiece").innerHTML = WN;
		document.getElementById("findBpiece").innerHTML = WB;
		document.getElementById("findPpiece").innerHTML = WP;
//		for (i = 0; i < 6; i++) {
//			findbuttons[i].classList.remove("blackpiececollapsed");
//			findbuttons[i].classList.add("whitepiececollapsed");
//		}
	} else {
		document.getElementById("findKpiece").classList.remove("whitepiececollapsed");
		document.getElementById("findQpiece").classList.remove("whitepiececollapsed");
		document.getElementById("findRpiece").classList.remove("whitepiececollapsed");
		document.getElementById("findNpiece").classList.remove("whitepiececollapsed");
		document.getElementById("findBpiece").classList.remove("whitepiececollapsed");
		document.getElementById("findPpiece").classList.remove("whitepiececollapsed");
		document.getElementById("findKpiece").classList.add("blackpiececollapsed");
		document.getElementById("findQpiece").classList.add("blackpiececollapsed");
		document.getElementById("findRpiece").classList.add("blackpiececollapsed");
		document.getElementById("findNpiece").classList.add("blackpiececollapsed");
		document.getElementById("findBpiece").classList.add("blackpiececollapsed");
		document.getElementById("findPpiece").classList.add("blackpiececollapsed");
		document.getElementById("findKpiece").innerHTML = BK;
		document.getElementById("findQpiece").innerHTML = BQ;
		document.getElementById("findRpiece").innerHTML = BR;
		document.getElementById("findNpiece").innerHTML = BN;
		document.getElementById("findBpiece").innerHTML = BB;
		document.getElementById("findPpiece").innerHTML = BP;
//		for (i = 0; i < 6; i++) {
//			findbuttons[i].classList.add("blackpiececollapsed");
//			findbuttons[i].classList.remove("whitepiececollapsed");
//		}
	}
}

function highlightReplayLine() {
	let historyArea = document.getElementById("movehistory");
	let historyHTML = historyArea.innerHTML;
	
	let lineStyle = "<span style=\"background-color:lightgrey\">";
	historyHTML = historyHTML.replaceAll(lineStyle,"");
	historyHTML = historyHTML.replaceAll("</span>","");
	let historyLines = historyHTML.split("<br>");
	if (REPLAYNUMBER > -1) {
		historyLines[REPLAYNUMBER*2-1] = lineStyle + historyLines[REPLAYNUMBER*2-1] + "</span>";
	}
	historyArea.innerHTML = historyLines.join("<br>");
}

function setup() {
	TURNNUMBER = 0;
	TURNCOLOR = "b";
	TAKENPIECE = null;
	BOARD = []; // 8 x 8 array: the Piece on each square, or null if empty
	SQUARES = []; // 8 x 8 array of SquareView objects (the page's buttons)
	STARTCOORDS = [];
	ENDCOORDS = [];
	LASTSTARTCOORDS = [];
	LASTENDCOORDS = [];
	WHITEPIECES = [];
	BLACKPIECES = [];
	MOVEHISTORY = "";
	THISMOVE = "0b. ";
	EPCOORDS = [];
	EPCOLOR = "";
	AUTOCHECK = false;
	POTCHECK = false;
	PCKING = -1; // piece idx which is selected as potential check king
	PCCOLOR = ""; // the color of the king in potential check
	FINDPIECE = "";
	
	let moveTextarea = document.getElementById("thismove");
	moveTextarea.value = "";
	if (REPLAYNUMBER == -1) {
		let historyArea = document.getElementById("movehistory");
		historyArea.innerText = "";
		historyArea.contentEditable = true;
	}
	
	
	for (let r = 0; r <= 7; r++) {
		BOARD.push(Array(8).fill(null));
		let viewRow = [];
		for (let c = 0; c <= 7; c++) {
			viewRow.push(new SquareView(r, c, document.getElementById("square" + r + c)));
		}
		SQUARES.push(viewRow);
	}
	for (let r = 0; r <= 1; r++) {
		for (let c=0; c <= 7; c++) {
			let i = r*8 + c
			let piece = new Piece(i, r, c, 'b')
			BLACKPIECES.push(piece)
			BOARD[r][c] = BLACKPIECES[i]
		}
	}for (let r = 6; r <= 7; r++) {
		for (let c=0; c <= 7; c++) {
			let i = (r-6)*8 + c
			let piece = new Piece(i, r, c, 'w')
			WHITEPIECES.push(piece)
			BOARD[r][c] = WHITEPIECES[i]
		}
	}
	setState("move0");
}

////////////////////////////////
// Initialisation
////////////////////////////////
let TURNNUMBER;
let TURNCOLOR;
let TAKENPIECE; // the Piece captured by the move being made, or null
let BOARD; // 8 x 8 array: the Piece on each square, or null if empty
let SQUARES; // 8 x 8 array of SquareView objects (the page's buttons)
let STARTCOORDS; // [r,c] of the move being made, or [] if none
let ENDCOORDS;
let LASTSTARTCOORDS; // start square of the last submitted move, for replay highlighting
let LASTENDCOORDS;   // end square of the last submitted move
let WHITEPIECES;
let BLACKPIECES;
let MOVEHISTORY;
let THISMOVE;
let EPCOORDS;
let EPCOLOR;
let AUTOCHECK;
let POTCHECK;
let PCKING;
let PCCOLOR;
let FINDPIECE;
let STATE;
let REPLAYNUMBER = -1;

////////////////////////////////
// Exports
////////////////////////////////
export {
	// Used by src/client/main.js to wire up the page
	setup,
	sideButton1Click,
	sideButton2Click,
	toggleFlippedBoard,
	findPiecesClick,
	stepBackAll,
	stepBackMove,
	stepForwardMove,
	stepForwardAll,
	restoreGameHistory,
	copyAllHistory,
	copyLastMove,
	pasteAllRestore,
	pasteLineRestore,

	// Used by tests/test.html and tests/generate.html to drive and inspect the game.
	// These go away as the game state moves into a proper state object.
	sideButton1Action,
	sideButton2Action,
	getHistoryLines,
	doMoveFromText,
	showPartialMove,
	showCompleteMove,
	selectPCKing,
	selectPCAttackers,
	getPotentialMoves,
	TURNNUMBER,
	TURNCOLOR,
	BOARD,
	SQUARES,
	WHITEPIECES,
	BLACKPIECES,
	MOVEHISTORY,
	EPCOORDS,
	EPCOLOR,
	AUTOCHECK,
	POTCHECK,
	PCKING,
	PCCOLOR,
	STATE,
};




