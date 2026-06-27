const router = require('express').Router();
const { pool } = require('../db');

// GET /api/settings
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT key, value FROM settings WHERE therapist_id=$1',
    [req.user.id]
  );
  const obj = {};
  rows.forEach((r) => {
    try { obj[r.key] = JSON.parse(r.value); } catch { obj[r.key] = r.value; }
  });
  res.json(obj);
});

// PUT /api/settings
router.put('/', async (req, res) => {
  const entries = Object.entries(req.body ?? {});
  for (const [k, v] of entries) {
    await pool.query(
      `INSERT INTO settings (therapist_id, key, value) VALUES ($1,$2,$3)
       ON CONFLICT (therapist_id, key) DO UPDATE SET value=$3`,
      [req.user.id, k, JSON.stringify(v)]
    );
  }
  res.json({ ok: true });
});

module.exports = router;
