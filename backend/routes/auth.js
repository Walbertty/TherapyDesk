const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool } = require('../db');

function createMailer() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

const SALT_ROUNDS = 12;
const TOKEN_TTL = '7d';

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body ?? {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email e password sao obrigatorios' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Senha deve ter no minimo 8 caracteres' });
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name.trim(), email.toLowerCase().trim(), hash]
    );
    res.status(201).json({ token: signToken(rows[0]), user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email ja cadastrado' });
    console.error('[register]', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email e password sao obrigatorios' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    res.json({
      token: signToken(user),
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('[login]', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ error: 'E-mail e obrigatorio' });

  try {
    const { rows } = await pool.query('SELECT id, name FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (!rows[0]) return res.json({ message: 'Se o e-mail estiver cadastrado, recebera um link em breve.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query('DELETE FROM password_resets WHERE email = $1', [email.toLowerCase().trim()]);
    await pool.query(
      'INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)',
      [email.toLowerCase().trim(), token, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'https://therapy-desk-brown.vercel.app';
    const resetLink = `${frontendUrl}?reset=${token}`;

    const mailer = createMailer();
    await mailer.sendMail({
      from: `"TherapyDesk" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Redefinicao de senha - TherapyDesk',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#6B48E0;margin-bottom:8px">TherapyDesk</h2>
          <p>Ola, <strong>${rows[0].name}</strong>!</p>
          <p>Recebemos um pedido para redefinir a senha da sua conta.</p>
          <p style="margin:24px 0">
            <a href="${resetLink}"
               style="background:#6B48E0;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Redefinir senha
            </a>
          </p>
          <p style="color:#666;font-size:13px">Este link expira em <strong>1 hora</strong>.</p>
          <p style="color:#666;font-size:13px">Se nao solicitou a redefinicao, ignore este e-mail.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#999;font-size:12px">TherapyDesk - Agenda inteligente para terapeutas</p>
        </div>
      `,
    });

    res.json({ message: 'Se o e-mail estiver cadastrado, recebera um link em breve.' });
  } catch (err) {
    console.error('[forgot-password]', err.message);
    res.status(500).json({ error: 'Erro ao enviar e-mail. Verifique a configuracao do Gmail.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body ?? {};
  if (!token || !password) return res.status(400).json({ error: 'Token e password sao obrigatorios' });
  if (password.length < 8) return res.status(400).json({ error: 'Senha deve ter no minimo 8 caracteres' });

  try {
    const { rows } = await pool.query(
      'SELECT * FROM password_resets WHERE token = $1 AND used = FALSE AND expires_at > NOW()',
      [token]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Link invalido ou expirado. Solicite um novo.' });

    const hash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hash, rows[0].email]);
    await pool.query('UPDATE password_resets SET used = TRUE WHERE token = $1', [token]);

    res.json({ message: 'Senha redefinida com sucesso!' });
  } catch (err) {
    console.error('[reset-password]', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuario nao encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[auth/me]', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
