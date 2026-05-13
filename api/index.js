const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const { GITHUB_TOKEN, GEMINI_API_KEY, ADMIN_EMAIL } = process.env;
const REPO_OWNER = "mimnets"; 
const REPO_NAME = "my-language-island";
const FILE_PATH = "data.json";

// ১. ডাটা রিড করা
app.get('/api/island', async (req, res) => {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const response = await axios.get(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
        res.json(JSON.parse(Buffer.from(response.data.content, 'base64').toString()));
    } catch (e) { res.status(500).json({ error: "Failed to fetch" }); }
});

// ২. AI দিয়ে বাক্য তৈরি (Gemini)
app.post('/api/ai-generate', async (req, res) => {
    const { topic } = req.body;
    try {
        const prompt = `Generate a unique French sentence about "${topic}" with its Bengali translation. Return ONLY a JSON object: {"bn": "...", "fr": "..."}`;
        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await axios.post(genUrl, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        
        const text = response.data.candidates[0].content.parts[0].text;
        res.json(JSON.parse(text.replace(/```json|
```/g, "")));
    } catch (e) { res.status(500).json({ error: "AI Generation failed" }); }
});

// ৩. ডাটা সেভ করা (Admin বা Public এর জন্য)
app.post('/api/add', async (req, res) => {
    const { bn, fr, category, userEmail } = req.body;
    const isAdmin = (userEmail === ADMIN_EMAIL);

    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const getFile = await axios.get(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
        let currentData = JSON.parse(Buffer.from(getFile.data.content, 'base64').toString());

        currentData.push({ 
            bn, fr, category: category || 'General', 
            date: new Date().toLocaleDateString(),
            approved: isAdmin // এডমিন হলে সরাসরি এপ্রুভ হবে
        });

        await axios.put(url, {
            message: `Added by ${userEmail || 'Public'}`,
            content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64'),
            sha: getFile.data.sha
        }, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = app;
