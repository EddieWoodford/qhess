@echo off
rem Double-click to start the Qhess server and open the browser regression test page.
rem Press "Run tests" on the page. Close this window to stop the server.
rem (The command-line tests are run with: npm test)
title Qhess test server
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Install it from https://nodejs.org/ or run: winget install OpenJS.NodeJS.LTS & pause & exit /b 1)
if not exist node_modules (echo Installing packages... & call npm install)
node server\server.js --open tests/test.html %*
pause
