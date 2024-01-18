const http = require("http")
const express = require("express");
const app = express();
const socketIo = require("socket.io");
const fs = require("fs");

const server = http.Server(app).listen(8080);
const io = socketIo(server);


// Serve static resources
// app.use(express.static(__dirname + "/../client/"));
// app.use(express.static(__dirname + "/../node_modules/"));

app.use(express.static(__dirname + "/"));
app.use(express.static(__dirname + "/node_modules/"));

app.get("/", (req, res) => {
    const stream = fs.createReadStream(__dirname + "/index.html");
    stream.pipe(res);
});



// These arrays are all the same length and can be thought of as columns in a database, 1 row per game
var gameID = []; // array of gameID
var player1ID = []; // player1 player ID
var player1Color = []; // player1 color
var player1Socket = []; // player1 socket
var player1SocketID = []; // player1 socket.id
var player2ID = []; // player2 ID
var player2Color = []; // player2 color
var player2Socket = []; // player2 socket
var player2SocketID = []; // player2 socket.id
var movehistory = []; // array of move historys



// When a client connects
io.on("connection", function(socket) {
    let id = socket.id;

    console.log("New client connected. ID: ", socket.id);

    socket.on("disconnect", () => {// Bind event for that socket (player)
        console.log("Client disconnected. ID: ", socket.id);
        socket.broadcast.emit("clientdisconnect", id);
		removePlayerFromGame(socket);
		printDB();
    });
	
	socket.on("create.game", function(data) {
		// create new row in database:
		gameID.push(data.gameID);
		movehistory.push(data.movehistory);
		player1ID.push(data.playerID);
		player1Color.push(data.color);
		player1Socket.push(socket);
		player1SocketID.push(socket.id);
		player2ID.push(null);
		player2Color.push(oppColor(data.color));
		player2Socket.push(null);
		player2SocketID.push(null);
		console.log("Added " + data.playerID + " to " + data.gameID + " in seat 1");
		printDB();
	});

	socket.on("join.game", function(data) {
		let i = gameID.indexOf(data.gameID)
		if (i == -1) {
			console.log("Game ID does not exist");
			socket.emit("game.notfound");
			return
		}
		// If two players are in a game and player1 leaves then seat 1 is open and can be joined.
		// So we need to check if either seat is available.
		if (player1ID[i]) {
			if (player2ID[i]) {			
				console.log("Both seats taken at this game")
				socket.emit("game.full");
				return
			} else {
				n = 2;
			}
		} else {
			n = 1;
		}
		let color;
		if (n == 2) {
			player2ID[i] = data.playerID;
			player2Socket[i] = socket;
			player2SocketID[i] = socket.id;
			color = player2Color[i];
		} else {
			player1ID[i] = data.playerID;
			player1Socket[i] = socket;
			player1SocketID[i] = socket.id;
			color = player1Color[i];
		}
		
		console.log("Added " + data.playerID + " to " + data.gameID + " in seat" + n);
		printDB();
		
		socket.emit("start.game", {
			gameID: gameID[i],
			movehistory: movehistory[i],
			color: color,
		});
		opponentOf(socket).emit("start.game", {
			gameID: gameID[i],
			movehistory: movehistory[i],
			color: oppColor(color),
		});
		
		
	});
	
	socket.on("leave.game", function() {
		removePlayerFromGame(socket);
		printDB();
	})
    


    // Event for when any player makes a move
    socket.on("make.move", function(data) {
		console.log(data);
       
		// Validation of the moves can be done here

		// Update the game record
		let json = JSON.stringify(data);
		fs.writeFile(__dirname + "/games/test.json",json,"utf8",(err) => {
			if (err) {
				console.log(err);
			} else {
				console.log('File write success');
			}
		});
		
		// socket.emit("move.made", data); // Emit for the player who made the move
		opponentOf(socket).emit("move.made", data); // Emit for the opponent
        
    });


});

function printDB() {
	console.log("gameID:");
	console.log(gameID);
	console.log("player1ID:");
	console.log(player1ID);
	console.log("player1Color:");
	console.log(player1Color);
	console.log("player2ID:");
	console.log(player2ID);
	console.log("player2Color:");
	console.log(player2Color);
}


function removePlayerFromGame(socket) {
	if (opponentOf(socket)) {
		opponentOf(socket).emit("opponent.left");
	}
	let i = player2SocketID.indexOf(socket.id);
	
	if (i > -1) {
		console.log("Removed " + player2ID[i] + " from " + gameID[i]);
		delete player2ID[i];
		delete player2Socket[i];
		delete player2SocketID[i];
		// clear color choices if either leaves
		// delete player1Color[i];
		// delete player2Color[i]; 
	} else {
		i = player1SocketID.indexOf(socket.id);
		if (i > -1) {
			console.log("Removed " + player1ID[i] + " from " + gameID[i]);
			delete player1ID[i];
			delete player1Socket[i];
			delete player1SocketID[i];
			// clear color choices if either leaves
			// delete player1Color[i];
			// delete player2Color[i];
		}
	}
	
	
	if (!player1ID[i] && !player2ID[i]) {
		// No players left for this game, remove row from database
		console.log("Cleaned up game " + gameID[i]);
		gameID.splice(i,1);
		player1ID.splice(i,1);
		player1Color.splice(i,1);
		player1Socket.splice(i,1);
		player1SocketID.splice(i,1);
		player2ID.splice(i,1);
		player2Color.splice(i,1);
		player2Socket.splice(i,1);
		player2SocketID.splice(i,1);
		movehistory.splice(i,1);
	}
	
}


////////////////////////////////
// Utilities
////////////////////////////////
function opponentOf(socket) {
	let i = player2SocketID.indexOf(socket.id);
	if (i > -1) {
		return player1Socket[i];
	} else {
		i = player1SocketID.indexOf(socket.id);
		if (i > -1) {
			return player2Socket[i];
		} else {
			return
		}
	}
}
function oppColor(color) {
	if (color=="w") {
		return "b";
	}
	return "w";
}

