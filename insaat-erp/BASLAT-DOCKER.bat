@echo off
chcp 65001 >nul
set "ROOT=%~dp0.."
set "FE=%~dp0insaat-erp-frontend"
echo ============================================
echo FinERP - tek tik kurulum
echo ============================================
echo.

cd /d "%ROOT%"
if exist package.json goto root_ok
echo UYARI: package.json yok, atlandi.
goto after_root
:root_ok
if not exist "node_modules\" (
  echo [1/4] npm install repo kok...
  call npm install
  if errorlevel 1 goto hata
)
echo [1/4] FinSkor dist build...
echo      NOT: 1-2 dk bekleyin - buyuk app.html skistiriliyor, takili degil.
echo.
call npm run build
if errorlevel 1 goto hata
:after_root

cd /d "%FE%"
if not exist package.json (
  echo HATA: Frontend yok: %FE%
  goto hata
)
if not exist "node_modules\" (
  echo [2/4] npm install frontend...
  call npm install
  if errorlevel 1 goto hata
)
echo [3/4] React ERP build...
call npm run build:docker
if errorlevel 1 goto hata

cd /d "%~dp0"
echo [4/4] Docker...
docker compose up --build -d
if errorlevel 1 goto dockerhata

echo.
echo --- TAMAM ---
echo http://127.0.0.1:3000/app/
echo Demo: info@finerp.tr / sifre: 1234
pause
exit /b 0
:dockerhata
echo HATA: Docker. Docker Desktop acik olsun.
pause
exit /b 1
:hata
echo HATA: Adim basarisiz.
pause
exit /b 1
