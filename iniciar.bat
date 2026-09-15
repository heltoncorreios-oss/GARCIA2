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
echo [INFO] O navegador abrira automaticamente em: http://localhost:3000
echo.

:: Aguarda 3 segundos em segundo plano para o servidor Node.js subir antes de abrir o navegador
start /b cmd /c "timeout /t 3 >nul && start http://localhost:3000"

call npm run dev
pause

