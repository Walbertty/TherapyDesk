const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'therapydesk.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── SCHEMA ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    country     TEXT NOT NULL DEFAULT 'BR',
    city        TEXT,
    whatsapp    TEXT NOT NULL,
    email       TEXT,
    value       TEXT,
    payment     TEXT,
    meet        TEXT,
    notes       TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id          TEXT PRIMARY KEY,
    patient_id  TEXT NOT NULL,
    date        TEXT NOT NULL,
    time        TEXT NOT NULL,
    type        TEXT,
    freq        TEXT,
    status      TEXT DEFAULT 'pending',
    meet        TEXT,
    notes       TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_apts_date ON appointments(date);
  CREATE INDEX IF NOT EXISTS idx_apts_patient ON appointments(patient_id);
`);

// ── SEED DATA (only if empty) ──────────────────────────────────────────
const count = db.prepare('SELECT COUNT(*) as n FROM patients').get();
if (count.n === 0) {
  const insertP = db.prepare(`INSERT INTO patients (id,name,country,city,whatsapp,email,value,payment,meet,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const insertA = db.prepare(`INSERT INTO appointments (id,patient_id,date,time,type,freq,status,meet) VALUES (?,?,?,?,?,?,?,?)`);
  const today = new Date().toISOString().slice(0,10);

  db.transaction(() => {
    insertP.run('p1','João Almeida','BR','São Paulo','+55 11 9 8765-0001','joao@email.com','70','PIX','meet.google.com/aaa-001','Ansiedade. Prefere manhã.');
    insertP.run('p2','Maria Fernandes','PT','Lisboa','+351 91 234 5678','maria@email.pt','90','MBWay','meet.google.com/aaa-002','Sessão inicial.');
    insertP.run('p3','Carlos Rodrigues','BR','São Paulo','+55 11 9 8765-4321','carlos@email.com','80','Transferência','meet.google.com/abc-xyz','Ansiedade generalizada.');
    insertP.run('p4','Ana Costa','PT','Porto','+351 93 456 7890','ana@email.pt','90','Transferência','meet.google.com/aaa-004','Evolução positiva.');
    insertP.run('p5','Pedro Lima','BR','Brasília','+55 61 9 9876-5432','pedro@email.com','70','PIX','meet.google.com/aaa-005','Pontual.');

    insertA.run('a1','p1',today,'09:00','Terapia cognitiva','Semanal','confirmed','meet.google.com/aaa-001');
    insertA.run('a2','p2',today,'11:30','Sessão inicial','Único','pending','meet.google.com/aaa-002');
    insertA.run('a3','p3',today,'14:00','Terapia familiar','Quinzenal','pending','meet.google.com/abc-xyz');
    insertA.run('a4','p4',today,'16:00','Terapia cognitiva','Semanal','confirmed','meet.google.com/aaa-004');
    insertA.run('a5','p5',today,'18:00','Psicanálise','Semanal','confirmed','meet.google.com/aaa-005');
  })();
  console.log('✅ Seed data inserted');
}

module.exports = db;
