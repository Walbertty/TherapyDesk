const jwt = require('jsonwebtoken');

/**
 * Verifica o token JWT no header Authorization: Bearer <token>
 * Em caso de sucesso, injeta req.user = { id, email }
 */
module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação obrigatório' });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};
