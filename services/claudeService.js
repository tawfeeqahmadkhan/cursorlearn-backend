const OpenAI = require('openai');

const isDemoKey = !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-demo');

const openai = isDemoKey ? null : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = 'gpt-4o';

// ── User profile context builder ──────────────────────────────────
function buildProfileContext(userProfile) {
  if (!userProfile) return '';

  const allInterests = [
    ...(userProfile.interests || []),
    ...(userProfile.hobbies || []),
  ].filter(Boolean);

  const edu = userProfile.educationLevel || 'self-learner';
  const eng = userProfile.englishLevel || 'intermediate';

  const educationInstructions = {
    'middle-school':   'Use very simple language. Avoid jargon. Explain every term. Short sentences.',
    'high-school':     'Use simple, clear language. Brief definitions for technical terms.',
    'undergraduate':   'University-level explanations. Assume some domain knowledge.',
    'graduate':        'Graduate-level depth. Technical precision is fine.',
    'phd':             'Research-level rigor. Assume deep expertise.',
    'professional':    'Professional tone, practical focus, real-world applications.',
    'self-learner':    'Clear, friendly language. Explain concepts step by step.',
  };

  const englishInstructions = {
    'basic':       'Use only simple, common English words. Very short sentences. Avoid idioms.',
    'intermediate':'Normal vocabulary. Define any complex or technical words.',
    'advanced':    'Rich vocabulary is fine. No need to over-explain English.',
    'native':      'Any vocabulary, idiomatic expressions, and nuance are fine.',
  };

  const interestLine = allInterests.length > 0
    ? `STUDENT INTERESTS: ${allInterests.join(', ')}
CRITICAL INSTRUCTION: You MUST use real, concrete examples from the student's interests to explain every major concept.
For example — if the concept is Newton's 3rd Law and the student likes Cricket:
  ✅ Good: "When a cricket bat hits the ball, the bat pushes the ball forward (action force) — and the ball pushes back on the bat with equal force (reaction force). That's why your hands sting when you mishit!"
  ❌ Bad: "For every action there is an equal and opposite reaction."
Always connect the concept to ${allInterests.slice(0, 3).join(', ')} before giving the formal definition.`
    : '';

  return `
=== PERSONALIZATION (MANDATORY — follow strictly) ===
EDUCATION LEVEL: ${edu} → ${educationInstructions[edu] || educationInstructions['self-learner']}
ENGLISH LEVEL: ${eng} → ${englishInstructions[eng] || englishInstructions['intermediate']}
${interestLine}
=== END PERSONALIZATION ===`;
}

// ── Category-specific prompt additions ───────────────────────────
function getCategorySchema(category) {
  if (category === 'cooking') {
    return `
  "ingredients": [
    {
      "name": "ingredient name",
      "amount": "quantity e.g. '2', '1/2', 'a handful'",
      "unit": "cups/tbsp/kg/pieces/'' if none",
      "mandatory": true or false (false = optional/garnish/to taste),
      "substitute": "alternative if mentioned, else null",
      "notes": "prep note like 'chopped' or 'room temperature', else null"
    }
  ]`;
  }
  if (category === 'fixing') {
    return `
  "warnings": [
    {
      "level": "danger" (life-threatening) | "warning" (injury risk) | "caution" (minor risk),
      "title": "short title e.g. Electric Shock",
      "description": "clear explanation + how to stay safe"
    }
  ],
  "toolsNeeded": ["tool1", "tool2"],
  "safetyChecklist": ["do this before starting 1", "step 2"]`;
  }
  if (category === 'learning') {
    return `
  "categoryExamples": [
    {
      "concept": "key concept from the video",
      "interestExample": "vivid concrete example — MUST reference the student interests listed above",
      "explanation": "1-2 sentences why this example illustrates the concept"
    }
  ]`;
  }
  return '';
}

function getCategoryInstruction(category) {
  if (category === 'cooking') {
    return 'Extract EVERY ingredient mentioned — exact amounts, units, and whether each is mandatory or optional.';
  }
  if (category === 'fixing') {
    return 'Identify ALL safety hazards, required tools, and pre-start safety steps. Be thorough — user safety depends on this.';
  }
  if (category === 'learning') {
    return 'Create 3-5 concept examples that MUST use the student\'s specific interests for analogies. Generic examples are not acceptable.';
  }
  return '';
}

/**
 * Generate full study analysis from transcript
 */
async function analyzeTranscript(transcript, videoTitle = '', userProfile = null, category = 'learning') {
  if (isDemoKey) {
    console.log('⚠️  OpenAI demo mode — returning mock analysis');
    return getMockAnalysis(videoTitle);
  }

  const profileCtx = buildProfileContext(userProfile);
  const categorySchema = getCategorySchema(category);
  const categoryInstruction = getCategoryInstruction(category);

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 4500,
    messages: [
      {
        role: 'user',
        content: `You are an expert educator. Analyze this video transcript and return a personalized JSON study guide.

Video Title: "${videoTitle}"
Video Category: ${category}
${profileCtx}
${categoryInstruction ? `\nCATEGORY TASK: ${categoryInstruction}` : ''}

Transcript: ${transcript.slice(0, 12000)}

Return exactly this JSON shape:
{
  "prerequisiteKnowledge": "markdown list of what to know before watching",
  "learningRoadmap": [{ "title": "", "description": "", "timestamp": "00:00", "duration": "~5 min", "order": 1 }],
  "summary": "comprehensive markdown summary (400-600 words) — personalized to student's level and interests",
  "visualNotes": "key concepts as markdown with tables, code blocks, bullet points — adapted to student's level",
  "keyConceptsMermaid": "mermaid mindmap or graph TD diagram of main concepts",
  "topicTags": ["tag1", "tag2", "tag3"]${categorySchema ? `,${categorySchema}` : ''}
}`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Generate 5 quiz questions from transcript
 */
async function generateQuiz(transcript, videoTitle = '', userProfile = null, category = 'learning') {
  if (isDemoKey) return getMockQuiz();

  const profileCtx = buildProfileContext(userProfile);

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.5,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Generate exactly 5 multiple-choice quiz questions for this video.
${profileCtx}
Video: "${videoTitle}"
Transcript: ${transcript.slice(0, 8000)}

Return JSON:
{
  "questions": [
    {
      "question": "text",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctAnswer": "A) ...",
      "explanation": "why this is correct",
      "topicTag": "topic name"
    }
  ]
}
Make Q1 easy → Q5 hard. Adapt difficulty to student's education level if profile provided. Cover different topics.`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Re-generate ONLY the summary + visualNotes for a cached video, personalized for a user
 * Used when a cached session exists but needs personalization for the current user
 */
async function generatePersonalizedSummary(transcript, videoTitle = '', userProfile) {
  if (isDemoKey) {
    const interests = [...(userProfile?.interests || []), ...(userProfile?.hobbies || [])].join(', ');
    return {
      summary: `## Summary (Demo — Personalized for ${userProfile?.name || 'you'})\n\n*In real mode, this summary would use examples from: ${interests || 'your interests'}.*\n\nAdd your OpenAI key to \`backend/.env\` to enable personalized summaries.`,
      visualNotes: '',
    };
  }

  const profileCtx = buildProfileContext(userProfile);

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 2500,
    messages: [
      {
        role: 'user',
        content: `You are a personalized AI tutor. Re-write the study notes for this video tailored specifically to this student.
${profileCtx}

Video Title: "${videoTitle}"
Transcript: ${transcript.slice(0, 12000)}

Return JSON with exactly these two fields:
{
  "summary": "400-600 word markdown summary — MUST use the student's interests for examples. Start with a hook connecting the topic to their interests.",
  "visualNotes": "Key concepts as markdown with tables, comparisons, and analogies from the student's interests"
}`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Answer a doubt using the transcript as context
 */
async function answerQuestion(question, transcript, videoTitle = '', chatHistory = [], userProfile = null) {
  if (isDemoKey) return getMockAnswer(question);

  const profileCtx = buildProfileContext(userProfile);

  const messages = [
    {
      role: 'system',
      content: `You are an AI tutor helping a student understand a YouTube video.
Video: "${videoTitle}"
${profileCtx}

Transcript context:
---
${transcript.slice(0, 10000)}
---

Answer ONLY based on the video content. If something isn't covered, say so.
IMPORTANT: Before giving the formal explanation, ALWAYS give a concrete example from the student's interests/hobbies first, then explain the concept using that example.
Use markdown. Keep it concise.`,
    },
    ...chatHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.6,
    max_tokens: 800,
  });

  return response.choices[0].message.content;
}

/**
 * Answer a general / fact-search question (not restricted to video)
 * Uses web search results as context
 */
async function answerGeneralQuestion(question, searchResults = [], userProfile = null, chatHistory = []) {
  if (isDemoKey) {
    return `## Demo Mode — Fact Search\n\n**Question:** ${question}\n\nWith a real OpenAI key, this searches the web via Exa.ai and gives you a sourced answer.\n\n> Add your OpenAI key to \`backend/.env\` to enable this feature.`;
  }

  const profileCtx = buildProfileContext(userProfile);
  const searchCtx = searchResults.length > 0
    ? `\n\nRelevant search results:\n${searchResults.map((r) => `**${r.title}**\n${r.summary || ''}\nSource: ${r.url}`).join('\n\n')}`
    : '';

  const messages = [
    {
      role: 'system',
      content: `You are a knowledgeable AI assistant that answers general questions and verifies facts using web sources.
${profileCtx}
Answer clearly and accurately. Use the search results as evidence. Cite sources when relevant.
If the user is fact-checking a claim, explicitly state whether sources support or contradict it.${searchCtx}
Use markdown. Be concise.`,
    },
    ...chatHistory.slice(-4).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.5,
    max_tokens: 700,
  });

  return response.choices[0].message.content;
}

// ── Mock data for demo mode ────────────────────────────────────

function getMockAnalysis(videoTitle) {
  return {
    topicTags: ['Machine Learning', 'Neural Networks', 'Deep Learning', 'Python', 'AI'],
    prerequisiteKnowledge: `## Prerequisites

- **Linear Algebra**: Vectors, matrices, dot products
- **Python**: Variables, functions, loops, NumPy basics
- **Statistics**: Mean, variance, probability distributions
- **Calculus**: Derivatives and gradient concept (helpful)`,

    learningRoadmap: [
      { title: 'Introduction & Overview', description: 'What ML is and why it matters', timestamp: '00:00', duration: '~5 min', order: 1 },
      { title: 'Types of Machine Learning', description: 'Supervised, unsupervised, and reinforcement', timestamp: '05:00', duration: '~8 min', order: 2 },
      { title: 'Neural Networks Deep Dive', description: 'Architecture, neurons, layers, weights', timestamp: '13:00', duration: '~10 min', order: 3 },
      { title: 'Training & Backpropagation', description: 'How models learn from data', timestamp: '23:00', duration: '~8 min', order: 4 },
      { title: 'Applications & Best Practices', description: 'Real-world use cases', timestamp: '31:00', duration: '~10 min', order: 5 },
    ],

    summary: `## Summary: Machine Learning Fundamentals

This tutorial covers ML from the ground up — perfect for beginners.

### Three Types of ML
1. **Supervised Learning** — labeled data, predicts outputs (spam filter, image classifier)
2. **Unsupervised Learning** — finds hidden patterns (clustering, anomaly detection)
3. **Reinforcement Learning** — agents learn via rewards (game AI, robotics)

### Neural Networks
- **Input Layer** → receives raw data
- **Hidden Layers** → learn intermediate representations via weights & activations
- **Output Layer** → final prediction

### Training Process
Backpropagation computes gradients; gradient descent minimizes the loss function iteratively.

### Key Takeaway
Always split data into train/validation/test sets and monitor for overfitting.`,

    visualNotes: `## Visual Study Notes

### ML Types Comparison

| Type | Needs Labels? | Goal | Example |
|------|--------------|------|---------|
| Supervised | ✅ Yes | Predict output | Spam filter |
| Unsupervised | ❌ No | Find patterns | Clustering |
| Reinforcement | 🎮 Rewards | Maximize reward | Game AI |

### Neural Network Flow
\`\`\`
Input (x) → [Hidden: ReLU] → [Hidden: ReLU] → Output (ŷ)
              weights ↑            weights ↑
                    Backpropagation adjusts these
\`\`\`

### Training Loop
1. Forward pass → prediction
2. Compute loss
3. Backward pass → gradients
4. Update weights (gradient descent)
5. Repeat`,

    keyConceptsMermaid: `mindmap
  root((Machine Learning))
    Supervised
      Regression
      Classification
      Labeled Data
    Unsupervised
      Clustering
      Dim Reduction
    Reinforcement
      Agent
      Rewards
      Environment
    Neural Networks
      Layers
        Input
        Hidden
        Output
      Training
        Backprop
        Gradient Descent`,
  };
}

function getMockQuiz() {
  return {
    questions: [
      {
        question: 'What is machine learning?',
        options: ['A) A type of hardware', 'B) A subset of AI that learns from data', 'C) A programming language', 'D) A database system'],
        correctAnswer: 'B) A subset of AI that learns from data',
        explanation: 'ML enables systems to learn and improve from experience without being explicitly programmed.',
        topicTag: 'Fundamentals',
      },
      {
        question: 'Which ML type uses labeled training data?',
        options: ['A) Reinforcement Learning', 'B) Unsupervised Learning', 'C) Supervised Learning', 'D) Transfer Learning'],
        correctAnswer: 'C) Supervised Learning',
        explanation: 'Supervised learning trains on labeled datasets where correct outputs are provided.',
        topicTag: 'ML Types',
      },
      {
        question: 'What do hidden layers in a neural network do?',
        options: ['A) Store raw input data', 'B) Display results', 'C) Learn intermediate representations', 'D) Connect to external APIs'],
        correctAnswer: 'C) Learn intermediate representations',
        explanation: 'Hidden layers transform inputs through weights and activations, building abstract features.',
        topicTag: 'Neural Networks',
      },
      {
        question: 'What algorithm is used to train neural networks?',
        options: ['A) Quicksort', 'B) Backpropagation', 'C) Binary search', "D) Dijkstra's algorithm"],
        correctAnswer: 'B) Backpropagation',
        explanation: 'Backpropagation computes gradients and uses gradient descent to minimize the loss.',
        topicTag: 'Training',
      },
      {
        question: 'What is overfitting?',
        options: [
          'A) Model too simple to learn',
          'B) Model memorizes training data but fails on new data',
          'C) Training is too slow',
          'D) Dataset too large',
        ],
        correctAnswer: 'B) Model memorizes training data but fails on new data',
        explanation: 'Overfitting means the model learned noise in training data and cannot generalize.',
        topicTag: 'Best Practices',
      },
    ],
  };
}

function getMockAnswer(question) {
  return `## Answer (Demo Mode)

Based on the video content regarding **"${question}"**:

The video explains this concept clearly. In the context of machine learning:

- Models adjust **weights and biases** iteratively using backpropagation
- The **learning rate** controls how big each update step is
- **Validation loss** helps detect overfitting early

> Add your real **OpenAI API key** to \`backend/.env\` to get answers powered by GPT-4o, grounded in the exact video transcript.`;
}

module.exports = { analyzeTranscript, generateQuiz, answerQuestion, answerGeneralQuestion, generatePersonalizedSummary };
