@echo off
rem Double-click to start the Qhess server and open the game in your browser (the same as: npm start).
rem The first time, it installs what the game needs: the Node.js version in .nvmrc, with fnm (Fast Node Manager,
rem installed with winget), which keeps it apart from any other Node.js on this computer; then the npm packages.
rem After a git pull that changes the packages, it installs them again.
rem It also runs multiplayer games: a friend on the same network can open the "On your network" address.
rem Close this window to stop the server. Arguments go to the server, e.g. start.bat --port 8100 --no-browser
title Qhess server
cd /d "%~dp0"
set /p NODE_MAJOR=<.nvmrc

call :node_ok && goto packages
rem Another Node.js, or none: fnm installs the .nvmrc one once (in APPDATA\fnm), then its folder goes first on this
rem window's PATH. Not fnm env / use: their junctions (LOCALAPPDATA\fnm_multishells into APPDATA) fail on some PCs.
call :find_fnm || call :install_fnm || goto failed
call fnm exec -- node -v >nul 2>nul || call fnm install
for /f "delims=" %%n in ('fnm exec -- node -p process.execPath') do set "PATH=%%~dpn;%PATH%"
call :node_ok || (echo Node.js %NODE_MAJOR% could not be installed with fnm. & goto failed)

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

:find_fnm
rem On the PATH, or where winget put it (this window's PATH can be older than that install)
where fnm >nul 2>nul && exit /b 0
for /f "delims=" %%f in ('dir /s /b "%LOCALAPPDATA%\Microsoft\WinGet\fnm.exe" 2^>nul') do set "PATH=%%~dpf;%PATH%"
where fnm >nul 2>nul
exit /b

:install_fnm
where winget >nul 2>nul || (echo Qhess needs fnm to install Node.js %NODE_MAJOR%. Install it from https://github.com/Schniz/fnm and run start.bat again. & exit /b 1)
echo Installing fnm (Fast Node Manager), which installs Node.js %NODE_MAJOR% for Qhess...
call winget install --id Schniz.fnm --exact --source winget
call :find_fnm || (echo fnm could not be installed. Install it from https://github.com/Schniz/fnm and run start.bat again. & exit /b 1)
exit /b 0

:failed
pause
exit /b 1
