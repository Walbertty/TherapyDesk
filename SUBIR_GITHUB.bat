@echo off
chcp 65001 >nul
title TherapyDesk — Subir para GitHub

echo.
echo ============================================
echo   TherapyDesk — Subir para o GitHub
echo ============================================
echo.

:: Mudar para a pasta do projeto
cd /d "%~dp0"
echo Pasta do projeto: %~dp0
echo.

:: Verificar se git está instalado
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Git nao encontrado!
    echo.
    echo Instale o Git em: https://git-scm.com/download/win
    echo Depois rode este arquivo novamente.
    echo.
    pause
    exit /b 1
)

echo [OK] Git encontrado.
echo.

:: Inicializar repositorio
echo Iniciando repositorio git...
git init -b main
if %errorlevel% neq 0 (
    echo [AVISO] Repositorio ja existe, continuando...
)

:: Configurar identidade
git config user.email "walberttyg@gmail.com"
git config user.name "Walbertty"

:: Adicionar todos os arquivos
echo.
echo Adicionando arquivos...
git add .
git status --short

:: Fazer commit
echo.
echo Fazendo commit...
git commit -m "feat: TherapyDesk — mobile PWA + Express/SQLite backend"
if %errorlevel% neq 0 (
    echo [AVISO] Nada novo para commitar ou commit ja feito.
)

:: Conectar ao GitHub
echo.
echo ============================================
echo   CONECTAR AO GITHUB
echo ============================================
echo.
echo Voce precisa:
echo  1. Criar o repositorio no GitHub (se ainda nao criou):
echo     https://github.com/new
echo     Nome: TherapyDesk
echo     Deixe as opcoes de inicializacao DESMARCADAS
echo     Clique em "Create repository"
echo.
echo  2. Ter seu Personal Access Token em maos
echo     (o que comeca com github_pat_ ou ghp_)
echo.
set /p CONTINUAR="Repositorio criado no GitHub? Digite S e pressione Enter: "
if /i not "%CONTINUAR%"=="S" (
    echo.
    echo Crie o repositorio primeiro e rode este arquivo novamente.
    pause
    exit /b 0
)

:: Adicionar remote e fazer push
echo.
echo Conectando ao repositorio...
git remote remove origin >nul 2>&1
git remote add origin https://github.com/Walbertty/TherapyDesk.git

echo.
echo ============================================
echo   FAZENDO PUSH
echo ============================================
echo.
echo Quando pedir credenciais:
echo   Username: Walbertty
echo   Password: cole seu Personal Access Token
echo.
pause

git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   SUCESSO! Codigo no GitHub!
    echo   https://github.com/Walbertty/TherapyDesk
    echo ============================================
    echo.
    echo PROXIMOS PASSOS:
    echo.
    echo BACKEND - Railway (gratis):
    echo   1. https://railway.app - login com GitHub
    echo   2. New Project - Deploy from GitHub repo - TherapyDesk
    echo   3. Variables: NODE_ENV=production
    echo   4. Start command: cd backend ^&^& npm install ^&^& node server.js
    echo.
    echo FRONTEND - Vercel (gratis):
    echo   1. https://vercel.com - login com GitHub
    echo   2. Add New - Project - TherapyDesk
    echo   3. Root Directory: frontend
    echo   4. Deploy!
    echo.
    echo Veja o arquivo DEPLOY.md para mais detalhes.
) else (
    echo.
    echo [ERRO] Falhou o push. Verifique:
    echo  - Token correto (use como senha)
    echo  - Repositorio criado no GitHub
    echo  - Conexao com internet
)

echo.
pause
