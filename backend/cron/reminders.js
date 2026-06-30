const cron = require('node-cron');
const { pool } = require('../db');
const nodemailer = require('nodemailer');

function createMailer() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

async function sendEmail(to, subject, html) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;
  try {
    await createMailer().sendMail({
      from: `"TherapyDesk" <${process.env.GMAIL_USER}>`,
      to, subject, html,
    });
    console.log(`[cron] email ${subject} -> ${to}`);
  } catch (err) {
    console.error('[cron] Erro e-mail:', err.message);
  }
}

async function getSettings(therapistId) {
  const { rows } = await pool.query(
    'SELECT key, value FROM settings WHERE therapist_id=$1',
    [therapistId]
  );
  const s = {};
  rows.forEach(r => { try { s[r.key] = JSON.parse(r.value); } catch { s[r.key] = r.value; } });
  return s;
}

// Whitelist para evitar SQL injection em sentCol
const ALLOWED_SENT_COLS = new Set(['rem_sent_24h', 'rem_sent_1h']);

async function sendPatientReminders(hoursAhead, settingKey, sentCol) {
  if (!ALLOWED_SENT_COLS.has(sentCol)) {
    console.error('[cron] sentCol invalido:', sentCol);
    return;
  }
  const now = new Date();
  const targetMs = now.getTime() + hoursAhead * 60 * 60 * 1000;
  const windowMs = 20 * 60 * 1000;

  const { rows } = await pool.query(`
    SELECT
      a.id, a.therapist_id, a.date, a.time, a.type, a.meet, a.notes, a.status,
      p.name  AS patient_name,
      p.email AS patient_email,
      p.country,
      u.name  AS therapist_name,
      u.email AS therapist_email
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN users   u ON u.id = a.therapist_id
    WHERE a.status NOT IN ('cancelled')
      AND a.${sentCol} = FALSE
      AND (a.date + a.time) AT TIME ZONE 'Europe/Lisbon' AT TIME ZONE 'UTC'
          BETWEEN $1 AND $2
  `, [
    new Date(targetMs - windowMs).toISOString(),
    new Date(targetMs + windowMs).toISOString(),
  ]);

  for (const apt of rows) {
    const settings = await getSettings(apt.therapist_id);
    if (!settings[settingKey]) continue;

    if (apt.patient_email) {
      const label = hoursAhead >= 24 ? '24 horas' : '1 hora';
      const dateFmt = new Date(apt.date).toLocaleDateString('pt-PT', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
      const timeFmt = String(apt.time).slice(0, 5);

      await sendEmail(
        apt.patient_email,
        `Lembrete: consulta em ${label} - ${apt.therapist_name}`,
        `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#6B48E0;margin-bottom:4px">TherapyDesk</h2>
          <p>Ola! Este e um lembrete da sua consulta.</p>
          <div style="background:#F3F0FF;padding:16px;border-radius:8px;margin:16px 0">
            <p style="margin:0"><strong>Terapeuta:</strong> ${apt.therapist_name}</p>
            <p style="margin:8px 0 0"><strong>Data:</strong> ${dateFmt}</p>
            <p style="margin:8px 0 0"><strong>Horario:</strong> ${timeFmt}</p>
            ${apt.type ? `<p style="margin:8px 0 0"><strong>Tipo:</strong> ${apt.type}</p>` : ''}
            ${apt.meet ? `<p style="margin:8px 0 0"><strong>Link:</strong> <a href="${apt.meet}">${apt.meet}</a></p>` : ''}
          </div>
          <p style="color:#666;font-size:13px">Se precisar remarcar, entre em contato com a sua terapeuta.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
          <p style="color:#999;font-size:12px">TherapyDesk - Agenda inteligente para terapeutas</p>
        </div>`
      );
    }

    await pool.query(`UPDATE appointments SET ${sentCol}=TRUE WHERE id=$1`, [apt.id]);
  }
}

async function sendPaymentAlerts() {
  const { rows: therapists } = await pool.query('SELECT id, email, name FROM users');

  for (const therapist of therapists) {
    const settings = await getSettings(therapist.id);
    if (!settings.remPayment) continue;

    const { rows: apts } = await pool.query(`
      SELECT a.date, a.time, a.type,
             p.name AS patient_name, p.value AS session_value, p.payment AS payment_method
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      WHERE a.therapist_id = $1
        AND a.status = 'confirmed'
        AND a.date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE - 1
      ORDER BY a.date DESC, a.time
    `, [therapist.id]);

    if (apts.length === 0) continue;

    const tableRows = apts.map(a => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${a.patient_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${String(a.date).slice(0, 10)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${String(a.time).slice(0, 5)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${a.session_value || '-'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${a.payment_method || '-'}</td>
      </tr>`).join('');

    await sendEmail(
      therapist.email,
      `Resumo de pagamentos - ${apts.length} consulta(s) esta semana`,
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#6B48E0">TherapyDesk - Pagamentos</h2>
        <p>Ola, <strong>${therapist.name}</strong>! Consultas realizadas nos ultimos 7 dias:</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px">
          <thead>
            <tr style="background:#F3F0FF;text-align:left">
              <th style="padding:8px 12px">Paciente</th>
              <th style="padding:8px 12px">Data</th>
              <th style="padding:8px 12px">Hora</th>
              <th style="padding:8px 12px">Valor</th>
              <th style="padding:8px 12px">Pagamento</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <p style="color:#666;font-size:13px;margin-top:16px">Verifique os pagamentos no TherapyDesk.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="color:#999;font-size:12px">TherapyDesk - Agenda inteligente para terapeutas</p>
      </div>`
    );
  }
}

async function resetReminderFlags(appointmentId) {
  await pool.query(
    'UPDATE appointments SET rem_sent_24h=FALSE, rem_sent_1h=FALSE WHERE id=$1',
    [appointmentId]
  );
}

function startCronJobs() {
  cron.schedule('*/30 * * * *', () =>
    sendPatientReminders(24, 'rem24h', 'rem_sent_24h').catch(console.error)
  );

  cron.schedule('*/15 * * * *', () =>
    sendPatientReminders(1, 'rem1h', 'rem_sent_1h').catch(console.error)
  );

  cron.schedule('0 8 * * *', () =>
    sendPaymentAlerts().catch(console.error)
  );

  console.log('Cron jobs de lembretes iniciados');
}

module.exports = { startCronJobs, resetReminderFlags };
