while ($true) {
    try {
        python -c "import fastapi, uvicorn, sqlalchemy, psycopg, pgvector, google.genai, dotenv" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Dependencies ready! Starting backend..."
            python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
            break
        }
    } catch {}
    Write-Host "Waiting for pip install..."
    Start-Sleep -Seconds 5
}
