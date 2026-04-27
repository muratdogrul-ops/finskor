@echo off
chcp 65001 >nul
set "B=%~dp0insaat-erp-backend"
set "F=%~dp0insaat-erp-frontend"
title Insaat ERP

if not exist "%B%\package.json" (
  echo Klasor bulunamadi: %B%
  echo Bu betigin oldugu yarin altinda "insaat-erp-backend" olmali.
  pause
  exit /b 1
)
if not exist "%F%\package.json" (
  echo Klasor bulunamadi: %F%
  pause
  exit /b 1
)

echo.
echo Iki pencere aciliyor: API 3000 + Web 5173. Kapatmayin.
echo Sonra: http://127.0.0.1:5173/erp-web.html
echo.
echo Ilk sefer: her iki klasorde "npm install" (birer kez) gerek.
echo.
pause

start "Insaat-ERP-API-3000" /D "%B%" cmd /k "echo   [API] http://127.0.0.1:3000/health  &&  npm run dev"
timeout /t 2 /nobreak >nul
start "Insaat-ERP-WEB-5173" /D "%F%" cmd /k "echo   [Web] http://127.0.0.1:5173/erp-web.html  &&  npm run dev"
echo.
echo 15-20 sn bekleyin, sonra yukaridaki Web adresine gidin.
pause
