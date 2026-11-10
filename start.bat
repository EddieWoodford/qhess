@echo off
rem Double-click to start the Qhess server and open the game in your browser.
rem It also runs multiplayer games: a friend on the same network can open the "On your network" address.
rem Close this window to stop the server.
title Qhess server
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Install it from https://nodejs.org/ or run: winget install OpenJS.NodeJS.LTS & pause & exit /b 1)
if not exist node_modules (echo Installing packages... & call npm install)
node server\server.js %*
pause
