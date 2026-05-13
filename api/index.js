const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const { GITHUB_TOKEN, GEMINI_API_KEY, ADMIN_EMAIL } = process.env;
const REPO_OWNER = "mimnets"; 
const REPO_NAME = "my-language-island"; // নিশ্চিত করুন গিটহাবে এই নামই আছে
const FILE_PATH = "data.json";

app.get('/api/island', async (req, res) => {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const response = await axios.get(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
        const content = Buffer.from(response.data.content, 'base64').toString();
        res.json(JSON.parse(content));
    } catch (e) {
        // যদি ডাটা না পায় তবে খালি অ্যারে পাঠাবে যাতে এরর না হয়
        res.json([]);
    }
});

app.post('/api/ai-generate', async (req, res) => {
    const { topic } = req.body;
    try {
        const prompt = `Generate a unique French sentence about "${topic}" with its Bengali translation. Return ONLY a JSON object: {"bn": "...", "fr": "..."}`;
        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await axios.post(genUrl, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        
        let text = response.data.candidates[0].content.parts[0].text;
        text = text.replace(/```json|
```/g, "").trim();
        res.json(JSON.parse(text));
    } catch (e) {
        res.status(500).json({ error: "AI failed" });
    }
});

// এডমিন ভেরিফিকেশন সহ অ্যাড করার লজিক
app.post('/api/add', async (req, res) => {
    const { bn, fr, category, userEmail } = req.body;
    const isAdmin = userEmail && ADMIN_EMAIL && (userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const getFile = await axios.get(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
        let currentData = JSON.parse(Buffer.from(getFile.data.content, 'base64').toString());

        currentData.push({ 
            bn, fr, category: category || 'General', 
            date: new Date().toLocaleDateString(),
            approved: isAdmin 
        });

        await axios.put(url, {
            message: `Sentence added by ${userEmail}`,
            content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64'),
            sha: getFile.data.sha
        }, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = app;
