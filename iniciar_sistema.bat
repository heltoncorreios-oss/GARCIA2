@echo off
chcp 65001 > nul
title Gestao Financeira Supermercado - Iniciar Sistema
color 0A
echo ========================================================
echo    Iniciando Gestao Financeira Supermercado...
echo ========================================================
cd /d "C:\Users\USER\gestão-financeira-supermercado"

if not exist node_modules (
    echo [INFO] Instalando dependencias pela primeira vez...
    call npm install
)

echo.
echo [INFO] Iniciando o servidor local (npm run dev)...
echo [INFO] Abrindo o navegador em: http://localhost:3000
echo.
start "" http://localhost:3000
call npm run dev
pause
