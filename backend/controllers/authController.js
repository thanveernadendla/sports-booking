const User = require('../models/User');
const { normalizePhone, publicUser, signUser, getNextId } = require('../utils/helpers');

async function register(req, res) {
  const phone = normalizePhone(req.body.phone);
  const { password, name } = req.body;
  if (!phone || phone.length !== 10 || !password || !name) {
    return res.status(400).json({ error: 'Name, 10 digit mobile number, and password are required' });
  }

  const existing = await User.findOne({ phone, role: 'user' });
  if (existing) {
    return res.status(400).json({ error: 'An account already exists with this mobile number' });
  }

  const id = await getNextId(User);
  const user = await User.create({ id, phone, password, name, role: 'user', status: 'Approved' });
  res.status(201).json({ token: signUser(user), message: 'Registration complete. You can book slots now.', user: publicUser(user) });
}

async function login(req, res) {
  const phone = normalizePhone(req.body.phone);
  const { password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Mobile number and password are required' });

  const user = await User.findOne({ role: 'user', phone, password });
  if (!user) return res.status(401).json({ error: 'Invalid mobile number or password' });
  if (['Rejected', 'Blocked'].includes(user.status)) return res.status(403).json({ error: `Your account is ${user.status}. Please contact admin.` });

  res.json({ token: signUser(user), user: publicUser(user) });
}

async function adminLogin(req, res) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username/phone and password are required' });
  const phone = normalizePhone(username);
  const orConditions = [{ username }];
  if (phone && phone.length === 10) {
    orConditions.push({ phone });
  }

  const admin = await User.findOne({
    role: 'admin',
    password,
    $or: orConditions
  });
  if (!admin) return res.status(401).json({ error: 'Invalid admin login' });
  res.json({ token: signUser(admin), user: publicUser(admin) });
}


async function getMe(req, res) {
  const user = await User.findOne({ id: req.user.id });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
}

module.exports = {
  register,
  login,
  adminLogin,
  getMe
};

