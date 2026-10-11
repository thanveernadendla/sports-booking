const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { readDB } = require('../config/database');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Login required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired login' });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

const User = require('../models/User');

async function requireActiveCustomer(req, res, next) {
  const user = await User.findOne({ id: req.user.id, role: 'user' });
  if (!user) return res.status(403).json({ error: 'Customer account required' });
  if (['Rejected', 'Blocked'].includes(user.status)) return res.status(403).json({ error: 'Your account is not active. Please contact admin.' });
  req.customer = user;
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireActiveCustomer
};

