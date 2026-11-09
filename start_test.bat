@echo off
rem Double-click to start the local web server and open the regression test page.
rem Press "Run tests" on the page. Close this window to stop the server.
title Qhess test server
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -OpenPath tests/test.html %*
pause
