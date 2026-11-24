@echo off
rem Double-click to start the Qhess server and open the game in your browser (the same as: npm start).
rem The first time, it installs what the game needs: the Node.js version in .nvmrc (with winget; Windows asks you
rem to allow it) and the npm packages. After a git pull that changes the packages, it installs them again.
rem It also runs multiplayer games: a friend on the same network can open the "On your network" address.
rem Close this window to stop the server. Arguments go to the server, e.g. start.bat --port 8100 --no-browser
title Qhess server
cd /d "%~dp0"
set /p NODE_MAJOR=<.nvmrc

call :node_ok && goto packages
rem Installed, but this window's PATH is older than the install (or another Node.js comes first on it)
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
call :node_ok && goto packages
where winget >nul 2>nul || (echo Qhess needs Node.js %NODE_MAJOR%. Install it from https://nodejs.org/ and run start.bat again. & goto failed)
echo Installing Node.js %NODE_MAJOR% (Windows may ask you to allow it)...
call winget install --id OpenJS.NodeJS.%NODE_MAJOR% --exact --source winget
set "PATH=%ProgramFiles%\nodejs;%PATH%"
call :node_ok || (echo Node.js %NODE_MAJOR% could not be installed. Install it from https://nodejs.org/ and run start.bat again. & goto failed)

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
rem Is the node on the PATH the major version in .nvmrc?
call node -e "process.exit(process.versions.node.split('.')[0] == '%NODE_MAJOR%' ? 0 : 1)" >nul 2>nul
exit /b

:failed
pause
exit /b 1
