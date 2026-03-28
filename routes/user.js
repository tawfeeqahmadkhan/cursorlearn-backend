const express = require('express');
const router = express.Router();
const User = require('../models/User');

/**
 * POST /api/user — create or get user
 */
router.post('/', async (req, res) => {
  const { name, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    let user = email ? await User.findOne({ email }) : null;
    if (!user) {
      user = await User.create({ name, email });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/user/:id — get full profile
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/user/:id/session — log a study session
 * Body: { videoId, videoTitle, thumbnailUrl, topicTags, durationSeconds, tabsVisited }
 */
router.post('/:id/session', async (req, res) => {
  const { videoId, videoTitle, thumbnailUrl, topicTags, durationSeconds, tabsVisited } = req.body;

  try {
    // Check if session already exists for this video today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Update or add session
    const existingIdx = user.studySessions.findIndex(
      (s) => s.videoId === videoId && new Date(s.startedAt) >= today
    );

    if (existingIdx >= 0) {
      user.studySessions[existingIdx].durationSeconds = Math.max(
        user.studySessions[existingIdx].durationSeconds,
        durationSeconds || 0
      );
      if (tabsVisited) {
        const existing = new Set(user.studySessions[existingIdx].tabsVisited);
        tabsVisited.forEach((t) => existing.add(t));
        user.studySessions[existingIdx].tabsVisited = Array.from(existing);
      }
    } else {
      user.studySessions.push({ videoId, videoTitle, thumbnailUrl, topicTags, durationSeconds, tabsVisited });
    }

    // Update streak
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate) : null;

    if (!lastActive || lastActive < yesterday) {
      user.streak = lastActive && lastActive >= yesterday ? user.streak + 1 : 1;
    }
    user.lastActiveDate = new Date();

    await user.save();
    res.json({ success: true, streak: user.streak });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/user/:id/dashboard — dashboard stats
 */
router.get('/:id/dashboard', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Aggregate time per topic
    const topicTime = {};
    user.studySessions.forEach((s) => {
      (s.topicTags || []).forEach((tag) => {
        topicTime[tag] = (topicTime[tag] || 0) + (s.durationSeconds || 0);
      });
    });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivity = user.studySessions
      .filter((s) => new Date(s.startedAt) >= sevenDaysAgo)
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    res.json({
      user: {
        name: user.name,
        email: user.email,
        streak: user.streak,
        averageMastery: user.averageMastery,
        totalVideosStudied: user.totalVideosStudied,
        totalStudyTimeSeconds: user.totalStudyTimeSeconds,
      },
      masteryScores: user.masteryScores.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)),
      weakSpots: user.weakSpots,
      topicTime,
      recentActivity,
      studySessions: user.studySessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
