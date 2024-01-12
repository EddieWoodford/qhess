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
		player1ID.push(null);
		player1Color.push(null);
		player1Socket.push(null);
		player1SocketID.push(null);
		player2ID.push(null);
		player2Color.push(null);
		player2Socket.push(null);
		player2SocketID.push(null);
		
		addPlayerToGame(socket,data,1);
		
		printDB();
	});

	socket.on("join.game", function(data) {
		let i = addPlayerToGame(socket,data,2);
		if (i > -1) {
			socket.emit("start.game", movehistory[i]);
			opponentOf(socket).emit("start.game", movehistory[i]);
		}
		printDB();
	});
	
	socket.on("leave.game", function() {
		removePlayerFromGame(socket);
		printDB();
	})
    


    // Event for when any player makes a move
    socket.on("make.move", function(data) {
		console.log(data);
       
		// Validation of the moves can be done here

		// socket.emit("move.made", data); // Emit for the player who made the move
		opponentOf(socket).emit("move.made", data); // Emit for the opponent
        
    });


});

function printDB() {
	console.log("gameID:");
	console.log(gameID);
	console.log("player1ID:");
	console.log(player1ID);
	console.log("player2ID:");
	console.log(player2ID);
}

function addPlayerToGame(socket,data,n) {
	let i = gameID.indexOf(data.gameID)
	if (i == -1) {
		console.log('Game ID does not exist');
		return -1
	}
	if (n == 1) {
		if (player1ID[i]) {
			console.log('Seat already taken')
			return -1
		}
		player1ID[i] = data.playerID;
		player1Socket[i] = socket;
		player1SocketID[i] = socket.id;
	} else {
		if (player2ID[i]) {
			console.log('Seat already taken')
			return -1
		}
		player2ID[i] = data.playerID;
		player2Socket[i] = socket;
		player2SocketID[i] = socket.id;
	}
	
	console.log("Added " + data.playerID + " to " + data.gameID + " in seat " + n);
	return i
}

function removePlayerFromGame(socket) {
	if (opponentOf(socket)) {
		opponentOf(socket).emit("opponent.left");
	}
	let i = player2SocketID.indexOf(socket.id);
	
	if (i > -1) {
		console.log("Removed " + player2ID[i] + " from " + gameID[i]);
		delete player2ID[i];
		delete player2Color[i];
		delete player2Socket[i];
		delete player2SocketID[i];
		delete player1Color[i]; // clear color choices if either leaves
	} else {
		i = player1SocketID.indexOf(socket.id);
		if (i > -1) {
			console.log("Removed " + player1ID[i] + " from " + gameID[i]);
			delete player1ID[i];
			delete player1Color[i];
			delete player1Socket[i];
			delete player1SocketID[i];
			delete player2Color[i]; // clear color choices if either leaves
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