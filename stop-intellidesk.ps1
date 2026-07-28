$ErrorActionPreference = "Stop"

$projectDirectory = "C:\Users\enesm\Desktop\IntelliDesk"

Set-Location $projectDirectory

Write-Host ""
Write-Host "IntelliDesk kapatiliyor..."
Write-Host ""

# =========================================================
# NGROK TUNELINI KAPAT
# =========================================================

$ngrokProcesses = Get-Process `
    -Name "ngrok" `
    -ErrorAction SilentlyContinue

if ($ngrokProcesses) {
    Write-Host "ngrok tuneli kapatiliyor..."

    $ngrokProcesses |
        Stop-Process `
            -Force `
            -ErrorAction Stop

    Write-Host "ngrok kapatildi."
}
else {
    Write-Host "ngrok zaten kapali."
}

# =========================================================
# BACKEND CONTAINERINI DURDUR
# =========================================================

$dockerIsReady = $false

try {
    docker info *> $null
    $dockerIsReady = $true
}
catch {
    $dockerIsReady = $false
}

if ($dockerIsReady) {
    Write-Host "Backend container durduruluyor..."

    docker compose `
        -p intellidesk `
        stop `
        backend

    if ($LASTEXITCODE -ne 0) {
        throw "Backend container durdurulamadi."
    }

    Write-Host "Backend container durduruldu."
}
else {
    Write-Host "Docker Engine kapali. Container islemi atlandi."
}

Write-Host ""
Write-Host "IntelliDesk kapatildi."
Write-Host "Docker Desktop acik birakildi."
Write-Host ""