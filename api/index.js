const express = require('express');
const app = express();
app.use(express.json());

// কনফিগারেশন
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const REPO_OWNER = "mimnets";
const REPO_NAME = "my-language-island";
const FILE_PATH = "data.json";

// ১. আইল্যান্ড ডাটা পড়া
app.get('/api/island', async (req, res) => {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        
        if (!response.ok) return res.json([]); // ফাইল না পেলে বা সমস্যা হলে খালি লিস্ট
        
        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString();
        res.json(JSON.parse(content));
    } catch (e) {
        res.status(500).json({ error: "Failed to load island data" });
    }
});

// ২. এডমিন চেক
app.post('/api/check-admin', (req, res) => {
    const { email } = req.body;
    const isAdmin = email && ADMIN_EMAIL && (email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    res.json({ isAdmin: !!isAdmin });
});

// ৩. AI দিয়ে বাক্য জেনারেট
app.post('/api/ai-generate', async (req, res) => {
    const { topic } = req.body;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: "Gemini Key missing" });

    try {
        const prompt = `Generate a unique French sentence about "${topic}" with its Bengali translation. Return ONLY a JSON object: {"bn": "...", "fr": "..."}`;
        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(genUrl, {
            method: 'POST',
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const data = await response.json();
        let text = data.candidates[0].content.parts[0].text;
        text = text.replace(/```json|
```/g, "").trim();
        res.json(JSON.parse(text));
    } catch (e) {
        res.status(500).json({ error: "AI failed" });
    }
});

// ৪. গিটহাবে সেভ করা
app.post('/api/add', async (req, res) => {
    const { bn, fr, category, userEmail } = req.body;
    const isAdmin = userEmail && ADMIN_EMAIL && (userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const getFileRes = await fetch(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        
        const fileData = await getFileRes.json();
        let currentData = JSON.parse(Buffer.from(fileData.content, 'base64').toString());

        currentData.push({ 
            bn, fr, category: category || 'General', 
            date: new Date().toLocaleDateString(),
            approved: isAdmin 
        });

        const updateRes = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Update by ${userEmail}`,
                content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64'),
                sha: fileData.sha
            })
        });

        if (updateRes.ok) res.json({ success: true });
        else throw new Error("GitHub update failed");

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = app;
