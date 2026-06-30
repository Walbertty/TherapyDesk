const router  = require('express').Router();
const { google } = require('googleapis');
const { pool }   = require('../db');
const jwt        = require('jsonwebtoken');
const auth       = require('../middleware/auth');

// ── Cria cliente OAuth2 com as credenciais do ambiente ──────────────────────
const getClient = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI   // ex: https://therapydesk-production.up.railway.app/api/google/callback
);

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

// ── GET /api/google/auth?token=JWT ──────────────────────────────────────────
// Inicia o fluxo OAuth; o JWT é passado como state para identificar o terapeuta no callback
router.get('/auth', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token obrigatório' });
  const url = getClient().generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: token,
    prompt: 'consent',   // garante refresh_token mesmo se já autorizado antes
  });
  res.redirect(url);
});

// ── GET /api/google/callback ─────────────────────────────────────────────────
// Google redireciona aqui após a terapeuta autorizar
router.get('/callback', async (req, res) => {
  const { code, state: token, error } = req.query;
  const front = process.env.FRONTEND_URL || 'http://localhost:5500';

  if (error || !code) return res.redirect(`${front}?google=error`);

  // Verificar o JWT passado como state
  let userId;
  try {
    userId = jwt.verify(token, process.env.JWT_SECRET).id;
  } catch {
    return res.redirect(`${front}?google=error`);
  }

  try {
    const client  = getClient();
    const { tokens } = await client.getToken(code);
    // Guardar tokens na tabela settings (UPSERT)
    await pool.query(
      `INSERT INTO settings (therapist_id, key, value) VALUES ($1,'google_tokens',$2)
       ON CONFLICT (therapist_id, key) DO UPDATE SET value = EXCLUDED.value`,
      [userId, JSON.stringify(tokens)]
    );
    res.redirect(`${front}?google=connected`);
  } catch (err) {
    console.error('[google/callback]', err.message);
    res.redirect(`${front}?google=error`);
  }
});

// ── GET /api/google/status ────────────────────────────────────────────────────
// Verifica se o terapeuta já conectou o Google
router.get('/status', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT value FROM settings WHERE therapist_id=$1 AND key='google_tokens'`,
    [req.user.id]
  );
  res.json({ connected: !!rows[0] });
});

// ── POST /api/google/meet ─────────────────────────────────────────────────────
// Cria evento no Google Calendar com link Meet automático
router.post('/meet', auth, async (req, res) => {
  const { date, time, patientName, durationMin = 50 } = req.body;
  if (!date || !time || !patientName)
    return res.status(400).json({ error: 'date, time e patientName são obrigatórios' });

  // Buscar tokens guardados
  const { rows } = await pool.query(
    `SELECT value FROM settings WHERE therapist_id=$1 AND key='google_tokens'`,
    [req.user.id]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Google não conectado' });

  const tokens = JSON.parse(rows[0].value);
  const client = getClient();
  client.setCredentials(tokens);

  // Auto-renovar e guardar novos tokens se o access_token expirar
  client.on('tokens', async newTok => {
    const merged = { ...tokens, ...newTok };
    await pool.query(
      `UPDATE settings SET value=$1 WHERE therapist_id=$2 AND key='google_tokens'`,
      [JSON.stringify(merged), req.user.id]
    );
  });

  try {
    const calendar = google.calendar({ version: 'v3', auth: client });
    const startDt  = new Date(`${date}T${time}:00`);
    const endDt    = new Date(startDt.getTime() + Number(durationMin) * 60000);

    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: `Sessão — ${patientName}`,
        start: { dateTime: startDt.toISOString(), timeZone: 'Europe/Lisbon' },
        end:   { dateTime: endDt.toISOString(),   timeZone: 'Europe/Lisbon' },
        conferenceData: {
          createRequest: {
            requestId: `td-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });

    const meetLink = data.conferenceData?.entryPoints
      ?.find(e => e.entryPointType === 'video')?.uri;

    if (!meetLink) return res.status(500).json({ error: 'Google Meet link não foi gerado' });
    res.json({ meetLink, calendarEventId: data.id });

  } catch (err) {
    console.error('[google/meet]', err.message);
    // Token inválido / revogado → apagar e pedir reconexão
    if (err.status === 401 || err.code === 401) {
      await pool.query(
        `DELETE FROM settings WHERE therapist_id=$1 AND key='google_tokens'`,
        [req.user.id]
      );
      return res.status(401).json({ error: 'Sessão Google expirada. Por favor reconecte.' });
    }
    res.status(500).json({ error: 'Erro ao gerar link Meet. Tente novamente.' });
  }
});

// ── DELETE /api/google/disconnect ────────────────────────────────────────────
// Remove os tokens (desconectar Google)
router.delete('/disconnect', auth, async (req, res) => {
  await pool.query(
    `DELETE FROM settings WHERE therapist_id=$1 AND key='google_tokens'`,
    [req.user.id]
  );
  res.json({ ok: true });
});

module.exports = router;
