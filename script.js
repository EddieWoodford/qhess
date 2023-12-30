// Classes
class Square {
    constructor(r, c, buttonID) {
        this.r = r;
        this.c = c;
		this.piece = "";
		this.highlighted = 0;
		this.potentialMove = 0;
		this.highlightPotKing = 0; // 0 = not a PK; 1 = candidate for PK; 
		this.highlightPotAttacker = 0; // 0 = not a PA; 1 = candidate for PA;
		
		let x = r+c;
		if (x%2 == 0) {
			this.color = 'w';
		} else {
			this.color = 'b';
		}
		this.chesscoords = String.fromCharCode(c+97) + (8-r);
		
        this.button = document.getElementById(buttonID);
        this.button.onmouseenter = () => {
			if (getState() == "clear") {
				highlightPotentialMoves(buttonID);
			}
        }
		this.button.onmouseleave = () => {
			if (getState() == "highlightPotentialMoves") {
				setState("clear");
			}
        }
		this.button.onclick = () => {
			
			if (getState() == "highlightPotentialMoves") {
				showPartialMove(buttonID);
			} else if (getState() == "showPartialMove") {
				showCompleteMove(buttonID);
			} else if (getState() == "selectPCKing") {
				selectPCKing(buttonID);
			} else if (getState() == "selectPCAttackers") {
				selectPCAttackers(buttonID);
			} else {
				restoreGameHistory();
				setState("clear");
			}
		}
		// this.button.addEventListener("click",this.set(buttonID))
		// this.button.addEventListener("mouseout",this.clear(buttonID))
    }
	setWavetext() {
		let wavetext;
		let waves;
		if (this.piece == "") {
			wavetext = "";
		} else {
			
			wavetext = "";
			waves = this.piece.waves();
			let allwaves = "KQRBNP";
			for (let i=0; i<6; i++) {
				if (waves.includes(allwaves[i])) {
					wavetext = wavetext + allwaves[i];
				} else {
					wavetext = wavetext + "empty";
				}
				if (i==2) {wavetext = wavetext + "<br>"};
			}
			
			if (this.piece.color == "w") {
				if (waves.length==1) {
					wavetext = waves;
					wavetext = wavetext.replace (/^/, '<div class="whitepiececollapsed">');
				} else {
					wavetext = wavetext.replace (/^/, '<div class="whitepiece">');
				}
				wavetext = wavetext.replace (/$/, '</div>');
				// Need to be careful with the strings used in WB, WK, etc to ensure they don't contain any of the waves
				// "KWRBNP" as then this method of replacing the text would replace unintentional chars.
				wavetext = wavetext.replace("B",WB);
				wavetext = wavetext.replace("K",WK);
				wavetext = wavetext.replace("Q",WQ);
				wavetext = wavetext.replace("R",WR);
				wavetext = wavetext.replace("N",WN);
				wavetext = wavetext.replace("P",WP);
				wavetext = wavetext.replaceAll("empty","&nbsp;");
			} else {
				if (waves.length==1) {
					wavetext = waves;
					wavetext = wavetext.replace (/^/, '<div class="blackpiececollapsed">');
				} else {
					wavetext = wavetext.replace (/^/, '<div class="blackpiece">');
				}
				wavetext = wavetext.replace (/$/, '</div>');
				wavetext = wavetext.replace("B",BB);
				wavetext = wavetext.replace("K",BK);
				wavetext = wavetext.replace("Q",BQ);
				wavetext = wavetext.replace("R",BR);
				wavetext = wavetext.replace("N",BN);
				wavetext = wavetext.replace("P",BP);
				wavetext = wavetext.replaceAll("empty","&nbsp;");
			}
		}
		this.button.innerHTML = wavetext;
	}
    reset() {
        this.button.innerText = "";
    }
}

class Piece {
	constructor(i, r, c, color) {
		this.i = i; // 1-16, to identify each piece uniquely from starting position
		this.r = r; // row
		this.c = c; // column
		this.color = color;
		this.captured = 0; // boolean for whether this piece is captured
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
}



function sideButton1Click() {
	if (getState() == "showCompleteMove") {
		findPotentialKingsToAttack();
		setState("selectPCKing");
	} else if (getState() == "clear" && POTCHECK) {
		declareNotAKing();
	}
}

function sideButton2Click() {
	if (getState() == "showCompleteMove" || getState() == "selectPCAttackers") {
		submitMove();
		setState("clear");
	} else if (getState() == "invalidMoveIntoCheck") {
		restoreGameHistory();
		setState("clear");
	}
}

function declareNotAKing() {
	let defKing = attPiece(PCKING);
	// THISMOVE = "[(" + defKing.waves() + ")" + BOARD[defKing.r][defKing.c].chesscoords;
	defKing.removewaves("K");
	// THISMOVE = THISMOVE + "(" + defKing.waves() + ")]";
	THISMOVE = THISMOVE + "[" + BOARD[defKing.r][defKing.c].chesscoords + "]";
	updateOptionsFromEntanglement(TURNCOLOR);
	PCKING = 0; 
	PCATTACKERS = [];
	PCCOLOR = "";
	clearFindPotentialCheckPieces();
	findChecks(TURNCOLOR);
	setState("clear");
}

function submitMove() {
	// Here after clicking sideButton1 when a valid move is chosen
		
	// Update move history label:
	// The move annotation itself is constructed in showCompleteMove(), but if there is a Potential Check declared,
	// then the contents of the <> in the move annotation is done here
	if (PCCOLOR == TURNCOLOR) {
		// Must have gotten out of potential check
		PCKING = 0;
		PCATTACKERS = [];
		PCCOLOR = "";
	}
	if (PCKING > 0) {
		THISMOVE = THISMOVE + "<";
		let piece;
		for (let ai=0; ai < PCATTACKERS.length; ai++) {
			piece = attPiece(PCATTACKERS[ai]);
			THISMOVE = THISMOVE + BOARD[piece.r][piece.c].chesscoords + " ";
		}
		piece = defPiece(PCKING);
		THISMOVE = THISMOVE + BOARD[piece.r][piece.c].chesscoords + ">";
	}
	MOVEHISTORY = MOVEHISTORY + TURNNUMBER.toString() + ". " + THISMOVE + "\r\n";
	THISMOVE = "";
	historyArea = document.getElementById("movehistory");
	historyArea.value = MOVEHISTORY;
		
	TAKENPIECE.captured = 1;
	
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
	clearFindPotentialCheckPieces();
	findChecks(TURNCOLOR);
}

function findPiecesHover(wave) {
	if (getState() != "clear") {
		return;
	}
	let pieces;
	if (TURNCOLOR == "w") {
		pieces = WHITEPIECES;
	} else {
		pieces = BLACKPIECES;
	}
	
	for (let i=0; i<16; i++) {
		if (pieces[i].captured==0) {
			if (pieces[i].waves().includes(wave)) {
				BOARD[pieces[i].r][pieces[i].c].highlighted = 1;
			}
		}
	}
	setState("findPieces");
}

function restoreGameHistory(historyText) {
	// Restore a game from whatever history is in the move history textbox
	let historyArea = document.getElementById("movehistory");
	if (historyText == undefined) {
		historyText = historyArea.value;
	} else {
		historyArea.value = historyText;
	}
	let lines = historyText.split("\n");
	let moveText;
	let r;
	let c;
	let doEP; // do En Passant
	let doPromotion; // do Pawn Promotion
	setup();
	for (let i=0; i < lines.length; i++) {
		moveText = lines[i];
		if (moveText != "") {
			doEP = (moveText.includes("e.p."));
			doPromotion = (moveText.includes("="));
			let pcText = "";
			if (moveText.includes("]")) {
				moveText = moveText.split("]");
				moveText = moveText[1];
				sideButton1Click(); // declare Not A King
			}
			if (moveText.includes("<")) {
				moveText = moveText.split(">");
				moveText = moveText[0].split("<");
				pcText = moveText[1].split(" ");
				moveText = moveText[0];
			}
			moveText = moveText.split(")");
			moveText = moveText[1].split("(");
			moveText = moveText[0].replace("x","");
			// Now moveText should be 4 chars long, such as h2h3, indicating the from-to coordinates
			[r,c] = coordstext2coords(moveText.substring(0,2));
			let startButtonID = coords2buttonID([r,c]);
			[r,c] = coordstext2coords(moveText.substring(2,4));
			let endButtonID = coords2buttonID([r,c]);
			showPartialMove(startButtonID);
			showCompleteMove(endButtonID,doEP,doPromotion);
			
			if (pcText.length > 0) {
				sideButton1Click(); // "Add Potential Check" button
				[r,c] = coordstext2coords(pcText[pcText.length-1]);
				let kingButtonID = coords2buttonID([r,c]);
				selectPCKing(kingButtonID);
				let attackerButtonID;
				for (pci=0; pci<pcText.length-1; pci++) {
					[r,c] = coordstext2coords(pcText[pci]);
					let attackerButtonID = coords2buttonID([r,c]);
					selectPCAttackers(attackerButtonID);
				}
			}
			sideButton2Click(); // submit
		}
	}
}

function copyHistory() {
	let historyArea = document.getElementById("movehistory");
	let historyText = historyArea.value;
	navigator.clipboard.writeText(historyText);
}

function pasteRestore() {
	let historyArea = document.getElementById("movehistory");
	historyArea.value = "";
	navigator.clipboard.readText().then((clipText) => (restoreGameHistory(clipText)));
	
}

function clearFindPieces() {
	if (getState() == "findPieces") {
		setState("clear");
	}
}

function highlightPotentialMoves(buttonID) {
	// Highlight potential moves temporarily while mouse is over square
	let coords = buttonID2coords(buttonID);
	if (BOARD[coords[0]][coords[1]].piece=="") {return;}
	if (BOARD[coords[0]][coords[1]].piece.color == TURNCOLOR) {
		BOARD[coords[0]][coords[1]].highlighted = 1;

		let moves = getPotentialMoves(coords);
		for (let i=0; i < moves.length; i++) {
			BOARD[moves[i][0]][moves[i][1]].potentialMove = 1;
		}
		setState("highlightPotentialMoves");
	}
}

function findPotentialKingsToAttack() {
	// FInd all candidate kings for potential check
	let pieces = getPieces(TURNCOLOR);
	let piece;
	let moves;
	
	for (let r=0; r<8; r++) {
		for (let c=0; c<8; c++) {
			if (BOARD[r][c].piece == "") {continue};
			if (BOARD[r][c].piece.color == TURNCOLOR) {continue};
			if (!BOARD[r][c].piece.waves().includes("K")) {continue};
			// Now we know the square has an opponent king-wave on it
			// If the square is being attacked by any piece then it is a valid candidate for a PC King, and then we want to
			// highlight it.
			for (let pi=0; pi < pieces.length; pi++) {
				piece = pieces[pi];
				moves = getPotentialMoves([piece.r,piece.c]);
				if (ismember([r,c],moves)) {
					BOARD[r][c].highlightPotKing = 1;
				}
			}
		}
	}
}

function findPCAttackers() {
	// Now a potential check king has been selected, so highlight the potential attacking pieces
	// Also called after every new PC attacker is selected, in case that selection collapses waves and changes
	// the remaining candidates
	
	let attackPieces = getPieces(TURNCOLOR);
	let piece;
	let moves;
	let defKing = defPiece(PCKING);
	
	for (let pi=0; pi < attackPieces.length; pi++) {
		piece = attackPieces[pi];
		if (PCATTACKERS.includes(pi)) {
			// already selected as an attacker, so not to be highlighted
			BOARD[piece.r][piece.c].highlightPotAttacker = 0;
			continue;
		}
		moves = getPotentialMoves(piece.coords());
		if (ismember(defKing.coords(),moves)) { 
			BOARD[piece.r][piece.c].highlightPotAttacker = 1;
		} else {
			BOARD[piece.r][piece.c].highlightPotAttacker = 0;
		}
	}
}

function clearFindPotentialCheckPieces() {
	for (let r=0; r<8; r++) {
		for (let c=0; c<8; c++) {
			BOARD[r][c].highlightPotKing = 0;
			BOARD[r][c].highlightPotAttacker = 0;
		}
	}
}

function selectPCKing(buttonID) {
	// Get here after clicking on a square in "selectPCKing" state
	let kingCoords = buttonID2coords(buttonID);
	if (BOARD[kingCoords[0]][kingCoords[1]].highlightPotKing == 0) {
		restoreGameHistory();
		setState("clear");
		return
	}
	clearFindPotentialCheckPieces(); // stop highlighting the potential kings
	
	// Make this piece the PC King
	PCKING = BOARD[kingCoords[0]][kingCoords[1]].piece.i;
	PCATTACKERS = [];
	PCCOLOR = BOARD[kingCoords[0]][kingCoords[1]].piece.color;
	findPCAttackers();
	setState("selectPCAttackers");
}

function selectPCAttackers(buttonID) {
	// Get here when a PC attacker is selected by clicking on its square
	
	let attackerCoords = buttonID2coords(buttonID);
	if (BOARD[attackerCoords[0]][attackerCoords[1]].highlightPotAttacker == 0) {
		restoreGameHistory();
		setState("clear");
		return
	}
	let piece = BOARD[attackerCoords[0]][attackerCoords[1]].piece;
	PCATTACKERS.push(piece.i);
	BOARD[attackerCoords[0]][attackerCoords[1]].highlightPotAttacker = 0;
	
	let defKing = defPiece(PCKING);
	piece.updateOptionsByDest(defKing.coords());
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

function showPartialMove(buttonID) {
	// Show potential moves after clicking on start location
	let coords = buttonID2coords(buttonID);
	let piece = coords2piece(coords);
	if (piece.color == TURNCOLOR) {
		
		STARTID = buttonID;
		let moves = getPotentialMoves(coords);
		for (let i=0; i<moves.length; i++) {
			BOARD[moves[i][0]][moves[i][1]].potentialMove = 1;
		}
		setState("showPartialMove");
	}
}

function showCompleteMove(buttonID,doEP,doPromotion) {
	// Input doEP (do en passant) is optional and typically empty, except for when restoring a move history
	
	// After clicking on destination:
	let startCoords = buttonID2coords(STARTID);
	let validDestinations = getPotentialMoves(startCoords);
	let endCoords = buttonID2coords(buttonID)
	if (!ismember(endCoords,validDestinations)) {
		setState("clear");
		return;
	}
	movingPiece = BOARD[startCoords[0]][startCoords[1]].piece;
	THISMOVE = THISMOVE + "(" + movingPiece.waves() + ")" + BOARD[startCoords[0]][startCoords[1]].chesscoords;
	
	// Remove the options from this piece based on movement:
	movingPiece.updateOptionsByDest(endCoords);
	
	
	movingPiece.hasmoved = 1;
	movingPiece.r = endCoords[0];
	movingPiece.c = endCoords[1];
	
	// Move the piece:
	ENDID = buttonID;
	TAKENPIECE = BOARD[endCoords[0]][endCoords[1]].piece;
	if (TAKENPIECE != "") {
		TAKENPIECE.captured = 1;
		TAKENPIECE.removewaves('K');
		THISMOVE = THISMOVE + "x";
	}
	BOARD[endCoords[0]][endCoords[1]].piece = movingPiece;
	BOARD[startCoords[0]][startCoords[1]].piece = "";
	
	
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
			TAKENPIECE = BOARD[endCoords[0]+direction][endCoords[1]].piece;
			TAKENPIECE.captured = 1;
			TAKENPIECE.removewaves("KQNRB");
			BOARD[endCoords[0]+direction][endCoords[1]].piece = "";
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
		THISMOVE = THISMOVE + BOARD[endCoords[0]][endCoords[1]].chesscoords + "(" + movingPiece.waves() + ")";
		THISMOVE = THISMOVE + " e.p.";
	} else if (doPromotion) {
		THISMOVE = THISMOVE + BOARD[endCoords[0]][endCoords[1]].chesscoords + "(P)";
		THISMOVE = THISMOVE + "=(QRNB)";
	} else {
		THISMOVE = THISMOVE + BOARD[endCoords[0]][endCoords[1]].chesscoords + "(" + movingPiece.waves() + ")"
	}
	
	// Now, look to see if attacker has put themselves in automatic check. If so, it's an invalid move
	clearFindPotentialCheckPieces();
	[kingCoords,attackerCoords] = findChecks(TURNCOLOR);
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

function findChecks(color) {
	// Search to see if a check exists. 
	// Should be called whenever the board state changes and is potentially in a valid move position
	// color is the color of the king to check for check. What a great sentance.
	
	// First look for Auto Check:
	let defPieces = getPieces(color);
	let attPieces = getPieces(oppColor(color));
	let kingCoords = [];
	for (let pi=0; pi < defPieces.length; pi++) {
		if (defPieces[pi].waves() == "K") {
			kingCoords = [defPieces[pi].r,defPieces[pi].c];
			break;
		}
	} 
	let attackerCoords = [];
	if (kingCoords.length > 0) {
		// There is a collapsed king, so look for auto check
		let moveCoords;
		for (let pi=0; pi < attPieces.length; pi++) {
			pieceCoords = [attPieces[pi].r,attPieces[pi].c];
			moveCoords = getPotentialMoves(pieceCoords);
			if (ismember(kingCoords,moveCoords)) {
				attackerCoords.push(pieceCoords);
			}
		}
		if (attackerCoords.length > 0) {
			AUTOCHECK = true;
		} else {
			// For auto check, only return anything if there are attackers
			AUTOCHECK = false;
			return [[],[]];
		}
		return [kingCoords,attackerCoords];
	} else {

		// If no auto check, then check if the defender of potential check has moved the potential king out of the way ...
		// of the potential attackers.
		if (PCKING == 0) {
			POTCHECK = false;
			return [[],[]];
		}
		if (PCCOLOR != color) {
			return [[],[]];
		}
		let defKing = defPieces[PCKING];
		if (!defKing.waves().includes("K")) {
			POTCHECK = false;
			return [[],[]];
		}
		kingCoords = [defKing.r,defKing.c];
		let pi = 0;
		let attacker;
		let moveCoords;
		for (let pi=0; pi < 16; pi++) {
			// Loop through the attacking pieces and see if it is unambiguously attacking the potential king.
			attacker = attPieces[pi];
			moveCoords = getCertainMoves([attacker.r,attacker.c]);
			if (ismember(kingCoords,moveCoords)) {
				attackerCoords.push(attacker.coords());
			}
		}
		if (attackerCoords.length==0) {
			POTCHECK = false;
		} else {
			POTCHECK = true;
		}
		// even if no attackers exist, still return the kingCoords
		return [kingCoords,attackerCoords];
		
	}
}

function updateOptionsFromFullCollapse(colors) {
	// Loop through the pieces. Continue until the set isn't changed after a pass.
	// If a piece only has one waveform, assign it to a specific option, and remove that option from all other pieces
	let pieces;
	let i;
	let piece;
	if (colors == undefined) {
		colors = ["w","b"];
	}
	for (color of colors) {	
		pieces = getPieces(color);
		i = 0;
		while (i < 16) {
			piece = pieces[i];
			if (piece.fullcollapsed == 1) {
				i = i+1;
				continue;
			}
			if (piece.promoted == 1) {
				i = i+1;
				continue;
			}
			// If a piece only has one waveform, assign it to a specific option, 
			// and remove that option from all other pieces:
			let waves = piece.waves();
			if (waves.length == 1) {
				let optidxs = wave2optidxs(waves);
				for (oi = 0; oi < optidxs.length; oi++) {
					if (piece.options[optidxs[oi]] == 1) {
						break;
					}
				}
				// Now optidxs[oi] is the option index to set for this piece and remove for all others
				// Loop through other pieces:
				for (j = 0; j < 16; j++) {
					if (j==i) {
						pieces[j].options = Array(16).fill(0);
						pieces[j].options[optidxs[oi]] = 1;	
					} else {
						pieces[j].options[optidxs[oi]] = 0;
					}
				}
				piece.fullcollapsed = 1;
				i = 0; // start the loop again
			} else {
				i = i+1;
			}
		}
	}
}

function updateOptionsFromEntanglement(colors) {
	
	let OM_original;
	let OM;
	let pieceIdx;
	let optionIdx;
	let matchingCols;
	let matchingRows;
	let rowsDone;
	let colsDone;
	let OM_before;
	let result;
	
	
	if (colors == undefined) {
		colors = ["w","b"];
	}
	updateOptionsFromFullCollapse(colors);
	for (color of colors) {	
		pieces = getPieces(color);
		OM_original = getOM(pieces);
		OM = clone2DArray(OM_original);

		if (isValid(OM)) {
			pieceIdx = -1;
			rowsDone = Array(16).fill(false);
			OM_before = clone2DArray(OM);

			while (pieceIdx < 15) { // <15 here since we increment at start of loop
				pieceIdx++;

				if (rowsDone[pieceIdx]) {
					continue;
				}

				matchingRows = Array(16).fill(false);

				for (let ri = pieceIdx; ri < 16; ri++) {
					if (isequal(OM[pieceIdx], OM[ri])) {
						matchingRows[ri] = true;
					}
				}

				colsDone = Array(16).fill(false);

				for (optionIdx = 0; optionIdx < 16; optionIdx++) {
					matchingCols = Array(16).fill(false);

					if (colsDone[optionIdx]) {
						continue;
					}

					for (let ci = optionIdx; ci < 16; ci++) {
						if (isequal(getcolumn(OM, optionIdx), getcolumn(OM, ci))) {
							matchingCols[ci] = true;
						}
					}

					if (OM[pieceIdx][optionIdx] === 1) {
						// imagine that this piece is moved so that only this option remains
						let OM_reduced = clone2DArray(OM);
						OM_reduced.splice(pieceIdx, 1);
						OM_reduced.forEach(row => row.splice(optionIdx, 1));

						// Sort 1's into bottom right corner. This speeds things up significantly in testing
						let sum1 = colsum(OM_reduced);
						let sum2 = rowsum(OM_reduced);
						OM_reduced = sortcols(OM_reduced,sum1);
						OM_reduced = sortrows(OM_reduced,sum2);

						result = isValid(OM_reduced);

						if (!result) {
							setvalue(OM[pieceIdx],matchingCols,0);
						}
					}
					setvalue(colsDone,matchingCols,true);
				}
				for (let ri = pieceIdx; ri < 16; ri++) {
					if (matchingRows[ri]) {
						OM[ri] = [...OM[pieceIdx]];
						pieces[ri].options = [...OM[pieceIdx]];
						rowsDone[ri] = true;
					}
				}

				if (!isequal(OM_before[pieceIdx], OM[pieceIdx])) {
					// Something has changed, so start the process again as that change may induce new collapses
					pieceIdx = -1;
					rowsDone = Array(16).fill(false);
					updateOptionsFromFullCollapse(color);
					OM_before = clone2DArray(OM);
				}
			}

		} else {
			throw new Error('Original OM is not valid');
		}
	}
}

function getOM(pieces) {
	let OM = [];
	for (let pi=0; pi < pieces.length; pi++) {
		OM.push(pieces[pi].options);
	}
	return OM;
}

function isValid(OM) {
	// Check if the Option Matrix (OM) is valid - it contains an arrangement which would result in a full chess demographic. That's equivalent to saying that the bipartite graph indicated by the OM has a perfect matching, or that each row can be assigned to exactly 1 column with a 1 in entry (row,col).
	
    const sz = [OM.length, OM[0].length];
	
    if (sz[0] != sz[1]) {
        throw new Error('OM should be square');
    }

    if (sz[0] === 1) {
        let result = +(OM==1);
        matching = [1];
        return result;
    }

    const sum1 = colsum(OM);
    if (sum1.some(val => val === 0)) {
        return false;
    }

    const sum2 = rowsum(OM);
    if (sum2.some(val => val === 0)) {
        return false;
    }

    let done = new Array(sz[0]).fill(false);
	let matchingRows;
	let OM2;
	for (let i=0; i < OM.length; i++) {
        if (done[i]) {
            continue;
        }

        matchingRows = new Array(sz[0]).fill(false);
        for (let ri = i; ri < sz[0]; ri++) {
            if (OM[ri].every((val, idx) => val === OM[i][idx])) {
                matchingRows[ri] = true;
            }
        }

        if (OM[i][0] === 1) {
            OM2 = OM.map(row => row.slice(1)); // delete 1st col
            OM2.splice(i, 1); // delete ith row
            if (isValid(OM2)) {
                return true;
            }
        }
		setvalue(done,matchingRows,true);
		
    }
	// If we make it here then none of the rows gave a valid result, so return false
    return false;
}

function getCertainMoves(coords) {
	// Get a list of the certain move destinations. That is - the desinations that a piece can definitely move to in all of their available waves.
	
	let piece = BOARD[coords[0]][coords[1]].piece; // Find the source pieceID
	if (piece=="") {
		return [];
	}
	let waves = piece.waves();
	let moves;
	let thismoves;
	for (wi=0; wi < waves.length; wi++) {
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
	
	let piece = BOARD[coords[0]][coords[1]].piece; // Find the source pieceID
	if (piece=="") {
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
				if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
			}	
		}
	}
	
	// Pawn:
	if (waves.includes("P")) {
		newcoords = [coords[0]-direction,coords[1]]
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece=="") {
			moves.push(newcoords)
			// if it can go 1 forward then it might be able to go 2 on its first move:
			if (piece.hasmoved == 0) {
				newcoords = [coords[0]-2*direction,coords[1]]
				if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece=="") {
					moves.push(newcoords)
				}
			}
		}
		
		newcoords = [coords[0]-direction,coords[1]-1]
		if (isValidCoord(newcoords)) {
			if (isequal(newcoords,EPCOORDS) || BOARD[newcoords[0]][newcoords[1]].piece.color == opponentColor) {
				moves.push(newcoords)
			}
		}
		newcoords = [coords[0]-direction,coords[1]+1]
		if (isValidCoord(newcoords)) {
			if (isequal(newcoords,EPCOORDS) || BOARD[newcoords[0]][newcoords[1]].piece.color == opponentColor) {
				moves.push(newcoords)
			}
		}
	}
	
	// Rooks and Queens:
	if (waves.includes("R") || waves.includes("Q")) {
		for (let i=coords[0]+1; i<=7; i++) {
			newcoords = [i,coords[1]]
			if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
			moves.push(newcoords)
			if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
		}
		for (let i=coords[0]-1; i>=0; i--) {
			newcoords = [i,coords[1]]
			if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
			moves.push(newcoords)
			if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
		}
		for (let i=coords[1]+1; i<=7; i++) {
			newcoords = [coords[0],i]
			if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
			moves.push(newcoords)
			if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
		}
		for (let i=coords[1]-1; i>=0; i--) {
			newcoords = [coords[0],i]
			if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
			moves.push(newcoords)
			if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
		}
	}
	
	// Bishops and Queens:
	if (waves.includes("B") || waves.includes("Q")) {
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]+i,coords[1]+i]
			if (isValidCoord(newcoords)) {
				if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
				moves.push(newcoords)
				if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
			}
		}
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]+i,coords[1]-i]
			if (isValidCoord(newcoords)) {
				if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
				moves.push(newcoords)
				if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
			}
		}
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]-i,coords[1]-i]
			if (isValidCoord(newcoords)) {
				if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
				moves.push(newcoords)
				if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
			}
		}
		for (let i=1; i<=7; i++) {
			newcoords = [coords[0]-i,coords[1]+i]
			if (isValidCoord(newcoords)) {
				if (BOARD[newcoords[0]][newcoords[1]].piece.color == piece.color) {break;}
				moves.push(newcoords)
				if (BOARD[newcoords[0]][newcoords[1]].piece!="") {break;}
			}
		}
	}
	
	// Knights:
	if (waves.includes("N")) {
		newcoords = [coords[0]+2,coords[1]+1];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]+2,coords[1]-1];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-2,coords[1]+1];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-2,coords[1]-1];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]+1,coords[1]+2];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]+1,coords[1]-2];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-1,coords[1]+2];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
		newcoords = [coords[0]-1,coords[1]-2];
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color != piece.color) {moves.push(newcoords)};
	}
	
	for (let i=moves.length-1; i>=0; i--) {
		if (moves[i][0]==coords[0] && moves[i][1]==coords[1]) {
			moves.splice(i,1)
		}
	}
	
	return moves
}

// Utilities
function setvalue(arr,filter,val) {
	for (let i=0; i < filter.length; i++) {
		if (filter[i]) {
			arr[i] = val;
		}
	}
}
function isequal(arr1, arr2) {
    if (arr1.length !== arr2.length) {
        return false;
    }
	for (let i=0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}
function clone2DArray(arr) {
    return arr.map(row => [...row]);
}
function buttonID2coords(buttonID) {
	return [+buttonID.substr(6,1),+buttonID.substr(7,2)]
}
function coords2piece(coords) {
	return BOARD[coords[0]][coords[1]].piece;
}
function coords2buttonID(coords) {
	return "square"+coords[0]+coords[1]
}
function coordstext2coords(coordstext) {
	c = coordstext[0].charCodeAt()-97;
	r = 8-coordstext[1];
	return [r,c];
}
function isValidCoord(coords) {
	return coords[0] >= 0 && coords[0] <= 7 && coords[1] >= 0 && coords[1] <= 7
}
function ismember(coords,coordlist) {
	for (let i=0; i < coordlist.length; i++) {
		if (coords[0] == coordlist[i][0] && coords[1] == coordlist[i][1]) {
			return 1
		}
	}
	return 0
}
function sum(x) {
	return x.reduce((a, b) => a + b, 0)
}
function getcolumn(matrix, col) {
    return matrix.map(row => row[col]);
}
function colsum(M) {
	return M.reduce((x, a) => x.map((b, i) => a[i] + b));
}
function rowsum(M) {
	return M.map(y => y.reduce((a, b) => a+b));
}
function sortcols(M,ref) {
	// Sort ref and then sort the cols of M the same way
	idxs = Array.from(ref.keys()).sort((a,b) => ref[a]-ref[b])
	for (let i=0; i < M.length; i++) {
		M[i] = idxs.map(j => M[i][j])
	}
	return M
}
function sortrows(M,ref) {
	// Sort ref and then sort the rows of M the same way
	idxs = Array.from(ref.keys()).sort((a,b) => ref[a]-ref[b])
	M = idxs.map(j => M[j])
	return M
}
function wave2optidxs(wave) {
	// P1,P2,P3,P4,P5,P6,P7,P8,R1,R2,N1,N2,Bb,Bw,Q, K
	// 0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
	if (wave=="P") {
		return [0,1,2,3,4,5,6,7];
	}
	if (wave == "R") {
		return [8,9];
	}
	if (wave == "N") {
		return [10,11];
	}
	if (wave == "B") {
		return [12,13];
	}
	if (wave == "Q") {
		return [14];
	}
	if (wave=="K") {
		return [15]
	}
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

 // State Control
function getState() {
	statelabel = document.getElementById("state");
	return statelabel.innerText;
}

function setState(state) {
	statelabel = document.getElementById("state");
	prevState = statelabel.innerText;
	statelabel.innerText = state;
	promptlabel = document.getElementById("prompt");
	sideButton1 = document.getElementById("sideButton1")
	sideButton2 = document.getElementById("sideButton2")
	
	// All the changing of the actual display happens here, always by simply looping over the squares and displaying 
	// them according to the variables in the object. 
	let defaultText;
	let moveText = "<br>";
	if (THISMOVE.length > 0) {
		moveText = "Staged move: " + THISMOVE + "<br>";
	}
	if (TURNCOLOR == "w") {
		defaultText = "White -";
	} else {
		defaultText = "Black -";
	}

	if (AUTOCHECK) {
		defaultText = defaultText + " Check -";
	}
	if (POTCHECK) {
		defaultText = defaultText + " Potential Check -";
	}
	defaultText = defaultText + " select piece to move";
	
	if (state == "clear") {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
		promptlabel.innerHTML = moveText + defaultText;
		STARTID = "";
		ENDID = "";
		TAKENPIECE = "";
		if (POTCHECK) {
			sideButton1.style.visibility = "visible";
			sideButton1.innerText = "Declare 'Not a King'";
		}
		
	} else if (state == "highlightPotentialMoves") {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
		promptlabel.innerHTML = moveText + defaultText;
	} else if (state == "showPartialMove") {
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
		promptlabel.innerHTML = moveText + "Select destination";
	} else if (state == "showCompleteMove") {
		sideButton2.style.visibility = "visible";
		sideButton1.style.visibility = "visible";
		promptlabel.innerHTML = moveText + "Add PC / Submit";
		sideButton2.innerText = "Submit";
		sideButton1.innerText = "Add Potential Check";
	} else if (state == "invalidMoveIntoCheck") {
		promptlabel.innerHTML = moveText + "Invalid - moved into check";
		sideButton2.style.visibility = "visible";
		sideButton1.style.visibility = "hidden";
		sideButton2.innerText = "Cancel";
	} else if (state == "selectPCKing") {
		promptlabel.innerHTML = moveText + "Select King to attack";
		sideButton2.style.visibility = "hidden";
		sideButton1.style.visibility = "hidden";
	} else if (state == "selectPCAttackers") {
		promptlabel.innerHTML = moveText + "Select attacking pieces";
		sideButton2.style.visibility = "hidden"; // turned visible when an attacker is found in the loop below
		sideButton1.style.visibility = "hidden";
		sideButton2.innerText = "Submit";
	} else if (state == "findPieces") {
		promptlabel.innerHTML = moveText + defaultText;
		sideButton2.style.visibility = "hidden"; // turned visible when an attacker is found in the loop below
		sideButton1.style.visibility = "hidden";
	}
	
	// Loop over all the squares and format them according to their current state
	let checkAttackerCoords = [];
	let checkKingCoords = [];
	if (state != "selectPCAttackers" && state != "selectPCKing" && state != "highlightPotentialMoves" && state != "clear") {
		clearFindPotentialCheckPieces();
	}
	[checkKingCoords,checkAttackerCoords] = findChecks(TURNCOLOR);
	if (state == "selectPCAttackers") {
		// Can only get here if player is not in check. Now we want to show the PCKing selected.
		[checkKingCoords,checkAttackerCoords] = findChecks(oppColor());
	}
	
	for (let r = 0; r <= 7; r++) {
		for ( let c = 0; c <= 7; c++) {
			i = r*8 + c
			x = r + c
			sqr = BOARD[r][c];
			
			if (state == "clear") {
				// For other states, the propertes are set in calling functions, but you can always reset to clear by 
				// just calling setState("clear")
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
				sqr.highlightPotKing = 0;
				sqr.highlightPotAttacker = 0;
			}
			if (state == "showPartialMove") {
				sqr.highlighted = 0;
			}
			if (state == "showCompleteMove") {
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
			}
			if (state == "invalidMoveIntoCheck") {
				sqr.highlighted = 0;
				sqr.potentialMove = 0;
			}
			if (state == "selectPCAttackers") {
				sqr.highlightPotKing = 0;
			}
			
			// Default border:
			sqr.button.style.borderWidth = "";
			sqr.button.style.borderColor = "black"; 
			
			let sqrcolor;
			if (sqr.color=='w') {
				sqrcolor = "silver" // default white square colour
			} else {
				sqrcolor = "grey" // default black square colour
			}
			sqr.button.style.background = sqrcolor;
			
			if (r==4 && c==0) {
				let foo=1;
			}
			
			// Write text of pieces in sqaures:
			sqr.setWavetext();

			// Change formatting if in non-default state:
			if (sqr.highlighted) {
				sqr.button.style.background = 'orange';
			}
			if (sqr.potentialMove) {
				sqr.button.style.background = 'green';
			}
			if (sqr.button.id == STARTID) {
				sqr.button.style.borderColor = "orange";
				sqr.button.style.borderWidth = "6px";
			}
			if (sqr.button.id == ENDID) {
				sqr.button.style.borderColor = "green";
				sqr.button.style.borderWidth = "6px";
			}

			if (sqr.highlightPotKing == 1) {
				sqr.button.style.background = 'red';
			}
			if (sqr.highlightPotAttacker == 1) {
				sqr.button.style.background = 'blue';
			}
			
			
			if (AUTOCHECK || POTCHECK || state == "selectPCAttackers") {
				if (isequal([r,c],checkKingCoords)) {
					sqr.button.style.background = sqrcolor;
					sqr.button.style.borderColor = "red";
					sqr.button.style.borderWidth = "6px";
				}
				if (ismember([r,c],checkAttackerCoords)) {
					sqr.button.style.background = sqrcolor;
					sqr.button.style.borderColor = "blue";
					sqr.button.style.borderWidth = "6px";
					if (state == "selectPCAttackers") {
						sideButton2.style.visibility = "visible";
					}
				}
			}

		}
	}
	
	let whitecaptured = "<strong>White Captured</strong><br>";
	let blackcaptured = "<strong>Black Captured</strong><br>";
	for (let i=0; i<16; i++) {
		if (WHITEPIECES[i].captured==1) {
			whitecaptured = whitecaptured + WHITEPIECES[i].waves() + "<br>";
		}
		if (BLACKPIECES[i].captured==1) {
			blackcaptured = blackcaptured + BLACKPIECES[i].waves() + "<br>";
		}
	}
	let capturedLabel;
	capturedLabel = document.getElementById("whitecaptured");
	capturedLabel.innerHTML = whitecaptured;
	capturedLabel = document.getElementById("blackcaptured");
	capturedLabel.innerHTML = blackcaptured;
	
	// Update the findpiece buttons to display the correct piece for this color
	if (TURNCOLOR == "w") {
		document.getElementById("findK").innerHTML = WK;
		document.getElementById("findQ").innerHTML = WQ;
		document.getElementById("findK").innerHTML = WK;
		document.getElementById("findR").innerHTML = WR;
		document.getElementById("findN").innerHTML = WN;
		document.getElementById("findB").innerHTML = WB;
		document.getElementById("findP").innerHTML = WP;
	} else {
		document.getElementById("findK").innerHTML = BK;
		document.getElementById("findQ").innerHTML = BQ;
		document.getElementById("findK").innerHTML = BK;
		document.getElementById("findR").innerHTML = BR;
		document.getElementById("findN").innerHTML = BN;
		document.getElementById("findB").innerHTML = BB;
		document.getElementById("findP").innerHTML = BP;
	}
}

function setup() {
	TURNNUMBER = 1;
	TURNCOLOR = "w";
	TAKENPIECE = "";
	BOARD = []; // 8 x 8 array of Square objects
	STARTID = "";
	DESTID = "";
	WHITEPIECES = [];
	BLACKPIECES = [];
	MOVEHISTORY = "";
	THISMOVE = "";
	EPCOORDS = [];
	EPCOLOR = "";
	AUTOCHECK = false;
	POTCHECK = false;
	PCKING = 0; // piece idx which is selected as potential check king
	PCATTACKERS = []; // piece idxs which are selected as potential check attackers
	PCCOLOR = ""; // the color of the king in potential check
	
    let squareButtons = document.querySelectorAll('[id^="square"]');
	for (let r = 0; r <= 7; r++) {
		let thisrow = [];
		for ( let c = 0; c <= 7; c++) {
			i = r*8 + c
			let square = new Square(r, c, squareButtons[i].id);
			
			thisrow.push(square)
		}
		BOARD.push(thisrow)
	}
	for (let r = 0; r <= 1; r++) {
		for (let c=0; c <= 7; c++) {
			i = r*8 + c
			let piece = new Piece(i, r, c, 'b')
			BLACKPIECES.push(piece)
			BOARD[r][c].piece = BLACKPIECES[i]
		}
	}for (let r = 6; r <= 7; r++) {
		for (let c=0; c <= 7; c++) {
			i = (r-6)*8 + c
			let piece = new Piece(i, r, c, 'w')
			WHITEPIECES.push(piece)
			BOARD[r][c].piece = WHITEPIECES[i]
		}
	}
	setState("clear");
}


const WK = "<span style='color:#7E7427'>&#9812;</span>";
const WQ = "<span style='color:#563F54'>&#9813;</span>";
const WR = "<span style='color:#394F67'>&#9814;</span>";
const WB = "<span style='color:#771515'>&#9815;</span>";
const WN = "<span style='color:#803300'>&#9816;</span>";
const WP = "<span style='color:#45711A'>&#9817;</span>";
const BK = "<span style='color:#FCE94F'>&#9818;</span>";
const BQ = "<span style='color:#AD7FA8'>&#9819;</span>";
const BR = "<span style='color:#729FCF'>&#9820;</span>";
const BB = "<span style='color:#EF2929'>&#9821;</span>";
const BN = "<span style='color:#FF6600'>&#9822;</span>";
const BP = "<span style='color:#8AE234'>&#9823;</span>";

let TURNNUMBER;
let TURNCOLOR;
let TAKENPIECE;
let BOARD; // 8 x 8 array of Square objects
let STARTID;
let DESTID;
let WHITEPIECES;
let BLACKPIECES;
let MOVEHISTORY;
let THISMOVE;
let EPCOORDS;
let EPCOLOR;
let AUTOCHECK;
let POTCHECK;
let PCKING;
let PCATTACKERS;
let PCCOLOR;

window.onload = setup




