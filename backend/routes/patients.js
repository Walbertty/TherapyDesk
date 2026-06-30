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
  try {
    const { rows } = await pool.query(
      'SELECT * FROM patients WHERE therapist_id = $1 ORDER BY name',
      [req.user.id]
    );
    res.json(rows.map(map));
  } catch (err) {
    console.error('[patients GET /]', err.message);
    res.status(500).json({ error: 'Erro ao carregar pacientes' });
  }
});

// GET /api/patients/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM patients WHERE id = $1 AND therapist_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Paciente nao encontrado' });
    res.json(map(rows[0]));
  } catch (err) {
    console.error('[patients GET /:id]', err.message);
    res.status(500).json({ error: 'Erro ao carregar paciente' });
  }
});

// POST /api/patients
router.post('/', async (req, res) => {
  try {
    const { name, country, city, whatsapp, email, value, payment, meet, notes } = req.body ?? {};
    if (!name || !whatsapp) {
      return res.status(400).json({ error: 'Nome e WhatsApp sao obrigatorios' });
    }
    const { rows } = await pool.query(
      `INSERT INTO patients (therapist_id, name, country, city, whatsapp, email, value, payment, meet, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, name.trim(), country || 'BR', city || '', whatsapp, email || '', value || '', payment || '', meet || '', notes || '']
    );
    res.status(201).json(map(rows[0]));
  } catch (err) {
    console.error('[patients POST /]', err.message);
    res.status(500).json({ error: 'Erro ao criar paciente' });
  }
});

// PUT /api/patients/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, country, city, whatsapp, email, value, payment, meet, notes } = req.body ?? {};
    if (!name || !whatsapp) {
      return res.status(400).json({ error: 'Nome e WhatsApp sao obrigatorios' });
    }
    const { rows } = await pool.query(
      `UPDATE patients
       SET name=$1, country=$2, city=$3, whatsapp=$4, email=$5, value=$6, payment=$7, meet=$8, notes=$9
       WHERE id=$10 AND therapist_id=$11
       RETURNING *`,
      [name, country || 'BR', city || '', whatsapp, email || '', value || '', payment || '', meet || '', notes || '', req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Paciente nao encontrado' });
    res.json(map(rows[0]));
  } catch (err) {
    console.error('[patients PUT /:id]', err.message);
    res.status(500).json({ error: 'Erro ao atualizar paciente' });
  }
});

// DELETE /api/patients/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM patients WHERE id = $1 AND therapist_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Paciente nao encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[patients DELETE /:id]', err.message);
    res.status(500).json({ error: 'Erro ao remover paciente' });
  }
});

module.exports = router;
