$ErrorActionPreference = 'Stop'

$token = [Environment]::GetEnvironmentVariable('TITI_SERVICE_TOKEN', 'User')

if ($token -notmatch '^titi_svc_[a-f0-9]{8}_[A-Za-z0-9_-]{43}$') {
  [Console]::Error.WriteLine('TITI_SERVICE_TOKEN is missing or invalid in the Windows user environment.')
  exit 1
}

$env:TITI_SERVICE_TOKEN = $token

if (-not $env:TITI_API_URL) {
  $env:TITI_API_URL = 'https://titi-backend.onrender.com'
}

& node (Join-Path $PSScriptRoot 'src/index.js')
exit $LASTEXITCODE
