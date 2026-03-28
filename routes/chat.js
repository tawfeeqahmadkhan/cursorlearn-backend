const express = require('express');
const router = express.Router();

const { answerQuestion, answerGeneralQuestion } = require('../services/claudeService');
const { findRelatedResources } = require('../services/exaService');
const VideoSession = require('../models/VideoSession');
const User = require('../models/User');

/**
 * POST /api/chat
 * Doubt Resolver — Claude answers using transcript context
 * Optionally enriches with Exa search for complex questions
 *
 * Body: { question, videoId, userId?, chatHistory? }
 */
router.post('/', async (req, res) => {
  const { question, videoId, userId, chatHistory = [], general = false } = req.body;

  if (!question || !videoId) {
    return res.status(400).json({ error: 'question and videoId are required' });
  }

  try {
    // Fetch user profile for personalization
    let userProfile = null;
    if (userId) {
      try {
        userProfile = await User.findById(userId)
          .select('name educationLevel englishLevel interests hobbies')
          .lean();
      } catch { /* ignore */ }
    }

    // ── General / Fact Search mode ────────────────────────────────
    if (general) {
      const resources = await findRelatedResources(question, []).catch(() => []);
      const answer = await answerGeneralQuestion(question, resources, userProfile, chatHistory);
      return res.json({ answer, resources, videoId, isGeneral: true });
    }

    // ── Video Doubt mode ─────────────────────────────────────────
    let transcript = '';
    let videoTitle = '';

    try {
      const session = await VideoSession.findOne({ videoId })
        .select('transcript videoTitle')
        .lean();
      if (session) {
        transcript = session.transcript;
        videoTitle = session.videoTitle;
      }
    } catch { /* DB might not be connected */ }

    const answer = await answerQuestion(question, transcript, videoTitle, chatHistory, userProfile);

    // Optionally enrich with Exa for resource requests
    const wantsResources = /more resource|further reading|where (can|should) I|recommend|learn more/i.test(question);
    let resources = [];
    if (wantsResources) {
      resources = await findRelatedResources(question, []).catch(() => []);
    }

    if (userId) {
      try {
        await User.findByIdAndUpdate(userId, {
          $push: { pastQuestions: { videoId, question, answer } },
        });
      } catch { /* ignore */ }
    }

    res.json({ answer, resources, videoId });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
