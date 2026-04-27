@echo off
chcp 65001 >nul
title PostgreSQL (Docker)
echo.
echo insaat-erp-backend\.env  ile ayni kullanici/sifre/veritabani:
echo   erp_user / erp_yerel_sifre_2026 / insaat_erp
echo.
where docker >nul 2>&1
if errorlevel 1 (
  echo HATA: Docker yok. https://www.docker.com/products/docker-desktop/  kurun, bilgisayari yeniden acin, Docker Desktop "running" olsun.
  pause
  exit /b 1
)

docker rm -f insaat-erp-pg 2>nul
echo Konteyner baslatiliyor (ilk sefer 1-2 dk surebilir)...
docker run -d --name insaat-erp-pg ^
  -e POSTGRES_USER=erp_user ^
  -e POSTGRES_PASSWORD=erp_yerel_sifre_2026 ^
  -e POSTGRES_DB=insaat_erp ^
  -p 5432:5432 ^
  --restart unless-stopped ^
  postgres:16-alpine

if errorlevel 1 (
  echo.
  echo BASARISIZ. Genelde: 5432 zaten baska program tarafindan kullaniliyor (lokal PostgreSQL).
  echo Cozum: pgAdmin lokal servisi duratin VEYA  Docker icin 5433:5432 kullanin ve
  echo  insaat-erp-backend\.env  icine  DB_PORT=5433  yazin.
  pause
  exit /b 1
)

echo.
echo TAMAM. 5 sn bekleyin, sonra  insaat-erp-backend  icinde:  npm run dev
echo.
docker ps --filter name=insaat-erp-pg
pause
