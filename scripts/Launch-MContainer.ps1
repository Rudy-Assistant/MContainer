param(
  [string]$Url = "http://127.0.0.1:3000",
  [string]$ProjectRoot = "C:\MHome\MContainer"
)

$ErrorActionPreference = "Stop"
$logOut = Join-Path $env:TEMP "mcontainer-devserver.out.log"
$logErr = Join-Path $env:TEMP "mcontainer-devserver.err.log"
$pidFile = Join-Path $env:TEMP "mcontainer-devserver.pid"

function Test-AppReady {
  param([string]$TargetUrl)

  try {
    $response = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 3
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

if (-not (Test-AppReady -TargetUrl $Url)) {
  $process = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000") `
    -WorkingDirectory $ProjectRoot `
    -RedirectStandardOutput $logOut `
    -RedirectStandardError $logErr `
    -WindowStyle Minimized `
    -PassThru

  Set-Content -Path $pidFile -Value $process.Id

  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $deadline) {
    if (Test-AppReady -TargetUrl $Url) { break }
    Start-Sleep -Seconds 1
  }
}

Start-Process $Url
