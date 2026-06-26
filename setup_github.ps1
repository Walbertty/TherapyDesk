# TherapyDesk — Setup GitHub + Deploy
# Execute com clique direito → "Executar com PowerShell"

Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   TherapyDesk — GitHub Setup         ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$TOKEN = Read-Host "Cole seu GitHub Personal Access Token"
$REPO  = "TherapyDesk"
$OWNER = "Walbertty"

# Verificar se git está instalado
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git não encontrado. Instale em https://git-scm.com" -ForegroundColor Red
    pause; exit
}

# 1. Criar repositório via API
Write-Host "`n📦 Criando repositório no GitHub..." -ForegroundColor Yellow
$body = @{ name=$REPO; description="Agenda inteligente para terapeutas — Brasil & Portugal"; private=$false; auto_init=$false } | ConvertTo-Json
try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method POST -Body $body -Headers @{
        Authorization = "token $TOKEN"
        Accept = "application/vnd.github.v3+json"
        "Content-Type" = "application/json"
    }
    Write-Host "✅ Repositório criado: $($response.html_url)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 422) {
        Write-Host "⚠️  Repositório já existe — continuando..." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Erro ao criar repositório: $_" -ForegroundColor Red
        pause; exit
    }
}

# 2. Inicializar git e fazer push
Write-Host "`n🔀 Configurando git e fazendo push..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

git init -b main
git config user.email "walberttyg@gmail.com"
git config user.name "Walbertty"
git add .
git commit -m "feat: TherapyDesk — mobile PWA + Express/SQLite backend"

$remoteUrl = "https://${TOKEN}@github.com/${OWNER}/${REPO}.git"
git remote remove origin 2>$null
git remote add origin $remoteUrl
git push -u origin main

Write-Host "`n✅ Código enviado para: https://github.com/$OWNER/$REPO" -ForegroundColor Green

# 3. Próximos passos
Write-Host "`n╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   PRÓXIMOS PASSOS — DEPLOY                              ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "BACKEND (Railway — grátis):" -ForegroundColor Yellow
Write-Host "  1. Acesse https://railway.app → login com GitHub"
Write-Host "  2. New Project → Deploy from GitHub repo → TherapyDesk"
Write-Host "  3. Variables: NODE_ENV=production | PORT=3001"
Write-Host "  4. Settings → Start command: cd backend && npm install && node server.js"
Write-Host ""
Write-Host "FRONTEND (Vercel — grátis):" -ForegroundColor Yellow
Write-Host "  1. Acesse https://vercel.com → login com GitHub"
Write-Host "  2. Add New → Project → TherapyDesk"
Write-Host "  3. Root Directory: frontend | Framework: Other"
Write-Host "  4. Deploy!"
Write-Host ""
Write-Host "INSTALAR NO CELULAR:" -ForegroundColor Yellow
Write-Host "  Android: Chrome → Menu ⋮ → Adicionar à tela inicial"
Write-Host "  iPhone:  Safari → Compartilhar → Adicionar à Tela de Início"
Write-Host ""
Write-Host "Veja o arquivo DEPLOY.md para instruções detalhadas." -ForegroundColor Gray
Write-Host ""

# Abrir no navegador
$open = Read-Host "Abrir o repositório no navegador? (s/n)"
if ($open -eq "s") { Start-Process "https://github.com/$OWNER/$REPO" }

pause
