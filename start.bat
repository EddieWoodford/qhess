@echo off
rem Double-click to start the Qhess server and open the game in your browser.
rem
rem With Docker Desktop installed, it runs the server in a container (compose.yaml): it starts Docker Desktop if
rem needed, builds the image (quick when nothing changed), starts the container and opens the page. Press a key in
rem this window to stop it; closing the window leaves it running (stop it later with: docker compose down).
rem QHESS_PORT sets the port (default 8000).
rem
rem Without Docker (or when Docker Desktop won't start), or with arguments (they go to the server, e.g.
rem start.bat --port 8100 --no-browser), it runs the server on Node.js instead. The first time, it installs what that
rem needs: Node.js 20 or later (with winget; Windows asks you to allow it) and the npm packages. After a git pull
rem that changes the packages, it installs them again.
rem Close the window to stop it.
rem
rem Either way it runs multiplayer games too: a friend on the same network can open the "On your network" address.
title Qhess server
cd /d "%~dp0"

if not "%~1"=="" goto node
where docker >nul 2>nul || goto node

rem ---- Docker ----
docker info >nul 2>nul && goto docker_up
set "DOCKER_DESKTOP=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if not exist "%DOCKER_DESKTOP%" set "DOCKER_DESKTOP=%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
if not exist "%DOCKER_DESKTOP%" (echo Docker isn't running, so the server runs on Node.js instead. & goto node)
echo Starting Docker Desktop (this can take a few minutes)...
rem docker desktop start also starts an engine that was stopped with the app still open; older versions lack it
docker desktop start --detach >nul 2>nul || start "" "%DOCKER_DESKTOP%"
rem Up to about three minutes, a dot every 2 seconds (ping waits; timeout won't run without a keyboard)
for /l %%i in (1,1,90) do (
	docker info >nul 2>nul && (echo. & goto docker_up)
	<nul set /p "=."
	ping -n 3 127.0.0.1 >nul
)
echo.
echo Docker Desktop didn't start, so the server runs on Node.js instead.
goto node

:docker_up
if not defined QHESS_PORT set "QHESS_PORT=8000"
rem This computer's network address (the one with the default route), for the join links
for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "(Get-NetIPConfiguration | Where-Object IPv4DefaultGateway | Select-Object -First 1).IPv4Address | Select-Object -First 1 -ExpandProperty IPAddress"`) do set "QHESS_LAN_ADDRESS=%%a"
echo Building and starting the Qhess container...
call docker compose up --build --detach || (echo Could not start the container. & goto failed)
rem Wait until the server answers (Docker takes the port before the server inside is listening)
curl.exe -fs -o nul --retry 20 --retry-all-errors --retry-delay 1 http://localhost:%QHESS_PORT%/ || (echo The server didn't answer. & call docker compose logs & goto failed)
echo.
echo Qhess is running in Docker.
echo   On this computer:   http://localhost:%QHESS_PORT%/
if defined QHESS_LAN_ADDRESS echo   On your network:    http://%QHESS_LAN_ADDRESS%:%QHESS_PORT%/
start "" http://localhost:%QHESS_PORT%/
echo Press any key to stop it. Games in progress are lost when it stops.
pause >nul
call docker compose down
exit /b

rem ---- Node.js ----
:node
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
