const router = require('express').Router();
const { pool } = require('../db');

const map = (r) => ({
  id: r.id,
  name: r.name,
  country: r.country,
  city: r.city,
  wa: r.whatsapp,
  email: r.email,
  value: r.value,
  payment: r.payment,
  meet: r.meet,
  notes: r.notes,
});

// GET /api/patients
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM patients WHERE therapist_id = $1 ORDER BY name',
    [req.user.id]
  );
  res.json(rows.map(map));
});

// GET /api/patients/:id
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM patients WHERE id = $1 AND therapist_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Paciente não encontrado' });
  res.json(map(rows[0]));
});

// POST /api/patients
router.post('/', async (req, res) => {
  const { name, country, city, whatsapp, email, value, payment, meet, notes } = req.body ?? {};
  if (!name || !whatsapp) {
    return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios' });
  }
  const { rows } = await pool.query(
    `INSERT INTO patients (therapist_id, name, country, city, whatsapp, email, value, payment, meet, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.user.id, name.trim(), country || 'BR', city || '', whatsapp, email || '', value || '', payment || '', meet || '', notes || '']
  );
  res.status(201).json(map(rows[0]));
});

// PUT /api/patients/:id
router.put('/:id', async (req, res) => {
  const { name, country, city, whatsapp, email, value, payment, meet, notes } = req.body ?? {};
  const { rows } = await pool.query(
    `UPDATE patients
     SET name=$1, country=$2, city=$3, whatsapp=$4, email=$5, value=$6, payment=$7, meet=$8, notes=$9
     WHERE id=$10 AND therapist_id=$11
     RETURNING *`,
    [name, country || 'BR', city || '', whatsapp, email || '', value || '', payment || '', meet || '', notes || '', req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Paciente não encontrado' });
  res.json(map(rows[0]));
});

// DELETE /api/patients/:id
router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM patients WHERE id = $1 AND therapist_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Paciente não encontrado' });
  res.json({ ok: true });
});

module.exports = router;
