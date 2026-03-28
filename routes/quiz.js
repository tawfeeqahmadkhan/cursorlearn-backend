const express = require('express');
const router = express.Router();

const VideoSession = require('../models/VideoSession');
const User = require('../models/User');

/**
 * POST /api/quiz/submit
 * Submit quiz answers and calculate mastery score
 *
 * Body: { videoId, answers: [{ questionIndex, selectedAnswer }], userId? }
 */
router.post('/submit', async (req, res) => {
  const { videoId, answers, userId } = req.body;

  if (!videoId || !answers) {
    return res.status(400).json({ error: 'videoId and answers are required' });
  }

  try {
    let quizQuestions = [];
    let videoTitle = '';

    try {
      const session = await VideoSession.findOne({ videoId }).select('quizQuestions videoTitle').lean();
      if (session) {
        quizQuestions = session.quizQuestions;
        videoTitle = session.videoTitle;
      }
    } catch { /* DB might not be connected */ }

    // If DB unavailable, use submitted questions directly
    const questions = quizQuestions.length > 0 ? quizQuestions : (req.body.questions || []);

    if (questions.length === 0) {
      return res.status(400).json({ error: 'No quiz questions found' });
    }

    // Grade answers
    let correct = 0;
    const results = answers.map((ans, idx) => {
      const q = questions[ans.questionIndex !== undefined ? ans.questionIndex : idx];
      if (!q) return null;

      const isCorrect = q.correctAnswer === ans.selectedAnswer;
      if (isCorrect) correct++;

      return {
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        userAnswer: ans.selectedAnswer,
        isCorrect,
        explanation: q.explanation,
        topicTag: q.topicTag,
      };
    }).filter(Boolean);

    const masteryScore = Math.round((correct / results.length) * 100);

    // Identify weak spots (wrong answers)
    const weakSpots = results
      .filter((r) => !r.isCorrect)
      .map((r) => ({ topic: r.topicTag, question: r.question, videoId }));

    // Save results
    if (userId) {
      try {
        await User.findByIdAndUpdate(userId, {
          $push: {
            masteryScores: { videoId, videoTitle, score: masteryScore },
            weakSpots: { $each: weakSpots },
          },
        });
      } catch { /* ignore DB errors */ }
    }

    try {
      await VideoSession.findOneAndUpdate(
        { videoId },
        {
          quizResults: results,
          masteryScore,
        }
      );
    } catch { /* ignore DB errors */ }

    res.json({
      masteryScore,
      correct,
      total: results.length,
      results,
      weakSpots,
      message: getMasteryMessage(masteryScore),
    });
  } catch (err) {
    console.error('Quiz submit error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/quiz/:videoId
 * Get quiz questions for a video
 */
router.get('/:videoId', async (req, res) => {
  try {
    const session = await VideoSession.findOne({ videoId: req.params.videoId })
      .select('quizQuestions videoTitle')
      .lean();

    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Return questions without correct answers for the exam
    const sanitized = session.quizQuestions.map((q, idx) => ({
      index: idx,
      question: q.question,
      options: q.options,
      topicTag: q.topicTag,
    }));

    res.json({ questions: sanitized, videoTitle: session.videoTitle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getMasteryMessage(score) {
  if (score >= 90) return '🏆 Outstanding! You\'ve mastered this topic!';
  if (score >= 75) return '🎯 Great job! Strong understanding demonstrated.';
  if (score >= 60) return '📚 Good effort! Review the weak spots to improve.';
  if (score >= 40) return '💪 Keep going! Re-watch the key sections and try again.';
  return '🔄 Don\'t give up! Review the material and retake the quiz.';
}

module.exports = router;
