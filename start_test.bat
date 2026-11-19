@echo off
rem Double-click to start the Qhess server and open the browser regression test page.
rem Press "Run tests" on the page. Close this window to stop the server.
rem (The command-line tests are run with: npm test)
call "%~dp0start.bat" --open tests/test.html %*
