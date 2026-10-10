[CmdletBinding()]
param(
    [string]$ComposeFile
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ComposeFile)) {
    $ComposeFile = Join-Path $PSScriptRoot '..\docker-compose.yml'
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker Desktop is not installed or Docker is not available on PATH.'
}

if (-not (Test-Path -LiteralPath $ComposeFile)) {
    throw "Compose file not found: $ComposeFile"
}

# Pull images declared directly in docker-compose.yml (for example PostgreSQL).
Write-Host 'Pulling images declared by Docker Compose...'
& docker compose -f $ComposeFile pull
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Compose could not pull the declared images.'
}

# Pull base images referenced by the frontend and backend Dockerfiles while
# rebuilding their application images. Docker uses its cache when possible.
Write-Host 'Pulling Dockerfile base images and building application images...'
& docker compose -f $ComposeFile build --pull
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Compose could not build the application images.'
}

Write-Host 'All required Docker images are ready.'
