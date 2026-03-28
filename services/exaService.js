// Exa.ai - Semantic Search API
// Redeem $50 credits: https://dashboard.exa.ai/billing with code EXA50CURSORKASHMIR
const ExaModule = require('exa-js');
const Exa = ExaModule.default || ExaModule;

const isDemoKey = !process.env.EXA_API_KEY || process.env.EXA_API_KEY.startsWith('exa-demo');

const exa = isDemoKey ? null : new Exa(process.env.EXA_API_KEY);

/**
 * Search for related learning resources using Exa's semantic search
 * @param {string} topic - Topic or keywords from the video
 * @param {string[]} tags - Topic tags from analysis
 * @returns {Array} Related resources
 */
async function findRelatedResources(topic, tags = []) {
  if (isDemoKey) {
    console.log('⚠️  Exa demo mode - returning mock resources');
    return getMockResources(topic);
  }

  try {
    const query = tags.length > 0
      ? `${topic} tutorial guide ${tags.slice(0, 3).join(' ')}`
      : `${topic} complete beginner tutorial`;

    const result = await exa.searchAndContents(query, {
      numResults: 5,
      type: 'neural',
      useAutoprompt: true,
      includeDomains: [
        'medium.com', 'dev.to', 'towardsdatascience.com',
        'github.com', 'docs.python.org', 'freecodecamp.org',
        'developer.mozilla.org', 'w3schools.com', 'realpython.com',
      ],
      contents: {
        summary: true,
        highlights: {
          numSentences: 2,
          highlightsPerUrl: 1,
        },
      },
    });

    return result.results.map((r) => ({
      title: r.title || 'Resource',
      url: r.url,
      summary: r.summary || r.highlights?.[0] || '',
      publishedDate: r.publishedDate,
      score: r.score,
    }));
  } catch (err) {
    console.error('Exa search error:', err.message);
    return getMockResources(topic);
  }
}

/**
 * Search for similar YouTube videos / courses
 */
async function findSimilarContent(videoTitle, transcript = '') {
  if (isDemoKey) {
    return getMockSimilarContent();
  }

  try {
    const snippet = transcript.slice(0, 500);
    const query = `learn ${videoTitle} course tutorial ${snippet.slice(0, 100)}`;

    const result = await exa.search(query, {
      numResults: 4,
      type: 'neural',
      useAutoprompt: true,
      includeDomains: [
        'youtube.com', 'udemy.com', 'coursera.org',
        'edx.org', 'khanacademy.org', 'pluralsight.com',
      ],
    });

    return result.results.map((r) => ({
      title: r.title || 'Course',
      url: r.url,
      publishedDate: r.publishedDate,
    }));
  } catch (err) {
    console.error('Exa similar content error:', err.message);
    return getMockSimilarContent();
  }
}

// ─── Mock data ─────────────────────────────────────────────────────────────

function getMockResources(topic) {
  return [
    {
      title: 'A Beginner\'s Guide to Machine Learning with Python',
      url: 'https://realpython.com/python-machine-learning',
      summary: 'Comprehensive guide covering ML fundamentals with hands-on Python examples and practical projects.',
      publishedDate: '2024-01-10',
      score: 0.95,
    },
    {
      title: 'Neural Networks from Scratch — Towards Data Science',
      url: 'https://towardsdatascience.com/neural-networks-from-scratch',
      summary: 'Step-by-step walkthrough of building neural networks without frameworks to understand the math.',
      publishedDate: '2023-11-20',
      score: 0.92,
    },
    {
      title: 'Understanding Backpropagation — freeCodeCamp',
      url: 'https://freecodecamp.org/news/backpropagation-explained',
      summary: 'Visual explanation of backpropagation and gradient descent with interactive examples.',
      publishedDate: '2024-02-05',
      score: 0.89,
    },
    {
      title: 'Machine Learning Cheatsheet — GitHub',
      url: 'https://github.com/soulmachine/machine-learning-cheat-sheet',
      summary: 'Quick reference for ML algorithms, formulas, and key concepts in a concise format.',
      publishedDate: '2023-08-15',
      score: 0.87,
    },
    {
      title: 'Practical Deep Learning for Coders — fast.ai',
      url: 'https://course.fast.ai',
      summary: 'Top-down practical approach to deep learning, used by thousands of practitioners worldwide.',
      publishedDate: '2024-01-01',
      score: 0.85,
    },
  ];
}

function getMockSimilarContent() {
  return [
    { title: 'Machine Learning Full Course — Coursera', url: 'https://coursera.org/learn/machine-learning', publishedDate: '2024-01-01' },
    { title: 'Neural Networks and Deep Learning — deeplearning.ai', url: 'https://coursera.org/learn/neural-networks-deep-learning', publishedDate: '2023-06-01' },
    { title: 'Intro to ML — Khan Academy', url: 'https://khanacademy.org/computing/ap-computer-science-principles', publishedDate: '2023-09-01' },
    { title: 'PyTorch for Deep Learning — Udemy', url: 'https://udemy.com/course/pytorch-for-deep-learning', publishedDate: '2024-02-01' },
  ];
}

module.exports = { findRelatedResources, findSimilarContent };
