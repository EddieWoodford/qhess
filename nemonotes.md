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
