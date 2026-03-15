# Kill whatever is on port 3000
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
    $pid3000 = $conn.OwningProcess
    $proc = Get-Process -Id $pid3000 -ErrorAction SilentlyContinue
    Write-Host "Killing PID $pid3000 ($($proc.Name)) on port 3000"
    Stop-Process -Id $pid3000 -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "Nothing listening on port 3000"
}

# Remove stale lock
Remove-Item "C:\MContainer\.next\dev\lock" -Force -ErrorAction SilentlyContinue
Write-Host "Lock file cleared"

Start-Sleep -Seconds 2
Write-Host "Ready to start server"
