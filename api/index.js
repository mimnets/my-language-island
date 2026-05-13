const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// কনফিগারেশন - Vercel Env থেকে আসবে
const { GITHUB_TOKEN, GEMINI_API_KEY, ADMIN_EMAIL } = process.env;
const REPO_OWNER = "mimnets"; 
const REPO_NAME = "my-language-island";
const FILE_PATH = "data.json";

// ১. আইল্যান্ড ডাটা পড়া
app.get('/api/island', async (req, res) => {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const response = await axios.get(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
        const content = Buffer.from(response.data.content, 'base64').toString();
        res.json(JSON.parse(content));
    } catch (e) {
        res.json([]); // ডাটা না থাকলে খালি লিস্ট
    }
});

// ২. এডমিন চেক করার এন্ডপয়েন্ট (নিরাপদ পদ্ধতি)
app.post('/api/check-admin', (req, res) => {
    const { email } = req.body;
    const isAdmin = email && ADMIN_EMAIL && (email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    res.json({ isAdmin });
});

// ৩. AI দিয়ে বাক্য জেনারেট করা
app.post('/api/ai-generate', async (req, res) => {
    const { topic } = req.body;
    try {
        const prompt = `Generate a unique French sentence about "${topic}" with its Bengali translation. Return ONLY a JSON object like this: {"bn": "বাংলা অনুবাদ", "fr": "French Sentence"}`;
        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await axios.post(genUrl, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        
        let text = response.data.candidates[0].content.parts[0].text;
        text = text.replace(/```json|
```/g, "").trim();
        res.json(JSON.parse(text));
    } catch (e) {
        res.status(500).json({ error: "AI failed to generate content" });
    }
});

// ৪. গিটহাবে ডাটা সেভ করা
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
