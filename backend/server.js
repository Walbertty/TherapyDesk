require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initSchema } = require('./db');
const { startCronJobs } = require('./cron/reminders');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// ── SEGURANÇA ─────────────────────────────────────────────────────────────
app.use(helmet());

// Necessário para o Railway (proxy reverso) — corrige o ValidationError do rate-limit
app.set('trust proxy', 1);

// Origens permitidas: FRONTEND_URL exato + qualquer preview do Vercel + localhost
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  /^https:\/\/therapy-desk[\w-]*\.vercel\.app$/,
  'http://localhost:5500',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
].filter(Boolean);

app.use(cors({
  origin: isProd
    ? (origin, cb) => {
        // Sem origin (same-origin, curl, mobile) → OK
        if (!origin) return cb(null, true);
        const ok = ALLOWED_ORIGINS.some(p =>
          typeof p === 'string' ? p === origin : p.test(origin)
        );
        cb(ok ? null : new Error('CORS: origem não permitida'), ok);
      }
    : '*',
  credentials: true,
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
}));
app.use(express.json({ limit: '10kb' }));

// Rate limit específico para auth (protege contra brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // máx 20 tentativas por IP (não conta requests bem-sucedidas)
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de autenticação. Tente novamente em 15 minutos.' },
});

// Frontend está no Vercel — o backend só serve a API
// (static file serving removido para evitar erros no Railway)

// ── ROTAS PÚBLICAS ────────────────────────────────────────────────────────
app.use('/api/auth',   authLimiter, require('./routes/auth'));
app.use('/api/google', require('./routes/google')); // OAuth callback é público; proteção interna
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── ROTAS PROTEGIDAS (JWT obrigatório) ────────────────────────────────────
app.use('/api/patients',     authMiddleware, require('./routes/patients'));
app.use('/api/appointments', authMiddleware, require('./routes/appointments'));
app.use('/api/settings',     authMiddleware, require('./routes/settings'));

// ── 404 para rotas desconhecidas ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ── ERROR HANDLER GLOBAL ──────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ── START ─────────────────────────────────────────────────────────────────
initSchema()
  .then(() => {
    startCronJobs();
    app.listen(PORT, () => {
      console.log(`🚀 TherapyDesk API → http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Falha ao inicializar o banco:', err.message);
    process.exit(1);
  });
