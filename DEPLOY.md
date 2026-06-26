# 🚀 TherapyDesk — Guia de Deploy

## 1. Subir para o GitHub

### 1.1 Criar o repositório no GitHub
1. Acesse https://github.com/new
2. **Repository name:** `TherapyDesk`
3. **Description:** Agenda inteligente para terapeutas — Brasil & Portugal
4. Marque **Public** (ou Private)
5. **NÃO** marque "Add a README" — o projeto já tem arquivos
6. Clique em **Create repository**

### 1.2 Abrir o Terminal (ou Prompt de Comando) na pasta do projeto
No Windows, pressione `Win + R`, digite `cmd` e:
```
cd C:\Users\Walbertty\Claude\Projects\TherapyDesk
```

### 1.3 Comandos git
```bash
git init -b main
git add .
git commit -m "feat: TherapyDesk — mobile PWA + Express/SQLite backend"
git remote add origin https://github.com/Walbertty/TherapyDesk.git
git push -u origin main
```
> Quando pedir senha, use o seu **Personal Access Token** (não a senha do GitHub).

### Como gerar um Personal Access Token:
1. GitHub → Foto de perfil → **Settings**
2. Menu esquerdo → **Developer settings**
3. **Personal access tokens** → **Tokens (classic)**
4. **Generate new token (classic)**
5. Marque: `repo` (acesso total)
6. Clique **Generate token** e copie

---

## 2. Deploy do Backend — Railway (grátis)

### 2.1 Criar conta e projeto
1. Acesse https://railway.app e faça login com GitHub
2. Clique **New Project** → **Deploy from GitHub repo**
3. Selecione **Walbertty/TherapyDesk**

### 2.2 Configurar variáveis de ambiente
No painel do Railway, vá em **Variables** e adicione:
```
NODE_ENV=production
PORT=3001
```

### 2.3 Configurar o comando de start
Em **Settings → Deploy**:
- **Start command:** `cd backend && npm install && node server.js`

### 2.4 Obter a URL do backend
Após o deploy, o Railway gera uma URL como:
`https://therapydesk-production-xxxx.up.railway.app`

---

## 3. Deploy do Frontend — Vercel (grátis)

### 3.1 Criar conta e projeto
1. Acesse https://vercel.com e faça login com GitHub
2. Clique **Add New → Project**
3. Selecione **Walbertty/TherapyDesk**
4. **Root Directory:** selecione `frontend`
5. **Framework Preset:** Other (static)
6. Clique **Deploy**

### 3.2 Atualizar a URL do backend no frontend
Após o deploy do Railway, edite o arquivo `frontend/index.html`:

Encontre esta linha (próxima ao final, na seção `<script>`):
```javascript
: 'https://therapydesk-api.up.railway.app/api';
```

Substitua pela URL gerada pelo Railway:
```javascript
: 'https://SUA-URL-RAILWAY.up.railway.app/api';
```

Depois faça:
```bash
git add frontend/index.html
git commit -m "config: atualizar URL do backend para produção"
git push
```
O Vercel fará o redeploy automaticamente.

---

## 4. Instalar no celular como app (PWA)

### Android (Chrome):
1. Abra a URL do Vercel no Chrome
2. Menu (⋮) → **Adicionar à tela inicial**
3. Confirme — o ícone TherapyDesk aparece na tela!

### iPhone (Safari):
1. Abra a URL no Safari
2. Botão de compartilhar (⬛↑) → **Adicionar à Tela de Início**
3. Confirme — já está instalado!

---

## 5. Testar localmente (opcional)

```bash
# Backend
cd backend
npm install
node server.js
# Acesse: http://localhost:3001/api/health

# Frontend
# Abra frontend/index.html no navegador
# OU use Live Server no VS Code
```

---

## Resumo das URLs (após deploy)

| Serviço   | URL                                          |
|-----------|----------------------------------------------|
| Frontend  | https://therapydesk.vercel.app               |
| Backend   | https://therapydesk-xxx.up.railway.app       |
| API Health| https://therapydesk-xxx.up.railway.app/api/health |
