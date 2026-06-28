const router = require('express').Router();
const { pool } = require('../db');
const { resetReminderFlags } = require('../cron/reminders');

// PostgreSQL devolve Date/Time como objetos — normaliza para strings
const map = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
  time: String(r.time).slice(0, 5),
  type: r.type,
  freq: r.freq,
  status: r.status,
  meet: r.meet,
  notes: r.notes,
});

// GET /api/appointments?date=YYYY-MM-DD | ?from=&to=
router.get('/', async (req, res) => {
  const { date, from, to } = req.query;
  let query, params;

  if (date) {
    query = 'SELECT * FROM appointments WHERE therapist_id=$1 AND date=$2 ORDER BY time';
    params = [req.user.id, date];
  } else if (from && to) {
    query = 'SELECT * FROM appointments WHERE therapist_id=$1 AND date BETWEEN $2 AND $3 ORDER BY date, time';
    params = [req.user.id, from, to];
  } else {
    query = 'SELECT * FROM appointments WHERE therapist_id=$1 ORDER BY date, time';
    params = [req.user.id];
  }

  const { rows } = await pool.query(query, params);
  res.json(rows.map(map));
});

// GET /api/appointments/:id
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM appointments WHERE id=$1 AND therapist_id=$2',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Consulta não encontrada' });
  res.json(map(rows[0]));
});

// POST /api/appointments
router.post('/', async (req, res) => {
  const { patientId, date, time, type, freq, status, meet, notes } = req.body ?? {};
  if (!patientId || !date || !time) {
    return res.status(400).json({ error: 'patientId, date e time são obrigatórios' });
  }
  const { rows } = await pool.query(
    `INSERT INTO appointments (therapist_id, patient_id, date, time, type, freq, status, meet, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.id, patientId, date, time, type || '', freq || 'Semanal', status || 'pending', meet || '', notes || '']
  );
  res.status(201).json(map(rows[0]));
});

// PUT /api/appointments/:id — atualização completa (merge com dados existentes)
router.put('/:id', async (req, res) => {
  // Busca o registro existente para fazer merge e evitar NULLs indesejados
  const existing = await pool.query(
    'SELECT * FROM appointments WHERE id=$1 AND therapist_id=$2',
    [req.params.id, req.user.id]
  );
  if (!existing.rows[0]) return res.status(404).json({ error: 'Consulta não encontrada' });

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

  const { rows } = await pool.query(
    `UPDATE appointments
     SET patient_id=$1, date=$2, time=$3, type=$4, freq=$5, status=$6, meet=$7, notes=$8
     WHERE id=$9 AND therapist_id=$10
     RETURNING *`,
    [patientId, date, time, type, freq, status, meet, notes, req.params.id, req.user.id]
  );
  // Se data ou hora mudou, resetar flags de lembrete
  if (b.date || b.time) resetReminderFlags(req.params.id).catch(console.error);
  res.json(map(rows[0]));
});

// DELETE /api/appointments/:id
router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM appointments WHERE id=$1 AND therapist_id=$2',
    [req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Consulta não encontrada' });
  res.json({ ok: true });
});

module.exports = router;
