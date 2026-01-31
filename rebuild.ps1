# Hodo Application Rebuild Script
# 1. Kill processes named Hodo
# 2. Delete dist folder
# 3. Execute npm run pack command
# 4. Navigate to dist folder

Write-Host "=== Hodo Application Rebuild Script ===" -ForegroundColor Cyan

# Step 1: Kill processes named Hodo
Write-Host "`n[1/4] Killing Hodo processes..." -ForegroundColor Yellow
$hodoProcesses = Get-Process -Name "Hodo" -ErrorAction SilentlyContinue
if ($hodoProcesses) {
    foreach ($process in $hodoProcesses) {
        Write-Host "  Killing process: $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Gray
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "  [OK] Hodo processes killed" -ForegroundColor Green
} else {
    Write-Host "  [OK] No running Hodo processes found" -ForegroundColor Green
}

# Wait for processes to fully terminate
Start-Sleep -Seconds 1

# Step 2: Delete dist folder
Write-Host "`n[2/4] Deleting dist folder..." -ForegroundColor Yellow
$distPath = Join-Path $PSScriptRoot "dist"
if (Test-Path $distPath) {
    Write-Host "  Deleting directory: $distPath" -ForegroundColor Gray
    Remove-Item -Path $distPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  [OK] dist folder deleted" -ForegroundColor Green
} else {
    Write-Host "  [OK] dist folder does not exist, skipping deletion" -ForegroundColor Green
}

# Step 3: Execute npm run pack command
Write-Host "`n[3/4] Executing npm run pack..." -ForegroundColor Yellow
Write-Host "  Command: npm run pack" -ForegroundColor Gray

# Change to script directory
Set-Location $PSScriptRoot

# Execute npm run pack
# Use npm.cmd explicitly to avoid PowerShell parsing issues
$npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
}
if (-not $npmCmd) {
    Write-Host "  [ERROR] npm command not found in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "  Using npm at: $($npmCmd.Source)" -ForegroundColor Gray

# Execute npm run pack
$process = Start-Process -FilePath $npmCmd.Source -ArgumentList "run", "pack" -Wait -NoNewWindow -PassThru -WorkingDirectory $PSScriptRoot

if ($process.ExitCode -eq 0) {
    Write-Host "  [OK] npm run pack completed successfully" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] npm run pack failed (exit code: $($process.ExitCode))" -ForegroundColor Red
    exit $process.ExitCode
}

# Step 4: Navigate to dist folder
Write-Host "`n[4/4] Navigating to dist folder..." -ForegroundColor Yellow
$distPath = Join-Path $PSScriptRoot "dist"
if (Test-Path $distPath) {
    Set-Location $distPath
    Write-Host "  [OK] Changed to: $distPath" -ForegroundColor Green
    Write-Host "`nCurrent directory: $(Get-Location)" -ForegroundColor Cyan
    
    # Open dist folder in File Explorer
    Start-Process explorer.exe -ArgumentList $distPath
    Write-Host "  [OK] Opened dist folder in File Explorer" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] dist folder does not exist" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Rebuild Complete ===" -ForegroundColor Cyan
