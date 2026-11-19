"use strict";

// The demo play-through's script: how to write it is in tour-script.js. Each ply must be exactly what the engine
// writes in the history (npm test checks, tests/node/tour.test.js), so the board acting it out matches.
// Kept in a module, not a text file, so the deployed page gets the version that goes with its scripts.

const TOUR_TEXT = String.raw`
# Welcome to Qhess: chess where nobody knows which piece is which. Use Next and Back (or the arrow keys) to step through a short game.
# Every piece starts as all six types at once: King, Queen, Bishop, kNight, Rook, Pawn. Each piece on the board shows the letters it could still be.
# Each time a piece moves, the types that couldn't have made that move are ruled out. That's how the army slowly takes shape.
# Before White's first move, Black has a "move 0": the chance to declare a potential check. Nothing is open yet, so Black passes.
0b.
> Nothing of mine can reach a White piece yet. I'll pass.

1w. (KQBNRP)e2e4(QRP)<e7+ e4>
> Two squares straight ahead: only a pawn, rook or queen moves like that. And if it's a rook or queen, it's looking straight up the file at e7, which might be Black's king. I'll declare a potential check on it.
? e4 QR
? pc e7
# @e4 Declaring the check cost White something: to attack e7, the piece on e4 must be a rook or queen. The pawn is gone from its letters.

1b. [e7](KQBNRP)g8f6(N)
> I can answer a potential check by saying the threatened piece is "Not a King". e7 loses its K. Then I still make a move: jumping out from behind my pawns, which only a knight can do.
? e7 QBNRP
? f6 N
# @f6 One move, and f6 has collapsed to a single type: it is a knight. Nothing else could have jumped there.

2w. (KQBNRP)g1f3(N)
> Same idea for me: a knight out, and everyone knows it.
? f3 N

2b. (KQBNRP)b8c6(N)
> My second knight.
? c6 N
# @c6 The army must always add up to a normal chess army. Black now has both knights known, so no other Black piece can be a knight: every one of them has lost its N.

3w. (N)f3e5(N)<d7+ e5>
> My knight now attacks d7. If d7 is the king, that's check. Potential check on d7!
? pc d7

3b. [d7](KQBRP)g7g6(KQRP)
> d7 is not my king, I say. Then one step forward: anything but a bishop (it moved straight) or a knight (I've none left).
? d7 QBRP
? g6 KQRP

4w. (N)e5xf7(N)
> Take f7. A piece that is captured can never have been the king, so this tells us something too.

4b. (KQBRP)e8xf7(KQBP)
> I take back, one square diagonally. A rook couldn't do that, so e8 is no rook.
? f7 KQBP
# @f7 That's the heart of Qhess: every move, capture and check narrows down what the pieces are, until each side's king can be found and checked as in ordinary chess.
# Your turn: press "Play from here" to carry on this game yourself, or Exit to go back to your own game. The Rules (Info tab) say the rest.
`;

export { TOUR_TEXT };
