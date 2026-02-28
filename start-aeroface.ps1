########################################################################
#  AeroFace - One-Click Startup Script
#  Starts the Face Recognition API + Verification Web App
#  Usage:  .\start-aeroface.ps1
########################################################################

$Host.UI.RawUI.WindowTitle = "AeroFace Launcher"

# -- Paths -------------------------------------------------------------
$ROOT        = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND_DIR = Join-Path $ROOT "backend\services\face-service-final\aeroface-rec"
$WEB_DIR     = Join-Path $ROOT "frontend\lounge-verification-web"
$VENV_PYTHON = Join-Path $BACKEND_DIR "venv\Scripts\python.exe"
$API_FILE    = Join-Path $BACKEND_DIR "api.py"
$WEB_INDEX   = Join-Path $WEB_DIR "index.html"

# -- Config ------------------------------------------------------------
$API_PORT = 8000
$WEB_PORT = 3001

# -- Helpers -----------------------------------------------------------
function Write-Step($msg) {
    Write-Host "  [*] $msg" -ForegroundColor Yellow
}

function Write-OK($msg) {
    Write-Host "  [OK] $msg" -ForegroundColor Green
}

function Write-Fail($msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
}

# -- Banner ------------------------------------------------------------
Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host "       AeroFace - System Launcher           " -ForegroundColor Cyan
Write-Host "   Face Recognition + Verification Portal   " -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host ""

# -- Pre-flight Checks ------------------------------------------------
Write-Step "Running pre-flight checks..."

if (-Not (Test-Path $VENV_PYTHON)) {
    Write-Fail "Python venv not found at: $VENV_PYTHON"
    exit 1
}
Write-OK "Python venv found"

if (-Not (Test-Path $API_FILE)) {
    Write-Fail "api.py not found at: $API_FILE"
    exit 1
}
Write-OK "api.py found"

if (-Not (Test-Path $WEB_INDEX)) {
    Write-Fail "Web app not found at: $WEB_DIR"
    exit 1
}
Write-OK "Web app found"

$npxCheck = Get-Command npx -ErrorAction SilentlyContinue
if (-Not $npxCheck) {
    Write-Fail "npx not found. Install Node.js first."
    exit 1
}
Write-OK "Node.js/npx available"

# -- Get LAN IP --------------------------------------------------------
$LAN_IP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } |
    Select-Object -First 1).IPAddress

if (-Not $LAN_IP) { $LAN_IP = "localhost" }

Write-Host ""
Write-Step "LAN IP: $LAN_IP"
Write-Host ""

# -- Cleanup old processes ---------------------------------------------
Write-Step "Cleaning up old processes..."
Stop-Process -Name "python" -Force -ErrorAction SilentlyContinue 2>$null
Start-Sleep -Seconds 1
Write-OK "Cleanup done"

# ======================================================================
#  START SERVICES
# ======================================================================

Write-Host ""
Write-Host "  --- Starting Services ---" -ForegroundColor DarkGray

# -- 1. FastAPI Backend ------------------------------------------------
Write-Step "Starting Face Recognition API (port $API_PORT)..."

$apiJob = Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoProfile", "-Command",
    "`$env:TF_ENABLE_ONEDNN_OPTS='0'; `$env:TF_CPP_MIN_LOG_LEVEL='2'; & '$VENV_PYTHON' '$API_FILE'"
) -WorkingDirectory $BACKEND_DIR -WindowStyle Normal -PassThru

Start-Sleep -Seconds 3

# Wait for API to be ready
Write-Step "Waiting for API to load model (this may take 60-120s)..."

$apiReady = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:$API_PORT/health" -TimeoutSec 2 -ErrorAction Stop
        if ($response.status -eq "ok") {
            $apiReady = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}

if ($apiReady) {
    Write-OK "Face Recognition API is ONLINE  ->  http://${LAN_IP}:${API_PORT}"
    Write-OK "API Docs                        ->  http://${LAN_IP}:${API_PORT}/docs"
} else {
    Write-Fail "API did not respond. Check the API terminal window for errors."
    Write-Host "  [!] Continuing anyway - web app will show API Offline" -ForegroundColor Yellow
}

# -- 2. Verification Web App ------------------------------------------
Write-Step "Starting Verification Web App (port $WEB_PORT)..."

$webJob = Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoProfile", "-Command",
    "npx -y serve -l $WEB_PORT --no-clipboard"
) -WorkingDirectory $WEB_DIR -WindowStyle Normal -PassThru

Start-Sleep -Seconds 3
Write-OK "Verification Portal is ONLINE   ->  http://${LAN_IP}:${WEB_PORT}"

# ======================================================================
#  SUMMARY
# ======================================================================

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host "          AeroFace is RUNNING!               " -ForegroundColor Green
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Face API        http://${LAN_IP}:${API_PORT}" -ForegroundColor White
Write-Host "  API Docs        http://${LAN_IP}:${API_PORT}/docs" -ForegroundColor DarkGray
Write-Host "  Web Portal      http://${LAN_IP}:${WEB_PORT}" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor DarkGray
Write-Host ""

# -- Keep alive and handle shutdown ------------------------------------
try {
    while ($true) {
        if ($apiJob.HasExited) {
            Write-Fail "API process exited unexpectedly (code: $($apiJob.ExitCode))"
            break
        }
        Start-Sleep -Seconds 5
    }
} finally {
    Write-Host ""
    Write-Step "Shutting down AeroFace..."

    if (-Not $apiJob.HasExited) {
        Stop-Process -Id $apiJob.Id -Force -ErrorAction SilentlyContinue
    }
    if (-Not $webJob.HasExited) {
        Stop-Process -Id $webJob.Id -Force -ErrorAction SilentlyContinue
    }

    Stop-Process -Name "python" -Force -ErrorAction SilentlyContinue 2>$null

    Write-OK "All services stopped."
    Write-Host ""
}
