const mongoose = require('mongoose');

const quizResultSchema = new mongoose.Schema({
  question: String,
  options: [String],
  correctAnswer: String,
  userAnswer: String,
  isCorrect: Boolean,
  explanation: String,
  topicTag: String,
});

const roadmapItemSchema = new mongoose.Schema({
  title: String,
  description: String,
  timestamp: String,
  duration: String,
  order: Number,
});

const resourceSchema = new mongoose.Schema({
  title: String,
  url: String,
  summary: String,
  publishedDate: String,
  score: Number,
});

const videoSessionSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true, index: true },
    videoUrl: String,
    videoTitle: String,
    channelName: String,
    thumbnailUrl: String,
    duration: String,
    topicTags: [String],

    // Raw transcript from Apify
    transcript: { type: String, default: '' },
    transcriptSegments: [
      {
        text: String,
        start: Number,
        duration: Number,
      },
    ],

    // AI-generated content (Claude)
    prerequisiteKnowledge: { type: String, default: '' },
    learningRoadmap: [roadmapItemSchema],
    summary: { type: String, default: '' },
    visualNotes: { type: String, default: '' },
    keyConceptsMermaid: { type: String, default: '' },

    // Related resources from Exa
    relatedResources: [resourceSchema],
    similarContent: [resourceSchema],

    // Quiz (Claude-generated)
    quizQuestions: [
      {
        question: String,
        options: [String],
        correctAnswer: String,
        explanation: String,
        topicTag: String,
      },
    ],
    quizResults: [quizResultSchema],
    masteryScore: { type: Number, default: 0 },

    // Category & category-specific content
    category: { type: String, default: 'learning' },

    // Cooking
    ingredients: [{
      name: String, amount: String, unit: String,
      mandatory: Boolean, substitute: String, notes: String,
    }],

    // Fixing / DIY
    warnings: [{ level: String, title: String, description: String }],
    toolsNeeded: [String],
    safetyChecklist: [String],

    // Learning — personalized examples
    categoryExamples: [{ concept: String, interestExample: String, explanation: String }],

    // Meta
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    processedAt: { type: Date, default: Date.now },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VideoSession', videoSessionSchema);
