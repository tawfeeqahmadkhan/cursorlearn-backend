require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const analyzeRouter = require('./routes/analyze');
const authRouter = require('./routes/auth');
const chatRouter = require('./routes/chat');
const quizRouter = require('./routes/quiz');
const userRouter = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cursorstudy')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.log('⚠️  MongoDB connection failed (running without DB):', err.message));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/chat', chatRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/user', userRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'CursorStudy API is running',
    timestamp: new Date().toISOString(),
    demo: process.env.OPENAI_API_KEY?.startsWith('sk-demo'),
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 CursorStudy backend running on http://localhost:${PORT}`);
  console.log(`📋 Demo mode: ${process.env.OPENAI_API_KEY?.startsWith('sk-demo') ? 'ON (add real keys to .env)' : 'OFF'}`);
});
