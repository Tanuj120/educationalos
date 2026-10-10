@echo off
setlocal EnableExtensions

set "PROJECT_DIR=%~dp0"
set "SITE_URL=http://localhost:5173"

where docker >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop is required but Docker was not found on PATH.
  echo Install and start Docker Desktop, then run this file again.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop is not running. Start it, wait for it to finish initializing, then run this file again.
  pause
  exit /b 1
)

pushd "%PROJECT_DIR%"
echo Starting the NEXUS frontend, backend, and database...
echo Docker will download any missing images automatically.
docker compose up -d
if errorlevel 1 (
  echo.
  echo NEXUS could not start. Run "docker compose logs" from this folder for details.
  popd
  pause
  exit /b 1
)

echo Waiting for the frontend at %SITE_URL% ...
set /a attempts=0
:wait_for_frontend
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 '%SITE_URL%'; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { exit 0 }; exit 1 } catch { exit 1 }"
if not errorlevel 1 goto open_browser

set /a attempts+=1
if %attempts% GEQ 30 goto frontend_timeout
timeout /t 2 /nobreak >nul
goto wait_for_frontend

:open_browser
start "" "%SITE_URL%"
echo NEXUS is running at %SITE_URL%
echo Stop it later with: docker compose down
popd
exit /b 0

:frontend_timeout
echo.
echo The containers started, but the frontend did not become ready within 60 seconds.
echo Check the logs with: docker compose logs
popd
pause
exit /b 1
