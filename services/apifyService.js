const axios = require('axios');

const APIFY_BASE = 'https://api.apify.com/v2';
const TOKEN = process.env.APIFY_API_TOKEN;
const ACTOR_ID = process.env.APIFY_ACTOR_ID || 'streamers~youtube-scraper';

const isDemoToken = !TOKEN || TOKEN.startsWith('apify_demo');

/**
 * Fetch YouTube transcript + metadata via Apify actor.
 * Supports: streamers~youtube-scraper, pintostudio/youtube-transcript-scraper
 */
async function fetchTranscript(videoUrl) {
  if (isDemoToken) {
    console.log('⚠️  Apify demo mode — returning mock transcript');
    return getMockTranscript(videoUrl);
  }

  try {
    const response = await axios.post(
      `${APIFY_BASE}/acts/${encodeURIComponent(ACTOR_ID)}/run-sync-get-dataset-items`,
      {
        startUrls: [{ url: videoUrl }],
        maxResults: 1,
        subtitlesLanguage: 'en',
      },
      {
        params: { token: TOKEN },
        timeout: 180000,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const items = response.data;
    if (!items || items.length === 0) {
      throw new Error('Apify returned no results for this video');
    }

    return normalizeActorOutput(items[0]);
  } catch (err) {
    console.error('Apify error:', err.response?.data || err.message);
    throw new Error(`Transcript fetch failed: ${err.message}`);
  }
}

/**
 * Normalize different Apify actor output shapes into one consistent format.
 */
function normalizeActorOutput(item) {
  let segments = [];
  let fullTranscript = '';

  // ── streamers~youtube-scraper ──────────────────────────────
  if (item.subtitles && Array.isArray(item.subtitles)) {
    segments = item.subtitles.map(s => ({
      text: s.text || '',
      start: s.offset ?? s.start ?? 0,
      duration: s.duration ?? 0,
    }));
    fullTranscript = segments.map(s => s.text).join(' ');
  }

  // ── pintostudio/youtube-transcript-scraper ─────────────────
  else if (item.transcript && Array.isArray(item.transcript)) {
    segments = item.transcript.map(s => ({
      text: s.text || s.content || '',
      start: s.start ?? s.offset ?? 0,
      duration: s.duration ?? s.dur ?? 0,
    }));
    fullTranscript = segments.map(s => s.text).join(' ');
  }

  // ── captions field ─────────────────────────────────────────
  else if (item.captions && Array.isArray(item.captions)) {
    segments = item.captions.map(c => ({
      text: c.text || '',
      start: c.startTime ?? c.start ?? 0,
      duration: c.duration ?? 0,
    }));
    fullTranscript = segments.map(s => s.text).join(' ');
  }

  // ── plain text fallback ────────────────────────────────────
  else if (typeof item.text === 'string') {
    fullTranscript = item.text;
  }

  // ── description fallback (last resort) ────────────────────
  else if (typeof item.description === 'string' && item.description.length > 200) {
    fullTranscript = item.description;
    console.warn('⚠️  No transcript found — using video description as fallback');
  }

  if (!fullTranscript.trim()) {
    throw new Error('No transcript or subtitles found for this video. Auto-captions may be disabled.');
  }

  return {
    transcript: fullTranscript.trim(),
    segments,
    videoTitle:   item.title       ?? item.videoTitle   ?? '',
    channelName:  item.channelName ?? item.author        ?? item.channel ?? '',
    thumbnailUrl: item.thumbnailUrl ?? item.thumbnail    ?? '',
    duration:     item.duration    ?? item.lengthSeconds ?? '',
    viewCount:    item.viewCount   ?? item.views         ?? '',
  };
}

// ── Mock data ──────────────────────────────────────────────────
function getMockTranscript(videoUrl) {
  const videoId = videoUrl.match(/[?&v=]([a-zA-Z0-9_-]{11})/)?.[1] || 'demo';
  return {
    transcript: `Welcome to this comprehensive tutorial on machine learning fundamentals.
Today we'll explore the core concepts that power modern AI systems.
Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed for every task.
There are three main types: supervised learning uses labeled data, unsupervised learning finds hidden patterns, and reinforcement learning trains agents with rewards.
Neural networks are inspired by the human brain, consisting of layers of interconnected nodes called neurons.
Each connection has a weight that gets adjusted during training through a process called backpropagation.
Deep learning refers to neural networks with many hidden layers, enabling complex pattern recognition.
Key applications include image recognition, natural language processing, and recommendation systems.
Always split your data into training, validation, and test sets to prevent overfitting.
The learning rate, batch size, and architecture are the most important hyperparameters to tune.`,
    segments: [
      { text: 'Welcome to this comprehensive tutorial.', start: 0, duration: 4 },
      { text: 'Machine learning enables computers to learn from data.', start: 4, duration: 5 },
      { text: 'Three main types: supervised, unsupervised, reinforcement.', start: 9, duration: 6 },
      { text: 'Neural networks are inspired by the human brain.', start: 15, duration: 5 },
    ],
    videoTitle:   'Machine Learning Fundamentals — Complete Tutorial',
    channelName:  'TechEdu Pro',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    duration:     '45:32',
    viewCount:    '1250000',
    isDemo:       true,
  };
}

module.exports = { fetchTranscript };
