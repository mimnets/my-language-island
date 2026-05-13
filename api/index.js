const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// কনফিগারেশন - এগুলো Vercel Env থেকে আসবে
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = "mimnets"; 
const REPO_NAME = "my-language-island"; // আপনার রিপোজিটরি নাম ঠিক আছে তো?
const FILE_PATH = "data.json";

app.get('/api/island', async (req, res) => {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const response = await axios.get(url, { 
            headers: { 
                Authorization: `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            } 
        });
        const content = Buffer.from(response.data.content, 'base64').toString();
        res.json(JSON.parse(content));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/add', async (req, res) => {
    const { bn, fr, category } = req.body;
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        
        // ১. বর্তমান ফাইলটি ডাউনলোড করা
        const getFile = await axios.get(url, { 
            headers: { Authorization: `token ${GITHUB_TOKEN}` } 
        });
        
        const currentData = JSON.parse(Buffer.from(getFile.data.content, 'base64').toString());
        
        // ২. নতুন ডেটা পুশ করা
        currentData.push({ 
            bn, 
            fr, 
            category: category || 'General', 
            date: new Date().toLocaleDateString() 
        });

        // ৩. গিটহাবে আপডেট করা
        await axios.put(url, {
            message: `Update by Monirul: ${bn}`,
            content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64'),
            sha: getFile.data.sha
        }, { 
            headers: { Authorization: `token ${GITHUB_TOKEN}` } 
        });

        res.json({ success: true });
    } catch (error) {
        // এরর মেসেজটি ডিটেইলসে পাঠানো হচ্ছে
        const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: errorMsg });
    }
});

module.exports = app;
