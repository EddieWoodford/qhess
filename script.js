// Classes
class Square {
    constructor(r, c, buttonID) {
        this.r = r;
        this.c = c;
		this.piece = "";
		this.highlighted = 0;
		this.potentialmove = 0;
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
				setState("clear")
			}
        }
		this.button.onclick = () => {
			if (getState() == "highlightPotentialMoves") {
				showPartialMove(buttonID)
			} else if (getState() == "showPartialMove") {
				showCompleteMove(buttonID)
			} else if (getState() == "showCompleteMove") {
				restoreBoard();
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
                                wavetext = wavetext.replace (/^/, '<div class="whitepiece">');
                                wavetext = wavetext.replace (/$/, '</div>');
				wavetext = wavetext.replace("K",WK);
				wavetext = wavetext.replace("Q",WQ);
				wavetext = wavetext.replace("R",WR);
				wavetext = wavetext.replace("B",WB);
				wavetext = wavetext.replace("N",WN);
				wavetext = wavetext.replace("P",WP);
				wavetext = wavetext.replaceAll("empty","&#9725;");
			} else {
                                wavetext = wavetext.replace (/^/, '<div class="blackpiece">');
                                wavetext = wavetext.replace (/$/, '</div>');
				wavetext = wavetext.replace("K",BK);
				wavetext = wavetext.replace("Q",BQ);
				wavetext = wavetext.replace("R",BR);
				wavetext = wavetext.replace("B",BB);
				wavetext = wavetext.replace("N",BN);
				wavetext = wavetext.replace("P",BP);
				wavetext = wavetext.replaceAll("empty","&#9726;");
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
	removewave(wave) {
		// Remove a wave from the options array
		let optidxs = wave2optidxs(wave);
		for (let oi = 0; oi < optidxs.length; oi++) {
			this.options[optidxs[oi]] = 0;
		}
	}
	waves() {
		// Waves string based on options array
		let allwaves = "KQBNRP";
		let wavesout = "";
		for (let wi = 0; wi < 6; wi++) {
			let optidxs = wave2optidxs(allwaves[wi]);
			let subopts = this.options.slice(optidxs[0],optidxs[optidxs.length-1]+1);
			if (sum(subopts) > 0) {
				wavesout = wavesout + allwaves[wi];
			}
		}
		return wavesout
	}
}

function sideButton1Click() {
	if (getState() == "showCompleteMove" || getState() == "selectPCAttackers") {
		// Submit the move!
		
		// Calculate new options
	
		// The pieces are already in the new location due to the showCompleteMove state
		if (TURNCOLOR == "w") {
			TURNCOLOR =	"b";
		} else {
			TURNCOLOR = "w";
		}
			
		// Update move history label:
		MOVEHISTORY = MOVEHISTORY + TURNNUMBER.toString() + ". " + THISMOVE + "\r\n";
		historyArea = document.getElementById("movehistory");
		historyArea.value = MOVEHISTORY;
			
		TAKENPIECE.captured = 1;
		TAKENPIECE = "";
		
		STARTID = "";
		ENDID = "";
		TURNNUMBER = TURNNUMBER + 1;
		setState("clear");
	}
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

function restoreGameHistory() {
	// Restore a game from whatever history is in the move history textbox
	let historyArea = document.getElementById("movehistory");
	let historyText = historyArea.value;
	let lines = historyText.split("\n");
	let moveText;
	let r;
	let c;
	setup();
	for (i in lines) {
		moveText = lines[i];
		if (moveText != "") {
			moveText = moveText.split(")");
			moveText = moveText[1].split("(");
			moveText = moveText[0].replace("x","");
			// Now moveText should be 4 chars long, such as h2h3, indicating the from-to coordinates
			c = moveText[0].charCodeAt()-97;
			r = 8-moveText[1];
			let startButtonID = coords2buttonID([r,c]);
			c = moveText[2].charCodeAt()-97;
			r = 8-moveText[3];
			let endButtonID = coords2buttonID([r,c]);
			showPartialMove(startButtonID);
			showCompleteMove(endButtonID);
			sideButton1Click();
		}
	}
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
		for (let i=0; i<moves.length; i++) {
			BOARD[moves[i][0]][moves[i][1]].potentialmove = 1;
		}
		setState("highlightPotentialMoves");
	}
}

function showPartialMove(buttonID) {
	// Show potential moves after clicking on start location
	let coords = buttonID2coords(buttonID);
	let piece = BOARD[coords[0]][coords[1]].piece;
	if (piece=="") {return;}
	if (piece.color == TURNCOLOR) {
		THISMOVE = "(" + piece.waves() + ")" + BOARD[coords[0]][coords[1]].chesscoords;
		saveBoard();
		STARTID = buttonID;
		let moves = getPotentialMoves(coords);
		for (let i=0; i<moves.length; i++) {
			BOARD[moves[i][0]][moves[i][1]].potentialmove = 1;
		}
		setState("showPartialMove");
	}
}

function showCompleteMove(buttonID) {
	// After clicking on destination:
	let startCoords = buttonID2coords(STARTID);
	let validDestinations = getPotentialMoves(startCoords);
	let endCoords = buttonID2coords(buttonID)
	if (ismember(endCoords,validDestinations)) {
		movingPiece = BOARD[startCoords[0]][startCoords[1]].piece;
		
		// Remove the options from this piece based on movement:
		currentWaves = movingPiece.waves();
		for (let wi=0; wi < currentWaves.length; wi++) {
			let waveDestinations = getPotentialMoves(startCoords,currentWaves[wi]);
			if (!ismember(endCoords,waveDestinations)) {
				movingPiece.removewave(currentWaves[wi]);
			}
		}
		movingPiece.hasmoved = 1;
		movingPiece.r = endCoords[0];
		movingPiece.c = endCoords[1];
		
		// Move the piece:
		ENDID = buttonID;
		TAKENPIECE = BOARD[endCoords[0]][endCoords[1]].piece;
		if (TAKENPIECE != "") {
			TAKENPIECE.captured = 1;
			TAKENPIECE.removewave('K');
			THISMOVE = THISMOVE + "x";
		}
		BOARD[endCoords[0]][endCoords[1]].piece = movingPiece;
		BOARD[startCoords[0]][startCoords[1]].piece = "";
		THISMOVE = THISMOVE + BOARD[endCoords[0]][endCoords[1]].chesscoords + "(" + movingPiece.waves() + ")"
		
		updateOptionsFromFullCollapse();
		// updateOptionsFromEntanglement();
		
		setState("showCompleteMove")
	} else {
		setState("clear");
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
		if (color == "w" ) {
			pieces = WHITEPIECES;
		} else {
			pieces = BLACKPIECES;
		}
		i = 0;
		while (i < 16) {
			piece = pieces[i];
			if (piece.fullcollapsed == 1) {
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
	// Update options of all pieces based on entanglement
	// First, get the options matrix OM
	// OM is a 16 x 16 matrix, with each row being the piece.options vector from the pieces.
	
	let pieceIdx = 0;
	let optionIdx = 0;
	let sum1;
	let sum2;
	let OM;
	let OM2;
	let idxs;
	let ogValid;
	let pieces;
	if (colors == undefined) {
		colors = ["w","b"];
	}
	
	
	for (color of colors) {	
		// Loop through current valid options, and for each, check if after moving it the Option Matrix is still valid.
		// If it isn't then the option that was removed is invalid and needs to be removed. This ensures that if the 
		// player takes any given option, they will stay ni a valid state.
		
		while (pieceIdx<16) {
			// Need to reset the pieces and OM variables here in case these loops have been reset after removing an option
			if (color == "w" ) {
				pieces = WHITEPIECES;
			} else {
				pieces = BLACKPIECES;
			}
			OM = getOM(pieces);
			if (isValidOM(OM) == 0) {
				setState("ERROR-invalidOM");
				return;
			}
			
			while (optionIdx<16) {
				if (OM[pieceIdx][optionIdx] == 1) {
					// remove ith column:
					OM2 = OM.map(function(val) {
						return val.toSpliced(optionIdx,1);
					})
					// remove ith row:
					OM2.splice(pieceIdx,1);
					
					// Sort 1's into bottom-right corner. This makes isValidOM() much faster
					sum1 = OM2.reduce((pieceIdx, a) => pieceIdx.map((b, i) => a[i] + b));
					sum2 = OM2.map(y => y.reduce((a, b) => a+b));
					idxs = Array.from(sum1.keys()).sort((a,b) => sum1[a]-sum1[b])
					for (let i=0; i<8; i++) {
						OM2[i] = idxs.map(j => OM2[i][j])
					}
					idxs = Array.from(sum2.keys()).sort((a,b) => sum2[a]-sum2[b])
					OM2 = idxs.map(j => OM2[j])
					
					// See if any options result in an invalid matrix, and if so remove them and start again
					if (isValidOM(OM2)==0) {
						pieces[pieceIdx][optionIdx] = 0;
						updateOptionsFromFullCollapse(color);
						pieceIdx = -1;
						break;
					}
				}
				optionIdx = optionIdx + 1;
			}
			pieceIdx = pieceIdx + 1;
			optionIdx = 0;
		}
	}
	
	
}

function getOM(pieces) {
	let OM = [];
	for (let i=0; i<16; i++) {
		OM.push(pieces[i].options);
		// colsum = Math.sum(OM,1);
	}
	return OM;
}

function isValidOM(OM) {
	// Check if an options matrix is valid - ie it contains no options which, if fufilled, would result in an impossible state 
	// A valid OM is on that can be rearranged by row swaps to have 1's on its leading diagonal. That is equivalent to saying that
	// there is an arrangement of the current pieces' options that gives a full chess demographic.
	
	if (OM.length == 1) {
		if (OM==1) {
			return 1;
		} else {
			return 0;
		}
	}
	sum1 = OM.reduce((pieceIdx, a) => pieceIdx.map((b, i) => a[i] + b));
	if (sum1.includes(0)) {
		return 0;
	}
	sum2 = OM.map(y => y.reduce((a, b) => a+b));
	if (sum2.includes(0)) {
		return 0;
	}

	for (let i=0; i<OM.length; i++) {
		if (OM[0][i]==1) {
			// remove 1st column:
			let OM2 = OM.map(function(val) {
				return val.slice(1,16)
			})
			// remove ith row:
			OM2.splice(i,1);
			result = isValidOM(OM2);
			if (result == 1) {return 1}
		}
	}
	return 0
	
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
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color == opponentColor) {
			moves.push(newcoords)
		}
		newcoords = [coords[0]-direction,coords[1]+1]
		if (isValidCoord(newcoords) && BOARD[newcoords[0]][newcoords[1]].piece.color == opponentColor) {
			moves.push(newcoords)
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
function buttonID2coords(buttonID) {
	return [+buttonID.substr(6,1),+buttonID.substr(7,2)]
}
function coords2buttonID(coords) {
	return "square"+coords[0]+coords[1]
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
function saveBoard() {
	PREVPIECES = [];
	let oldPiece;
	let pieceClone;
	for (let i = 0; i < 32; i++) {
		pieceClone = new Piece(0,0,0,0);
		if (i<16) {
			oldPiece = WHITEPIECES[i];
		} else {
			oldPiece = BLACKPIECES[i-16];
		}
		for (let prop in oldPiece) {
			pieceClone[prop] = oldPiece[prop];
		}
		pieceClone.options = [...oldPiece.options];
		PREVPIECES[i] = pieceClone;
	}
}
function restoreBoard() {
	
	// Clear current pieces:
	for (let r = 0; r <= 7; r++) {
		for ( let c = 0; c <= 7; c++) {
			BOARD[r][c].piece = "";
		}
	}
	WHITEPIECES = [];
	BLACKPIECES = [];
	
	// Load previous pieces:
	for (let i = 0; i < 32; i++) {
		piece = PREVPIECES[i];
		if (i<16) {
			WHITEPIECES[i] = piece;
		} else {
			BLACKPIECES[i-16] = piece;
		}
		if (piece.captured==0) {
			BOARD[piece.r][piece.c].piece = piece;
		}
	}
	PREVPIECES = [];
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
	

	if (state == "clear") {
		sideButton1.style.visibility = "hidden";
		sideButton2.style.visibility = "hidden";
		promptlabel.innerText = "Select piece to move";
		STARTID = "";
		ENDID = "";
		PREVPIECES = [];
		THISMOVE = "";
	} else if (state == "highlightPotentialMoves") {
		sideButton1.style.visibility = "hidden";
		sideButton2.style.visibility = "hidden";
		promptlabel.innerText = "Select piece to move";
	} else if (state == "showPartialMove") {
		sideButton1.style.visibility = "hidden";
		sideButton2.style.visibility = "hidden";
		promptlabel.innerText = "Select destination";
	} else if (state == "showCompleteMove") {
		sideButton1.style.visibility = "visible";
		sideButton2.style.visibility = "visible";
		promptlabel.innerText = "Add PC / Submit";
		sideButton1.innerText = "Submit";
		sideButton2.innerText = "Add Potential Check";
	} else if (state == "selectPCKing") {
		promptlabel.innerText = "Select King to attack";
		sideButton1.style.visibility = "hidden";
		sideButton2.style.visibility = "hidden";
	} else if (state == "selectPCAttackers") {
		promptlabel.innerText = "Select attacking pieces";
		sideButton1.style.visibility = "visible";
		sideButton1.innerText = "Submit";
		sideButton2.style.visibility = "hidden";
	}
	
	// Loop over all the squares and format them according to their current state
	for (let r = 0; r <= 7; r++) {
		for ( let c = 0; c <= 7; c++) {
			i = r*8 + c
			x = r + c
			sqr = BOARD[r][c];
			
			if (state == "clear") {
				// For other states, the propertes are set in calling functions, but you can always reset to clear by just calling setState("clear")
				sqr.highlighted = 0;
				sqr.potentialmove = 0;
			}
			if (state == "showPartialMove") {
				sqr.highlighted = 0;
			}
			if (state == "showCompleteMove") {
				sqr.highlighted = 0;
				sqr.potentialmove = 0;
			}
			
			// Default border:
			sqr.button.style.borderWidth = "";
			sqr.button.style.borderColor = "black"; 
			
			if (sqr.color=='w') {
				sqr.button.style.background = "silver" // default white square colour
			} else {
				sqr.button.style.background = "grey" // default black square colour
			}
			
			if (r==4 && c==0) {
				let foo=1;
			}
			
			// Write text of pieces in sqaures:
			sqr.setWavetext();

			// Change formatting if in non-default state:
			if (sqr.highlighted) {
				sqr.button.style.background = 'orange';
			}
			if (sqr.potentialmove) {
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
	PREVPIECES = []; // for remembering previous state
	STARTID = "";
	DESTID = "";
	WHITEPIECES = [];
	BLACKPIECES = [];
	MOVEHISTORY = "";
	THISMOVE = "";
	
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



// Begin
// let startingLocations = Array(8).fill().map(() => Array(8).fill(""));
// startingLocations[2][2] = "w_KB"
// startingLocations[2][3] = "w_R"
// startingLocations[3][4] = "w_B"
// startingLocations[4][5] = "b_Q"
// startingLocations[5][6] = "w_N"
// startingLocations[2][5] = "b_R"
// startingLocations[6][6] = "b_P"
// startingLocations[7][5] = "b_P"
// startingLocations[7][6] = "w_P"
// startingLocations[7][7] = "w_P"

// note: none of these 'color' definitions can have the 'B' character in them,
// either in RGB or named or whatever. B is special because Bishop and this
// exists:  wavetext = wavetext.replace("B",WB);
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
let PREVPIECES; // for remembering previous state
let STARTID;
let DESTID;
let WHITEPIECES;
let BLACKPIECES;
let MOVEHISTORY;
let THISMOVE;

window.onload = setup




