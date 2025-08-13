const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

// In-memory data
let users = [];
let challenges = [];
let submissions = [];

// API Endpoints
app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password || !email) {
        return res.status(400).json({ message: 'Username, password, and email are required' });
    }
    users.push({ username, password, email });
    res.status(201).json({ message: 'User registered successfully' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        res.status(200).json({ message: 'Login successful' });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});
app.get('/api/feed', (req, res) => {
    res.json(submissions);
});

app.post('/api/challenges', upload.single('media'), (req, res) => {
    const { title, description, tags } = req.body;
    if (!title || !description || !tags) {
        return res.status(400).json({ message: 'Title, description, and tags are required.' });
    }

    const newChallenge = {
        id: challenges.length + 1,
        title,
        description,
        tags: tags.split(','),
        mediaUrl: req.file ? `/uploads/${req.file.filename}` : null,
        submissions: []
    };
    challenges.push(newChallenge);
    res.status(201).json(newChallenge);
});

app.get('/api/user/submissions/:userId', (req, res) => {
    const userId = req.params.userId;
    const userSubmissions = submissions.filter(s => s.username === userId);
    res.json(userSubmissions);
});

app.get('/api/user/stats/:userId', (req, res) => {
    const userId = req.params.userId;
    // NOTE: In a real application, you would fetch this data from a database.
    // Here we are using in-memory data for demonstration.
    const userSubmissions = submissions.filter(s => s.username === userId);
    const reactionsGiven = submissions.reduce((acc, s) => acc + (s.reactions ? s.reactions.filter(r => r.username === userId).length : 0), 0);
    const reactionsReceived = userSubmissions.reduce((acc, s) => acc + (s.reactions ? s.reactions.length : 0), 0);

    const tagCounts = userSubmissions.reduce((acc, s) => {
        const challenge = challenges.find(c => c.title === s.challengeTitle);
        if (challenge) {
            challenge.tags.forEach(tag => {
                acc[tag] = (acc[tag] || 0) + 1;
            });
        }
        return acc;
    }, {});

    const topCategories = Object.entries(tagCounts)
        .sort(([,a],[,b]) => b-a)
        .slice(0, 3)
        .map(([name]) => name);

    const calculateGrade = (submissionsCount, reactionsGiven, reactionsReceived) => {
        const score = (submissionsCount * 5) + (reactionsGiven * 1) + (reactionsReceived * 2);
        if (score > 150) return "A+";
        if (score > 120) return "A";
        if (score > 100) return "B+";
        if (score > 80) return "B";
        if (score > 60) return "C+";
        if (score > 40) return "C";
        if (score > 20) return "D";
        return "F";
    };

    const grade = calculateGrade(userSubmissions.length, reactionsGiven, reactionsReceived);

    res.json({
        grade,
        submissionsCount: userSubmissions.length,
        reactionsGiven,
        reactionsReceived,
        topCategories
    });
});

// WebSocket Server
const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
    console.log('Client connected');
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});
