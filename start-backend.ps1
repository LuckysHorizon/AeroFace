########################################################################
#  AeroFace - Backend Startup Script
#  Starts ONLY the Face Recognition API
#  Usage:  .\start-backend.ps1
########################################################################

$Host.UI.RawUI.WindowTitle = "AeroFace Backend Launcher"

# -- Paths -------------------------------------------------------------
$ROOT        = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND_DIR = Join-Path $ROOT "backend\services\face-service-final\aeroface-rec"
$VENV_PYTHON = Join-Path $BACKEND_DIR "venv\Scripts\python.exe"
$API_FILE    = Join-Path $BACKEND_DIR "api.py"

# -- Config ------------------------------------------------------------
$API_PORT = 8000

# -- Helpers -----------------------------------------------------------
function Write-Step($msg) { Write-Host "  [*] $msg" -ForegroundColor Yellow }
function Write-OK($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }

# -- Banner ------------------------------------------------------------
Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host "       AeroFace - Backend Launcher          " -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host ""

# -- Pre-flight Checks ------------------------------------------------
if (-Not (Test-Path $VENV_PYTHON)) {
    Write-Fail "Python venv not found at: $VENV_PYTHON"
    exit 1
}

if (-Not (Test-Path $API_FILE)) {
    Write-Fail "api.py not found at: $API_FILE"
    exit 1
}

$LAN_IP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } |
    Select-Object -First 1).IPAddress
if (-Not $LAN_IP) { $LAN_IP = "localhost" }

Write-Step "LAN IP: $LAN_IP"
Write-Step "Cleaning up old python processes..."
Stop-Process -Name "python" -Force -ErrorAction SilentlyContinue 2>$null
Start-Sleep -Seconds 1

Write-Step "Starting Face Recognition API (port $API_PORT)..."
Write-Host "  Press Ctrl+C to stop the server" -ForegroundColor DarkGray
Write-Host ""

# -- Start API Inline --------------------------------------------------
$env:TF_ENABLE_ONEDNN_OPTS = '0'
$env:TF_CPP_MIN_LOG_LEVEL = '2'

Push-Location $BACKEND_DIR
try {
    & $VENV_PYTHON $API_FILE
} finally {
    Pop-Location
}
