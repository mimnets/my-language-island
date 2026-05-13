const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// কনফিগারেশন
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = "mimnets"; // আপনার ইউজারনেম সেট করা হয়েছে
const REPO_NAME = "my-language-island"; // আপনার রিপোজিটরির নাম এখানে দিন
const FILE_PATH = "data.json";

// ১. আইল্যান্ড ডাটা রিড করা
app.get('/api/island', async (req, res) => {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const response = await axios.get(url, { 
            headers: { Authorization: `token ${GITHUB_TOKEN}` } 
        });
        const content = Buffer.from(response.data.content, 'base64').toString();
        res.json(JSON.parse(content));
    } catch (error) {
        console.error("Fetch Error:", error.message);
        res.status(500).json({ error: "ফাইলটি খুঁজে পাওয়া যায়নি। গিটহাবে data.json ফাইল আছে কি না চেক করুন।" });
    }
});

// ২. নতুন বাক্য সেভ করা
app.post('/api/add', async (req, res) => {
    const { bn, fr, category } = req.body;
    if (!bn || !fr) return res.status(400).json({ error: "Missing data" });

    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        
        // ফাইলটি নিয়ে আসা
        const getFile = await axios.get(url, { 
            headers: { Authorization: `token ${GITHUB_TOKEN}` } 
        });
        
        const currentData = JSON.parse(Buffer.from(getFile.data.content, 'base64').toString());
        
        // নতুন ডেটা যোগ করা
        currentData.push({ 
            bn, 
            fr, 
            category: category || 'General', 
            date: new Date().toLocaleDateString() 
        });

        // গিটহাবে আপডেট করা
        await axios.put(url, {
            message: `Sentence added by Monirul Islam: ${bn}`,
            content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64'),
            sha: getFile.data.sha
        }, { 
            headers: { Authorization: `token ${GITHUB_TOKEN}` } 
        });

        res.json({ success: true });
    } catch (error) {
        console.error("GitHub API Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "GitHub-এ সেভ করতে সমস্যা হয়েছে। টোকেন বা পারমিশন চেক করুন।" });
    }
});

module.exports = app;
