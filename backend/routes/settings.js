const router = require('express').Router();
const { pool } = require('../db');

const ALLOWED_KEYS = new Set([
  'rem24h','rem1h','rem15m','remPayment','waEnabled',
  'sessionDur','currency','profileName','waTemplate','blocks',
  'google_tokens',
]);

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT key, value FROM settings WHERE therapist_id=$1',
      [req.user.id]
    );
    const obj = {};
    rows.forEach((r) => {
      try { obj[r.key] = JSON.parse(r.value); } catch { obj[r.key] = r.value; }
    });
    res.json(obj);
  } catch (err) {
    console.error('[settings GET /]', err.message);
    res.status(500).json({ error: 'Erro ao carregar configuracoes' });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  const entries = Object.entries(req.body ?? {}).filter(([k]) => ALLOWED_KEYS.has(k));
  if (entries.length === 0) return res.json({ ok: true });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [k, v] of entries) {
      await client.query(
        `INSERT INTO settings (therapist_id, key, value) VALUES ($1,$2,$3)
         ON CONFLICT (therapist_id, key) DO UPDATE SET value=$3`,
        [req.user.id, k, JSON.stringify(v)]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[settings PUT /]', err.message);
    res.status(500).json({ error: 'Erro ao salvar configuracoes' });
  } finally {
    client.release();
  }
});

module.exports = router;
