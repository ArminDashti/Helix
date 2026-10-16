<#
.SYNOPSIS
  Install or update the local Helix Docker stack (keeps DB volume on update).
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $RepoRoot 'helix-api\docker-compose.local.yml'
$ProjectName = 'helix'
$ComposeDir = Split-Path -Parent $ComposeFile
# Only containers owned by this local-dev stack (never touch prod helix-api / helix-webui).
$StackContainers = @(
    'helix-api',
    'helix-webui'
)

if (-not (Test-Path -LiteralPath $ComposeFile)) {
    throw "Compose file not found: $ComposeFile"
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    throw 'Docker CLI not found. Install Docker Desktop and ensure docker is on PATH.'
}

docker info 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker daemon is not reachable. Start Docker Desktop and retry.'
}

Write-Host "Installing/updating stack '$ProjectName' (volumes preserved)..."
Push-Location $ComposeDir
try {
    foreach ($vol in @('helix-sqlite-data', 'helix-pip-cache', 'helix-webui-node-modules')) {
        docker volume create $vol 2>$null | Out-Null
    }
    # Recreate containers only - never pass -v (SQLite + caches stay).
    foreach ($name in $StackContainers) {
        cmd /c "docker rm -f $name >nul 2>&1"
    }
    docker compose -p $ProjectName -f $ComposeFile up -d --build --force-recreate --remove-orphans
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

Write-Host ''
Write-Host 'Stack is up:'
Write-Host '  Web UI : http://127.0.0.1:5178/helix/'
Write-Host '  API    : http://127.0.0.1:8173'
Write-Host '  SQLite : volume helix-sqlite-data (/app/backend/data)'
Write-Host '  Gateway: http://helix.local/  and  http://pc-armin/helix/'
Write-Host '  Containers: helix-api, helix-webui'
Write-Host '  Hot reload: edit helix-api / helix-webui on host - no reinstall needed.'
