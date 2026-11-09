@echo off
rem Double-click to start the local web server and open the game in your browser.
rem Close this window to stop the server.
title Qhess local server
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
pause
