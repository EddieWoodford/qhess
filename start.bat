@echo off
rem Double-click to start the Qhess server and open the game in your browser.
rem The first time, it installs what the game needs: Node.js 20 or later (with winget; Windows asks you to allow it)
rem and the npm packages. After a git pull that changes the packages, it installs them again.
rem It also runs multiplayer games: a friend on the same network can open the "On your network" address.
rem Close this window to stop the server. Arguments go to the server, e.g. start.bat --port 8100 --no-browser
title Qhess server
cd /d "%~dp0"

call :node_ok && goto packages
rem Installed, but this window's PATH is older than the install (or an older Node.js comes first on it)
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
call :node_ok && goto packages
where winget >nul 2>nul || (echo Qhess needs Node.js 20 or later. Install it from https://nodejs.org/ and run start.bat again. & goto failed)
echo Installing Node.js (Windows may ask you to allow it)...
call winget install --id OpenJS.NodeJS.LTS --exact --source winget
set "PATH=%ProgramFiles%\nodejs;%PATH%"
call :node_ok || (echo Node.js could not be installed. Install it from https://nodejs.org/ and run start.bat again. & goto failed)

:packages
rem Install the packages when package-lock.json is newer than the last install: a fresh clone, or a pull that changed it
call node -e "const t = f => { try { return require('fs').statSync(f).mtimeMs } catch { return -1 } }; process.exit(t('node_modules/.package-lock.json') < t('package-lock.json') ? 1 : 0)" || (
	echo Installing packages...
	call npm ci --no-audit --no-fund || (echo Could not install the packages. & goto failed)
)
call node server\server.js %*
pause
exit /b

:node_ok
rem Is the node on the PATH version 20 or later?
call node -e "process.exit(process.versions.node.split('.')[0] < 20 ? 1 : 0)" >nul 2>nul
exit /b

:failed
pause
exit /b 1
