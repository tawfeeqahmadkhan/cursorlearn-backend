const mongoose = require('mongoose');

const masteryScoreSchema = new mongoose.Schema({
  videoId: String,
  videoTitle: String,
  thumbnailUrl: String,
  topicTags: [String],
  score: { type: Number, min: 0, max: 100 },
  timeSpentSeconds: { type: Number, default: 0 },
  completedAt: { type: Date, default: Date.now },
});

const weakSpotSchema = new mongoose.Schema({
  topic: String,
  videoId: String,
  videoTitle: String,
  question: String,
  timestamp: { type: Date, default: Date.now },
});

const studySessionSchema = new mongoose.Schema({
  videoId: String,
  videoTitle: String,
  thumbnailUrl: String,
  topicTags: [String],
  startedAt: { type: Date, default: Date.now },
  durationSeconds: { type: Number, default: 0 },
  tabsVisited: [String], // ['notes', 'roadmap', 'chat', 'quiz']
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    passwordHash: { type: String },
    educationLevel: { type: String, default: 'self-learner' },
    englishLevel: { type: String, default: 'intermediate' },
    interests: [{ type: String }],
    hobbies: [{ type: String }],
    masteryScores: [masteryScoreSchema],
    weakSpots: [weakSpotSchema],
    pastQuestions: [
      {
        videoId: String,
        question: String,
        answer: String,
        askedAt: { type: Date, default: Date.now },
      },
    ],
    studySessions: [studySessionSchema],
    totalVideosStudied: { type: Number, default: 0 },
    totalStudyTimeSeconds: { type: Number, default: 0 },
    averageMastery: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastActiveDate: Date,
  },
  { timestamps: true }
);

// Recalculate stats before saving
userSchema.pre('save', function (next) {
  if (this.masteryScores.length > 0) {
    const total = this.masteryScores.reduce((sum, s) => sum + s.score, 0);
    this.averageMastery = Math.round(total / this.masteryScores.length);
    this.totalVideosStudied = this.masteryScores.length;
  }
  if (this.studySessions.length > 0) {
    this.totalStudyTimeSeconds = this.studySessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
