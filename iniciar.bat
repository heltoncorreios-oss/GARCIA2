@echo off
chcp 65001 > nul
title Gestao Financeira Supermercado - Iniciar Sistema
color 0A

:: Garantir que o script executa na pasta correta onde está localizado
cd /d "%~dp0"

echo ========================================================
echo    Iniciando Gestao Financeira Supermercado...
echo ========================================================
echo.

if not exist node_modules (
    echo [INFO] Instalando dependencias pela primeira vez...
    call npm install
)

echo [INFO] Iniciando o servidor local na porta 3000...
echo [INFO] O navegador abrira automaticamente assim que o servidor estiver pronto...
echo.

:: Polling inteligente em segundo plano: Aguarda o servidor responder OK antes de abrir o navegador
start /b powershell -NoProfile -ExecutionPolicy Bypass -Command "$attempts=0; do { Start-Sleep -Seconds 1; $attempts++; try { $res = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 2; if ($res.StatusCode -eq 200) { Start-Process 'http://localhost:3000'; break; } } catch {} } while ($attempts -lt 30)"

call npm run dev
pause

