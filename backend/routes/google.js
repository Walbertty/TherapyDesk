const router  = require('express').Router();
const { google } = require('googleapis');
const { pool }   = require('../db');
const jwt        = require('jsonwebtoken');
const auth       = require('../middleware/auth');

const getClient = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

// GET /api/google/auth?token=JWT
router.get('/auth', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token obrigatorio' });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    console.error('[google/auth] Variaveis GOOGLE_* nao configuradas');
    return res.status(500).json({ error: 'Configuracao Google incompleta no servidor.' });
  }

  try {
    const url = getClient().generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: token,
      prompt: 'consent',
    });
    res.redirect(url);
  } catch (err) {
    console.error('[google/auth] Erro ao gerar URL:', err.message);
    const front = process.env.FRONTEND_URL || 'http://localhost:5500';
    res.redirect(`${front}?google=error`);
  }
});

// GET /api/google/callback
router.get('/callback', async (req, res) => {
  const { code, state: token, error } = req.query;
  const front = process.env.FRONTEND_URL || 'http://localhost:5500';

  if (error || !code) return res.redirect(`${front}?google=error`);

  let userId;
  try {
    userId = jwt.verify(token, process.env.JWT_SECRET).id;
  } catch {
    return res.redirect(`${front}?google=error`);
  }

  try {
    const client  = getClient();
    const { tokens } = await client.getToken(code);
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

// GET /api/google/status
router.get('/status', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM settings WHERE therapist_id=$1 AND key='google_tokens'`,
      [req.user.id]
    );
    res.json({ connected: !!rows[0] });
  } catch (err) {
    console.error('[google/status]', err.message);
    res.status(500).json({ error: 'Erro ao verificar estado Google' });
  }
});

// POST /api/google/meet
router.post('/meet', auth, async (req, res) => {
  const { date, time, patientName, durationMin = 50 } = req.body;
  if (!date || !time || !patientName)
    return res.status(400).json({ error: 'date, time e patientName sao obrigatorios' });

  let tokens, client;
  try {
    const { rows } = await pool.query(
      `SELECT value FROM settings WHERE therapist_id=$1 AND key='google_tokens'`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Google nao conectado' });
    tokens = JSON.parse(rows[0].value);
    client = getClient();
    client.setCredentials(tokens);
    client.on('tokens', async newTok => {
      try {
        const merged = { ...tokens, ...newTok };
        await pool.query(
          `UPDATE settings SET value=$1 WHERE therapist_id=$2 AND key='google_tokens'`,
          [JSON.stringify(merged), req.user.id]
        );
      } catch (e) {
        console.error('[google/meet] erro ao renovar tokens:', e.message);
      }
    });
  } catch (err) {
    console.error('[google/meet] erro ao carregar tokens:', err.message);
    return res.status(500).json({ error: 'Erro ao carregar credenciais Google' });
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: client });
    const startDt  = new Date(`${date}T${time}:00`);
    const endDt    = new Date(startDt.getTime() + Number(durationMin) * 60000);

    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: `Sessao - ${patientName}`,
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

    if (!meetLink) return res.status(500).json({ error: 'Google Meet link nao foi gerado' });
    res.json({ meetLink, calendarEventId: data.id });

  } catch (err) {
    console.error('[google/meet]', err.message);
    if (err.status === 401 || err.code === 401) {
      await pool.query(
        `DELETE FROM settings WHERE therapist_id=$1 AND key='google_tokens'`,
        [req.user.id]
      );
      return res.status(401).json({ error: 'Sessao Google expirada. Por favor reconecte.' });
    }
    res.status(500).json({ error: 'Erro ao gerar link Meet. Tente novamente.' });
  }
});

// DELETE /api/google/disconnect
router.delete('/disconnect', auth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM settings WHERE therapist_id=$1 AND key='google_tokens'`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[google/disconnect]', err.message);
    res.status(500).json({ error: 'Erro ao desconectar Google' });
  }
});

module.exports = router;
