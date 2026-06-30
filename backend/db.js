require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Prevent idle connection timeouts from crashing the process
pool.on('error', (err) => {
  console.error('[db] pool error (idle client):', err.message);
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS patients (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      therapist_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      country       TEXT NOT NULL DEFAULT 'BR',
      city          TEXT,
      whatsapp      TEXT NOT NULL,
      email         TEXT,
      value         TEXT,
      payment       TEXT,
      meet          TEXT,
      notes         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      therapist_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      date          DATE NOT NULL,
      time          TIME NOT NULL,
      type          TEXT,
      freq          TEXT DEFAULT 'Semanal',
      status        TEXT DEFAULT 'pending',
      meet          TEXT,
      notes         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
      therapist_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key           TEXT NOT NULL,
      value         TEXT,
      PRIMARY KEY (therapist_id, key)
    );

    CREATE INDEX IF NOT EXISTS idx_apts_date       ON appointments(date);
    CREATE INDEX IF NOT EXISTS idx_apts_patient    ON appointments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_apts_therapist  ON appointments(therapist_id);
    CREATE INDEX IF NOT EXISTS idx_patients_therapist ON patients(therapist_id);

    CREATE TABLE IF NOT EXISTS password_resets (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       TEXT NOT NULL,
      token       TEXT NOT NULL UNIQUE,
      expires_at  TIMESTAMPTZ NOT NULL,
      used        BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_reset_token ON password_resets(token);
  `);

  // Colunas adicionais (ALTER seguro, ignora se ja existirem)
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rem_sent_24h BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rem_sent_1h  BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS paid         BOOLEAN DEFAULT FALSE`);

  console.log('Schema OK');
}

module.exports = { pool, initSchema };
