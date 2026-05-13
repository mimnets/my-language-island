const express = require('express');
const app = express();
app.use(express.json());

// কনফিগারেশন - ম্যানুয়ালি টেস্ট করার জন্য
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// এখানে আপনার আসল জিমেইলটি দিন টেস্ট করার জন্য
const ADMIN_EMAIL = "mdmonirulislammonir@gmail.com"; 

const REPO_OWNER = "mimnets";
const REPO_NAME = "my-language-island";
const FILE_PATH = "data.json";

// ১. ডাটা পড়া
app.get('/api/island', async (req, res) => {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const response = await fetch(url, { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } });
        if (!response.ok) return res.json([]);
        const data = await response.json();
        res.json(JSON.parse(Buffer.from(data.content, 'base64').toString()));
    } catch (e) { res.json([]); }
});

// ২. AI জেনারেট এবং গিটহাবে সেভ
app.post('/api/admin/add-ai', async (req, res) => {
    const { topic, email } = req.body;
    
    console.log("Logged Email:", email); // চেক করার জন্য লগে প্রিন্ট হবে
    console.log("Admin Email:", ADMIN_EMAIL);

    // ইমেইল চেক (ছোট হাতের অক্ষরে মিলিয়ে)
    if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ error: "Unauthorized User: " + email });
    }

    try {
        // AI থেকে ডাটা নেওয়া
        const prompt = `Return ONLY JSON: {"bn": "...", "fr": "..."} for topic: ${topic}`;
        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const aiRes = await fetch(genUrl, {
            method: 'POST',
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const aiData = await aiRes.json();
        const cleanText = aiData.candidates[0].content.parts[0].text.replace(/```json|
```/g, "").trim();
        const newSentence = JSON.parse(cleanText);

        // গিটহাবে পুশ করা
        const repoUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const fileRes = await fetch(repoUrl, { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } });
        const fileJson = await fileRes.json();
        let currentData = JSON.parse(Buffer.from(fileJson.content, 'base64').toString());

        currentData.push({ ...newSentence, category: topic, date: new Date().toLocaleDateString() });

        const updateRes = await fetch(repoUrl, {
            method: 'PUT',
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Admin added: ${topic}`,
                content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64'),
                sha: fileJson.sha
            })
        });

        if(updateRes.ok) res.json({ success: true });
        else throw new Error("GitHub update failed");

    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: e.message }); 
    }
});

module.exports = app;
