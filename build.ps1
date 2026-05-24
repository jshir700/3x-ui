$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$goHome    = "D:\Software\Fixed\Code\base\Go"
$msys2Bin  = "D:\Software\Fixed\Code\base\msys64\ucrt64\bin"
$gccShim   = "C:\x3ui-frontend\gcc-shim"
$frontendWorkDir = "C:\x3ui-frontend"
$transWorkDir    = "C:\web\translation"

$projectFrontend = Join-Path $scriptDir "frontend"
$projectTrans    = Join-Path $scriptDir "web\translation"
$projectDist     = Join-Path $scriptDir "web\dist"
$frontendDist    = "C:\web\dist"

# --- pre-flight checks ---
$missing = @()
if (-not (Test-Path "$goHome\bin\go.exe"))   { $missing += "Go ($goHome\bin\go.exe)" }
if (-not (Test-Path "$msys2Bin\gcc.exe"))     { $missing += "GCC ($msys2Bin\gcc.exe)" }
if (-not (Test-Path "$gccShim\gcc.exe"))      { $missing += "gcc-shim ($gccShim\gcc.exe)" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "Node.js" }
if (-not (Get-Command npm -ErrorAction SilentlyContinue))  { $missing += "npm" }
if ($missing.Count -gt 0) {
    Write-Error "Missing prerequisites: $($missing -join ', ')"
    exit 1
}

# --- PATH setup (process-scoped) ---
$env:PATH = "$gccShim;$msys2Bin;$goHome\bin;$env:PATH"
$env:CGO_ENABLED = "1"

Write-Host "=== 1/5 Syncing frontend source to $frontendWorkDir ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $frontendWorkDir | Out-Null
robocopy $projectFrontend $frontendWorkDir /MIR /NJH /NJS /NP /NC /XD node_modules gcc-shim 2>&1
if ($LASTEXITCODE -ge 8) { throw "robocopy frontend failed: exit $LASTEXITCODE" }

Write-Host "=== 2/5 Syncing translations to $transWorkDir ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $transWorkDir | Out-Null
robocopy $projectTrans $transWorkDir /MIR /NJH /NJS /NP /NC 2>&1
if ($LASTEXITCODE -ge 8) { throw "robocopy translations failed: exit $LASTEXITCODE" }

Write-Host "=== 3/5 Running npm run build ===" -ForegroundColor Cyan
Push-Location $frontendWorkDir
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
        npm ci 2>&1
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
    }
    npm run build 2>&1
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
} finally {
    Pop-Location
}

Write-Host "=== 4/5 Copying dist to project ===" -ForegroundColor Cyan
robocopy $frontendDist $projectDist /MIR /NJH /NJS /NP /NC 2>&1
if ($LASTEXITCODE -ge 8) { throw "robocopy dist failed: exit $LASTEXITCODE" }

Write-Host "=== 5/5 Running go build ===" -ForegroundColor Cyan
Push-Location $scriptDir
try {
    go build -ldflags "-w -s" -o x-ui.exe . 2>&1
    if ($LASTEXITCODE -ne 0) { throw "go build failed" }
} finally {
    Pop-Location
}

$bin = Get-Item (Join-Path $scriptDir "x-ui.exe")
Write-Host "Done — $($bin.FullName) ($('{0:N1}' -f ($bin.Length / 1MB)) MB)" -ForegroundColor Green
