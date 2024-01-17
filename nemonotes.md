Qhess header


: info :: help ::::::::::::::::::::: [ Qhess ] :::::::::: options :: infoshare :

info = about/credits/link to full game rules
help = UI help, gamerule summary
options = UI options (day/night, colours. font sizes?)
infoshare = info about THIS GAME - turn history, share/restore/etc

...broadly similar to how colorfle has it. 

SO: what icons for each? 

info = hamburger menu
help = circled ? "(?)"
    ...or the thorx "sunrise" logo?
options = gear
infoshare = ???
    wordle and colorfle use a rank icon (trilevel podium), but this is more about turn passing/sharing, than final scoring/sharing
    memo emoji? 📝 
    ...or some 1bit icon equivalent?
    ...or a DB table icon from network diagrams?
    ...icon of my own designing mimicking a chess score sheet?




player1 <-> [UI code] <-> [frontend code] <-> [logic core]
                                   ^
                                   |
                                   v
            [database] <-> [backend code] <-> [logic core]
                                   ^
                                   |
                                   v
player2 <-> [UI code] <-> [frontend code] <-> [logic core]

----

* New Game / Join Game / watch game UI screens

* notation updates to wiki
* terminology updates to wiki (move? turn? stage? motion? round?)

----

# Database

Table: Users
    userID (random/unique ID)
    password (user supplied)
    display name (user supplied)
    email (user supplied - optional for now)
    verified (user supplied - optional for now)

Table: Games
    gameID
    gamecreator
    gamecreated-at
    displayname
    white-userID (link to a userID)
    black-userID (link to a userID)
    status (progress/finished/abandoned)

Table: Plies
    gameID
    turn number (eg 1w) (or is this more efficient as an integer, and translate into notation in code as: even=white, odd=black. round down to nearest even number and divide by 2. that then gives the round number and player colour. 
    resolve-notation (without []?)
    move-notation
    challenge-notation (without <> ?)
    comment-notation (without leading # ?)
    turn-time
    


