@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found at "C:\Program Files\nodejs".
  echo Install from https://nodejs.org/ then reopen this script.
  exit /b 1
)

if not exist ".env" (
  echo Missing .env — copy .env.example and set DATABASE_URL to your Postgres/Neon URL.
  exit /b 1
)

findstr /C:"postgresql://" .env >nul
if errorlevel 1 (
  echo.
  echo DATABASE_URL must be a Postgres URL now ^(see DEPLOY.md / .env.example^).
  echo SQLite is no longer supported.
  echo.
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 exit /b 1
)

echo Applying database migrations...
call npx prisma migrate deploy
if errorlevel 1 exit /b 1

echo Starting Next.js on http://localhost:3000
call npm.cmd run dev
