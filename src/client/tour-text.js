"use strict";

// The demo play-through's script: how to write it is in tour-script.js. Each ply must be exactly what the engine
// writes in the history (npm test checks, tests/node/tour.test.js), so the board acting it out matches.
// Where a bubble would hide the pieces a step is about, start its note or thought with [left], [right], [above]
// or [below] to put the bubble on that side of its square (as seen from White's side; see tour-script.js).
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
> [below] I can answer a potential check by saying the threatened piece is "Not a King". e7 loses its K. Then I still make a move: jumping out from behind my pawns, which only a knight can do.
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
> [below] d7 is not my king, I say. Then one step forward: anything but a bishop (it moved straight) or a knight (I've none left).
? d7 QBRP
? g6 KQRP

4w. (N)e5xf7(N)
> Take f7. A piece that is captured can never have been the king, so this tells us something too.

4b. (KQBRP)e8xf7(KQBP)
> I take back, one square diagonally. A rook couldn't do that, so e8 is no rook.
? f7 KQBP
# @f7 That's the heart of Qhess: every move, capture and check narrows down what the pieces are. Next: how a king is found for certain, and checkmated.

5w. (KQBNRP)f1c4(QB)
> A long diagonal step: only a bishop or a queen could do that. And it points straight at f7.
? c4 QB

5b. (KQBRP)f8g7(KQB)
> [below] One step diagonally, to clear f8. I have a plan for that square.

6w. (KQBNRP)d2d3(KQRP)
> A quiet step forward, opening the diagonal behind it.

6b. (KQBRP)h8f8(K) O-O-O
> [below] Castling! If h8 is my king, it can castle two squares to f8, with the unmoved piece on d8 as its rook. That settles where my king is for good.
? f8 K
? g8 R
# @f8 Castling collapsed both pieces: f8 is Black's king and g8 a rook, and no other Black piece can be the king now. With the king known, ordinary check applies: it may never be left where any White piece could take it.

7w. (KQBNRP)f2c5(QB)
> [below] Bishop or queen again. From c5 it looks along the diagonal through e7 to the king on f8, so e7 can't move away from in front of it.
? c5 QB

7b. (QRP)g6xe4(Q)
> The rook-or-queen on e4 is loose. I take it diagonally, so this piece must be my queen.
? e4 Q
? e7 RP
? g7 B
# @e7 But the army must add up, and Black has only one queen: nothing else of Black's can be a queen any more. Look at e7 (rook or pawn) and g7 (only a bishop now).

8w. (QB)c4xf7(QB)#
> I take on f7, next to the king. As a queen, this piece attacks f8: check. And there's no way out.
? f7 QB
# @f7 Checkmate. The king can't take f7: the unmoved piece on a2 could still be a bishop or queen, and the diagonal from a2 to f7 is open. A square is guarded if any piece could attack it as any of its types.
# @e7 Nothing else can take f7 either. g7 is only a bishop, so it can't step sideways. e7 could be a rook, but it is pinned: moving it would open c5's diagonal to the king. And the only empty square, e8, is covered from f7.
# That's Qhess. Exit to go back to your own game, or step Back and press "Play from here" at any point to take over the game from there. The Rules (Info tab) say the rest.
`;

export { TOUR_TEXT };
