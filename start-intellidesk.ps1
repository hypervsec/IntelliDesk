$ErrorActionPreference = "Stop"

$projectDirectory = "C:\Users\enesm\Desktop\IntelliDesk"
$dockerDesktopPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$localHealthUrl = "http://127.0.0.1:8000/health"
$netlifyUrl = "https://intellideskai.netlify.app"
$expectedNgrokUrl = "https://unnamable-sniff-unlearned.ngrok-free.dev"

Set-Location $projectDirectory

Write-Host ""
Write-Host "IntelliDesk baslatiliyor..."
Write-Host ""

# =========================================================
# DOCKER ENGINE KONTROLÜ
# =========================================================

$dockerIsReady = $false

try {
    docker info *> $null
    $dockerIsReady = $true
}
catch {
    $dockerIsReady = $false
}

if (-not $dockerIsReady) {
    if (-not (Test-Path $dockerDesktopPath)) {
        throw "Docker Desktop bulunamadi: $dockerDesktopPath"
    }

    Write-Host "Docker Desktop baslatiliyor..."

    Start-Process $dockerDesktopPath

    for ($attempt = 1; $attempt -le 60; $attempt++) {
        Start-Sleep -Seconds 3

        try {
            docker info *> $null
            $dockerIsReady = $true
            break
        }
        catch {
            Write-Host "Docker Engine bekleniyor... ($attempt/60)"
        }
    }
}

if (-not $dockerIsReady) {
    throw "Docker Engine zamaninda baslatilamadi."
}

Write-Host "Docker Engine hazir."

# =========================================================
# BACKEND CONTAINER
# =========================================================

Write-Host "Backend container baslatiliyor..."

docker compose `
    -p intellidesk `
    up `
    -d `
    backend

$backendIsHealthy = $false

for ($attempt = 1; $attempt -le 60; $attempt++) {
    Start-Sleep -Seconds 3

    try {
        $healthResponse = Invoke-RestMethod `
            -Uri $localHealthUrl `
            -TimeoutSec 10

        if ($healthResponse.status -eq "ok") {
            $backendIsHealthy = $true
            break
        }
    }
    catch {
        Write-Host "Backend bekleniyor... ($attempt/60)"
    }
}

if (-not $backendIsHealthy) {
    docker compose `
        -p intellidesk `
        logs `
        --tail=100 `
        backend

    throw "Backend saglik kontrolunden gecemedi."
}

Write-Host "Backend calisiyor."

# =========================================================
# NGROK TÜNELİ
# =========================================================

$ngrokProcess = Get-Process `
    -Name "ngrok" `
    -ErrorAction SilentlyContinue

if (-not $ngrokProcess) {
    Write-Host "ngrok tuneli baslatiliyor..."

    Start-Process `
        -FilePath "ngrok" `
        -ArgumentList @(
            "http",
            "8000"
        )
}
else {
    Write-Host "ngrok zaten calisiyor."
}

$ngrokPublicUrl = $null

for ($attempt = 1; $attempt -le 30; $attempt++) {
    Start-Sleep -Seconds 2

    try {
        $tunnelResponse = Invoke-RestMethod `
            -Uri "http://127.0.0.1:4040/api/tunnels" `
            -TimeoutSec 5

        $httpsTunnel = $tunnelResponse.tunnels |
            Where-Object {
                $_.public_url -like "https://*"
            } |
            Select-Object -First 1

        if ($httpsTunnel) {
            $ngrokPublicUrl = $httpsTunnel.public_url
            break
        }
    }
    catch {
        Write-Host "ngrok bekleniyor... ($attempt/30)"
    }
}

if (-not $ngrokPublicUrl) {
    throw "ngrok public adresi alinamadi."
}

Write-Host "ngrok adresi: $ngrokPublicUrl"

if ($ngrokPublicUrl -ne $expectedNgrokUrl) {
    Write-Warning (
        "ngrok adresi degisti. " +
        "Netlify VITE_API_URL degeri guncellenmeli."
    )
}

# =========================================================
# DIŞ BAĞLANTI KONTROLÜ
# =========================================================

$externalHealthResponse = Invoke-RestMethod `
    -Uri "$ngrokPublicUrl/health" `
    -Headers @{
        "ngrok-skip-browser-warning" = "1"
    } `
    -TimeoutSec 20

if ($externalHealthResponse.status -ne "ok") {
    throw "ngrok uzerinden backend saglik kontrolu basarisiz."
}

Write-Host "Dis baglanti calisiyor."

# =========================================================
# NETLIFY SİTESİNİ AÇ
# =========================================================

Start-Process $netlifyUrl

Write-Host ""
Write-Host "IntelliDesk hazir."
Write-Host "Site: $netlifyUrl"
Write-Host "API:  $ngrokPublicUrl"
Write-Host ""