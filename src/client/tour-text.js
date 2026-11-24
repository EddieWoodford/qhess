"use strict";

// The demo play-through's script: how to write it is in tour-script.js. Each ply must be exactly what the engine
// writes in the history (npm test checks, tests/node/tour.test.js), so the board acting it out matches.
// Each ply has one thought per click a player makes for it (> pick:, > to:, > submit: ...): each is a step.
// Where a bubble would hide the pieces a step is about, start its note or thought with [left], [right], [above]
// or [below] to put the bubble on that side of its square (as seen from White's side; see tour-script.js).
// Kept in a module, not a text file, so the deployed page gets the version that goes with its scripts.

const TOUR_TEXT = String.raw`
// Taught in order: collapses (1w.-2w.), then potential check (2b.-4w.), then a known king and checkmate (4b.-5w.).
# Welcome to Qhess: chess where nobody knows which piece is which. Use Next and Back (or the arrow keys) to step through a short game, one click at a time.
# Every piece starts as all six types at once: king, queen, bishop, knight, rook and pawn. Each piece on the board shows a picture of every type it could still be.
# Each time a piece moves, the types that couldn't have made that move are ruled out: the piece "collapses". That's how the army slowly takes shape.
# Before White's first move, Black has a "move 0". It's for something we'll come to later; for now, Black passes.
0b.
> submit: Nothing to do yet. I'll pass the move to White.

1w. (KQBNRP)g1f3(N)
> pick: I'll start with the piece on g1. Like all of them, it could still be anything.
> to: I'll jump out from behind my pawns, to f3. Only a knight can do that.
> submit: That's the move. Clicking f3 again submits it.
? f3 N
# @f3 One move, and this piece has collapsed to a single type: it is a knight. Nothing else could have jumped there.

1b. (KQBNRP)f7xa2(QB)
> pick: The piece on f7 has a clear diagonal in front of it, all the way down to a2.
> to: All the way to a2, taking what's there. Only a bishop or a queen moves like that.
> submit: Submit.
? a2 QB
# @a2 This one has collapsed to two types: bishop or queen. It stays both until something rules one of them out.

2w. (KQBNRP)a1b3(N)
> pick: [above] My corner piece on a1 has nowhere to slide to...
> to: [above] ...but it can jump over my pawns, to b3: my second knight.
> submit: [above] Submit.
? b3 N
? b1 KQBRP
# @b3 The army must always add up to a normal chess army, which has two knights. Both of White's are known now, so no other White piece can be a knight: every one of them has lost its knight picture.

# Now a new idea. Nobody knows where the kings are, so you can't simply be in check. Instead, you can declare a "potential check": if that piece is your king, I'm attacking it.
2b. (KQBNRP)g8xb3(QB)<b2+ b3 g7>
> pick: f7 has gone, so my piece on g8 sees down the diagonal to that knight on b3.
> to: I take it, along the diagonal: bishop or queen again.
> pc: b2 might be White's king, and my pieces could attack it there. I'll add a potential check.
> king: On b2. Every piece of mine that could attack it joins in: b3 and g7.
> submit: Potential check on b2! Submit.
? b3 Q
? g7 B
? a2 B
? pc b2
# @b3 Declaring the check costs the attackers: each keeps only the types that could take b2. b3 is right in front of it, on the file, so it must be the queen.
# @g7 g7 reaches b2 down the long diagonal, so it's a bishop or queen. Black's one queen is on b3: g7 is a bishop, and so is a2. With the queen and both bishops known, every other Black piece has lost its queen and bishop pictures.
# @b2 White must answer it on the next move: move b2 out of the way, block, take an attacker, or declare b2 "Not a King".

3w. [b2](N)f3d4(N)
> nak: b2 is not my king, I declare, so it loses its king picture. That answers the check.
> pick: I still have to make a move. My knight on f3...
> to: ...jumps to d4, which blocks g7's diagonal too.
> submit: Submit.
? b2 QBRP
# @b2 "Not a King" is free, but it gives something away: one fewer place for White's king to hide.

3b. (KNRP)f8xf2(R)<f1+ f2>
> pick: My piece on f8 looks straight down the open f-file.
> to: I take f2. That makes this piece a rook: my queen and bishops are already known.
> pc: From f2 it attacks f1. Another potential check...
> king: ...on f1.
> submit: Submit.
? f2 R
? pc f1

4w. (KQBRP)f1g1(KQR)
> pick: [above] If I say f1 isn't my king, Black learns more about where it is. I'll move it out of the attack instead.
> to: [above] One square sideways, to g1: it could still be a king, queen or rook.
> submit: [above] Submit.
? g1 KQR
# @g1 [above] Moving out of the attack ends the threat too, and keeps the secret. Notice where this piece now stands, at the foot of the g-file.

# Last idea: checkmate. Once a king is known for certain, ordinary check applies: it may never be left where an enemy piece could take it.
4b. (KNRP)e8g8(K) O-O
> pick: [below] My piece on e8, with f8 and g8 both empty beside it now...
> to: [below] Castling, to g8! Only a king castles, so everyone now knows where mine is. In return it's tucked away in the corner.
> submit: [below] Submit.
? g8 K
? f8 R
? h7 NP
# @g8 [below] Castling collapsed both pieces: g8 is Black's king and f8 a rook. With both rooks known (f2 and f8), the rest of Black's pieces can only be knights or pawns.

5w. (KQBRP)g2xg7(QR)#
> pick: I can see a checkmate! My piece on g2 has the open g-file in front of it.
> to: [below] Straight up it to take the bishop on g7, right next to the king. As a rook or a queen, it attacks g8, and the king has nowhere to go.
> submit: [below] Checkmate. Submit!
? g7 QR
# @g7 [below] Checkmate. The king can't take g7: g1, at the foot of the open file, could be a rook or queen, so it guards g7. A square is guarded if any piece could attack it as any of its types.
# @g7 [below] The empty squares f7 and h8 are covered from g7, and nothing of Black's can take g7: f8 is a rook, and g7 is diagonal to it; h7 is only a knight or pawn. No way out.
# That's Qhess. Exit to go back to your own game, or step Back and press "Play from here" at any point to take over the game from there. The Rules (Info tab) say the rest.
`;

export { TOUR_TEXT };
