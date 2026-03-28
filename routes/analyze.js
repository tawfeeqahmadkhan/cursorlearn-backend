const express = require('express');
const router = express.Router();

const { extractVideoId, getVideoMetadata } = require('../services/youtubeService');
const { fetchTranscript } = require('../services/apifyService');
const { analyzeTranscript, generateQuiz, generatePersonalizedSummary } = require('../services/claudeService');
const { findRelatedResources, findSimilarContent } = require('../services/exaService');
const VideoSession = require('../models/VideoSession');
const User = require('../models/User');

/**
 * POST /api/analyze
 * Main agentic route: Scrape → Summarize (Claude) → Enrich (Exa) → Store
 *
 * Body: { url: string, userId?: string }
 */
router.post('/', async (req, res) => {
  const { url, userId, category = 'learning' } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'YouTube URL is required' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (step, message, data = {}) => {
    res.write(`data: ${JSON.stringify({ step, message, ...data })}\n\n`);
  };

  try {
    // ── Step 1: Extract Video ID ──────────────────────────────────────
    let videoId;
    try {
      videoId = extractVideoId(url);
    } catch (err) {
      send('error', err.message);
      return res.end();
    }

    send(1, '🔍 Fetching video metadata...');

    // ── Step 2: Check cache ───────────────────────────────────────────
    const cached = await VideoSession.findOne({ videoId }).lean().catch(() => null);
    if (cached && cached.transcript && cached.summary) {
      // If user has a profile with interests/education, personalize the summary from cached transcript
      if (userId) {
        let cachedUserProfile = null;
        try {
          cachedUserProfile = await User.findById(userId)
            .select('name educationLevel englishLevel interests hobbies')
            .lean();
        } catch { /* ignore */ }

        const hasProfile = cachedUserProfile && (
          cachedUserProfile.interests?.length > 0 ||
          cachedUserProfile.hobbies?.length > 0 ||
          (cachedUserProfile.educationLevel && cachedUserProfile.educationLevel !== 'self-learner') ||
          (cachedUserProfile.englishLevel && cachedUserProfile.englishLevel !== 'intermediate')
        );

        if (hasProfile) {
          send(5, '✨ Personalizing summary for you...');
          try {
            const personalized = await generatePersonalizedSummary(
              cached.transcript, cached.videoTitle, cachedUserProfile
            );
            send(6, '⚡ Ready — personalized for you!', {
              session: { ...cached, category, summary: personalized.summary, visualNotes: personalized.visualNotes || cached.visualNotes },
            });
          } catch {
            send(6, '⚡ Loaded from cache!', { session: { ...cached, category } });
          }
          return res.end();
        }
      }

      send(6, '⚡ Loaded from cache!', { session: { ...cached, category } });
      return res.end();
    }

    // ── Step 3: Get YouTube metadata ──────────────────────────────────
    const metadata = await getVideoMetadata(videoId);
    send(2, `📺 Found: "${metadata.title}"`);

    // ── Step 4: Scrape transcript via Apify ───────────────────────────
    send(3, '📝 Scraping transcript with Apify...');
    const transcriptData = await fetchTranscript(url);

    if (!transcriptData.transcript || transcriptData.transcript.length < 50) {
      send('error', '⚠️  Transcript unavailable for this video (auto-captions may be disabled)');
      return res.end();
    }

    const title = metadata.title || transcriptData.videoTitle || 'Untitled Video';
    send(3, `✅ Transcript fetched (${transcriptData.transcript.length} chars)`);

    // ── Step 5: AI Analysis via Claude ────────────────────────────────
    // Fetch user profile for personalization
    let userProfile = null;
    if (userId) {
      try {
        userProfile = await User.findById(userId)
          .select('name educationLevel englishLevel interests hobbies')
          .lean();
      } catch { /* ignore */ }
    }

    send(4, '🤖 Analyzing with Claude AI...');
    const analysis = await analyzeTranscript(transcriptData.transcript, title, userProfile, category);

    send(4, '📋 Generating quiz questions with Claude...');
    const quizData = await generateQuiz(transcriptData.transcript, title, userProfile, category);

    // ── Step 6: Enrich with Exa related resources ─────────────────────
    send(5, '🔎 Finding related resources with Exa.ai...');
    const [relatedResources, similarContent] = await Promise.allSettled([
      findRelatedResources(title, analysis.topicTags || []),
      findSimilarContent(title, transcriptData.transcript),
    ]);

    // ── Step 7: Store in MongoDB ──────────────────────────────────────
    send(5, '💾 Saving to database...');

    const sessionData = {
      videoId,
      videoUrl: url,
      videoTitle: title,
      category,
      channelName: metadata.channelName || transcriptData.channelName || '',
      thumbnailUrl: metadata.thumbnailUrl || transcriptData.thumbnailUrl || '',
      duration: metadata.duration || transcriptData.duration || '',
      transcript: transcriptData.transcript,
      transcriptSegments: transcriptData.segments || [],
      prerequisiteKnowledge: analysis.prerequisiteKnowledge || '',
      learningRoadmap: analysis.learningRoadmap || [],
      summary: analysis.summary || '',
      visualNotes: analysis.visualNotes || '',
      keyConceptsMermaid: analysis.keyConceptsMermaid || '',
      topicTags: analysis.topicTags || [],
      quizQuestions: quizData.questions || [],
      relatedResources: relatedResources.status === 'fulfilled' ? relatedResources.value : [],
      similarContent: similarContent.status === 'fulfilled' ? similarContent.value : [],
      // Category-specific content from Claude
      ingredients: analysis.ingredients || [],
      warnings: analysis.warnings || [],
      toolsNeeded: analysis.toolsNeeded || [],
      safetyChecklist: analysis.safetyChecklist || [],
      categoryExamples: analysis.categoryExamples || [],
      userId: userId || null,
      isDemo: !!(transcriptData.isDemo || metadata.isDemo),
    };

    let session;
    try {
      session = await VideoSession.findOneAndUpdate(
        { videoId },
        sessionData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (dbErr) {
      console.warn('DB save skipped:', dbErr.message);
      session = sessionData;
    }

    send(6, '✅ Analysis complete!', { session });
    res.end();
  } catch (err) {
    console.error('Analyze error:', err);
    res.write(`data: ${JSON.stringify({ step: 'error', message: err.message })}\n\n`);
    res.end();
  }
});

/**
 * GET /api/analyze/:videoId — retrieve cached session
 */
router.get('/:videoId', async (req, res) => {
  try {
    const session = await VideoSession.findOne({ videoId: req.params.videoId }).lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
