const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme_in_env';

function _pick(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    educationLevel: user.educationLevel,
    englishLevel: user.englishLevel,
    interests: user.interests,
    hobbies: user.hobbies,
  };
}

/**
 * POST /api/auth/register
 * Body: { name, email, password }
 */
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email, and password are required' });

  const { educationLevel, englishLevel, interests, hobbies } = req.body;

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      educationLevel: educationLevel || 'self-learner',
      englishLevel: englishLevel || 'intermediate',
      interests: interests || [],
      hobbies: hobbies || [],
    });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: _pick(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });

  try {
    const user = await User.findOne({ email });
    if (!user || !user.passwordHash)
      return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: _pick(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
