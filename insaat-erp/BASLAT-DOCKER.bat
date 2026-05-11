@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo İnşaat ERP Docker (API + Postgres) baslatiliyor...
docker compose up --build -d
if errorlevel 1 (
  echo HATA: Docker calisiyor mu? Docker Desktop acik olsun.
  pause
  exit /b 1
)
echo.
echo --- Hazir ---
echo API:     http://127.0.0.1:3000/meta
echo Saglik:  http://127.0.0.1:3000/health
echo.
echo ERP giris sayfasi (HTML) icin once dist sunun:
echo   1) Repo kokunde: npm run build
echo   2a) Bu klasorde: docker compose --profile site up -d
echo   2b) veya: npx --yes serve ..\dist -l 8888
echo Sonra: http://127.0.0.1:8888/erp-web.html
echo.
pause
