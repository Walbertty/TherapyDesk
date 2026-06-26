require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuid } = require('uuid');
const db = require('./db');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ── MIDDLEWARE ─────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'frontend')));
}

// ── PATIENTS ────────────────────────────────────────────────────────────
app.get('/api/patients', (req, res) => {
  const rows = db.prepare('SELECT * FROM patients ORDER BY name').all();
  res.json(rows.map(mapPatient));
});

app.get('/api/patients/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Paciente não encontrado' });
  res.json(mapPatient(row));
});

app.post('/api/patients', (req, res) => {
  const { name, country, city, whatsapp, email, value, payment, meet, notes } = req.body;
  if (!name || !whatsapp) return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios' });
  const id = uuid();
  db.prepare(`INSERT INTO patients (id,name,country,city,whatsapp,email,value,payment,meet,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, name, country||'BR', city||'', whatsapp, email||'', value||'', payment||'', meet||'', notes||'');
  res.status(201).json({ id, ...req.body });
});

app.put('/api/patients/:id', (req, res) => {
  const { name, country, city, whatsapp, email, value, payment, meet, notes } = req.body;
  const r = db.prepare(`UPDATE patients SET name=?,country=?,city=?,whatsapp=?,email=?,value=?,payment=?,meet=?,notes=? WHERE id=?`)
    .run(name, country, city||'', whatsapp, email||'', value||'', payment||'', meet||'', notes||'', req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Não encontrado' });
  res.json({ id: req.params.id, ...req.body });
});

app.delete('/api/patients/:id', (req, res) => {
  db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

function mapPatient(row) {
  return { id: row.id, name: row.name, country: row.country, city: row.city, wa: row.whatsapp, email: row.email, value: row.value, payment: row.payment, meet: row.meet, notes: row.notes };
}

// ── APPOINTMENTS ─────────────────────────────────────────────────────────
app.get('/api/appointments', (req, res) => {
  const { date, from, to } = req.query;
  let sql = 'SELECT * FROM appointments';
  const params = [];
  if (date) { sql += ' WHERE date = ?'; params.push(date); }
  else if (from && to) { sql += ' WHERE date BETWEEN ? AND ?'; params.push(from, to); }
  sql += ' ORDER BY date, time';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(mapApt));
});

app.get('/api/appointments/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Consulta não encontrada' });
  res.json(mapApt(row));
});

app.post('/api/appointments', (req, res) => {
  const { patientId, date, time, type, freq, status, meet, notes } = req.body;
  if (!patientId || !date || !time) return res.status(400).json({ error: 'patientId, date e time são obrigatórios' });
  const id = uuid();
  db.prepare(`INSERT INTO appointments (id,patient_id,date,time,type,freq,status,meet,notes) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, patientId, date, time, type||'', freq||'Semanal', status||'pending', meet||'', notes||'');
  res.status(201).json({ id, ...req.body });
});

app.put('/api/appointments/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Não encontrado' });
  const merged = { ...mapApt(existing), ...req.body };
  db.prepare(`UPDATE appointments SET patient_id=?,date=?,time=?,type=?,freq=?,status=?,meet=?,notes=? WHERE id=?`)
    .run(merged.patientId||existing.patient_id, merged.date, merged.time, merged.type||'', merged.freq||'', merged.status||'pending', merged.meet||'', merged.notes||'', req.params.id);
  res.json({ id: req.params.id, ...merged });
});

app.delete('/api/appointments/:id', (req, res) => {
  db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

function mapApt(row) {
  return { id: row.id, patientId: row.patient_id, date: row.date, time: row.time, type: row.type, freq: row.freq, status: row.status, meet: row.meet, notes: row.notes };
}

// ── SETTINGS ─────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach(r => { try { obj[r.key] = JSON.parse(r.value); } catch { obj[r.key] = r.value; } });
  res.json(obj);
});

app.put('/api/settings', (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction((data) => {
    for (const [k, v] of Object.entries(data)) upsert.run(k, JSON.stringify(v));
  });
  tx(req.body);
  res.json({ ok: true });
});

// ── HEALTH ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── SPA FALLBACK ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  });
}

// ── START ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 TherapyDesk API rodando em http://localhost:${PORT}`);
});
