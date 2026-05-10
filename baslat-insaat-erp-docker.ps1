# FinSkor — İnşaat ERP API + PostgreSQL (Docker)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$erp = Join-Path $repoRoot "insaat-erp"
if (-not (Test-Path $erp)) {
  Write-Host "insaat-erp klasoru bulunamadi: $erp" -ForegroundColor Red
  exit 1
}
Set-Location $erp
$envFile = Join-Path $erp ".env"
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $erp ".env.example") $envFile
  Write-Host ""
  Write-Host "Olusturuldu: .env — JWT_SECRET ve DB_PASSWORD degerlerini degistirin." -ForegroundColor Yellow
  Write-Host ""
}
Write-Host "Docker Compose baslatiliyor (insaat-erp)..." -ForegroundColor Cyan
docker compose up --build
