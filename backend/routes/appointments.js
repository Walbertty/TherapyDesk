const router = require('express').Router();
const { pool } = require('../db');
const { resetReminderFlags } = require('../cron/reminders');

const map = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  date: r.date,
  time: r.time,
  type: r.type,
  freq: r.freq,
  status: r.status,
  meet: r.meet,
  notes: r.notes,
  paid: r.paid,
  createdAt: r.created_at,
});

// GET /api/appointments
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM appointments WHERE therapist_id=$1 ORDER BY date, time',
      [req.user.id]
    );
    res.json(rows.map(map));
  } catch (err) {
    console.error('[appointments GET /]', err.message);
    res.status(500).json({ error: 'Erro ao carregar consultas' });
  }
});

// GET /api/appointments/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM appointments WHERE id=$1 AND therapist_id=$2',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Consulta nao encontrada' });
    res.json(map(rows[0]));
  } catch (err) {
    console.error('[appointments GET /:id]', err.message);
    res.status(500).json({ error: 'Erro ao carregar consulta' });
  }
});

// POST /api/appointments
router.post('/', async (req, res) => {
  try {
    const { patientId, date, time, type = '', freq = 'Semanal', status = 'pending', meet = '', notes = '', paid = false } = req.body ?? {};
    if (!patientId || !date || !time) {
      return res.status(400).json({ error: 'patientId, date e time sao obrigatorios' });
    }
    const { rows } = await pool.query(
      `INSERT INTO appointments (therapist_id, patient_id, date, time, type, freq, status, meet, notes, paid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, patientId, date, time, type, freq, status, meet, notes, paid]
    );
    res.status(201).json(map(rows[0]));
  } catch (err) {
    console.error('[appointments POST /]', err.message);
    res.status(500).json({ error: 'Erro ao criar consulta' });
  }
});

// PUT /api/appointments/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT * FROM appointments WHERE id=$1 AND therapist_id=$2',
      [req.params.id, req.user.id]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Consulta nao encontrada' });

    const e = existing.rows[0];
    const b = req.body ?? {};
    const patientId = b.patientId ?? e.patient_id;
    const date      = b.date    ?? e.date;
    const time      = b.time    ?? e.time;
    const type      = b.type    ?? e.type   ?? '';
    const freq      = b.freq    ?? e.freq   ?? 'Semanal';
    const status    = b.status  ?? e.status ?? 'pending';
    const meet      = b.meet    ?? e.meet   ?? '';
    const notes     = b.notes   ?? e.notes  ?? '';
    const paid      = b.paid    !== undefined ? b.paid : (e.paid || false);

    const dateChanged = b.date && b.date !== e.date;
    const timeChanged = b.time && b.time !== String(e.time).slice(0, 5);

    const { rows } = await pool.query(
      `UPDATE appointments
       SET patient_id=$1, date=$2, time=$3, type=$4, freq=$5, status=$6, meet=$7, notes=$8, paid=$9
       WHERE id=$10 AND therapist_id=$11
       RETURNING *`,
      [patientId, date, time, type, freq, status, meet, notes, paid, req.params.id, req.user.id]
    );

    // Se data ou hora mudou, repõe os flags de lembrete para re-enviar
    if (dateChanged || timeChanged) {
      await resetReminderFlags(req.params.id).catch(err =>
        console.error('[appointments PUT] resetReminderFlags:', err.message)
      );
    }

    res.json(map(rows[0]));
  } catch (err) {
    console.error('[appointments PUT /:id]', err.message);
    res.status(500).json({ error: 'Erro ao atualizar consulta' });
  }
});

// DELETE /api/appointments/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM appointments WHERE id=$1 AND therapist_id=$2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Consulta nao encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[appointments DELETE /:id]', err.message);
    res.status(500).json({ error: 'Erro ao remover consulta' });
  }
});

module.exports = router;
