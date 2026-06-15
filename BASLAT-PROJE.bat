@echo off
chcp 65001 >nul
set "ROOT=%~dp0"
cd /d "%ROOT%"
title FinSkor Proje

:menu
cls
echo.
echo  ========================================
echo   FINSKOR PROJE (guncel kaynak)
echo   %ROOT%
echo  ========================================
echo.
echo   1 - FinSkor Analiz (app.html)
echo   2 - NakitFlow / Nakit Akis (nakit_akis.html)
echo   3 - NakitFlow tanitim (nakitflow.html)
echo   4 - OtoSkor BMW (sunucu :3847)
echo   5 - Proje klasorunu ac
echo   0 - Cikis
echo.
set "SEC="
set /p SEC="Secim (0-5), sonra Enter: "
if not defined SEC goto menu
set "SEC=%SEC: =%"
if "%SEC%"=="0" exit /b 0
if "%SEC%"=="1" call :launch_html app.html & goto menu
if "%SEC%"=="2" call :launch_html nakit_akis.html & goto menu
if "%SEC%"=="3" call :launch_html nakitflow.html & goto menu
if "%SEC%"=="4" goto open_otoskor
if "%SEC%"=="5" explorer "%ROOT%" & timeout /t 1 /nobreak >nul & goto menu
echo.
echo  Gecersiz secim: %SEC%
timeout /t 2 /nobreak >nul
goto menu

:launch_html
set "FN=%~1"
set "HTML=%ROOT%%FN%"
if not exist "%HTML%" (
  echo.
  echo  HATA: Dosya bulunamadi: %HTML%
  echo.
  pause
  exit /b 1
)
echo.
echo  Aciliyor: %HTML%
start "" "%HTML%"
timeout /t 2 /nobreak >nul
exit /b 0

:open_otoskor
if not exist "%ROOT%otoskor-bmw\BASLAT.bat" (
  echo.
  echo  HATA: otoskor-bmw\BASLAT.bat bulunamadi.
  pause
  goto menu
)
cd /d "%ROOT%otoskor-bmw"
start "OtoSkor BMW" cmd /k "BASLAT.bat"
cd /d "%ROOT%"
timeout /t 2 /nobreak >nul
goto menu
