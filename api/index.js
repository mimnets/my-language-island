const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = "mimnets"; 
const REPO_NAME = "my-language-island";
const FILE_PATH = "data.json";

app.get('/api/island', async (req, res) => {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const response = await axios.get(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
        const content = Buffer.from(response.data.content, 'base64').toString();
        res.json(JSON.parse(content));
    } catch (error) { res.status(500).json({ error: "Failed to fetch data" }); }
});

app.post('/api/add', async (req, res) => {
    const { bn, fr } = req.body;
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const getFile = await axios.get(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
        const currentData = JSON.parse(Buffer.from(getFile.data.content, 'base64').toString());
        currentData.push({ bn, fr, date: new Date().toLocaleDateString() });

        await axios.put(url, {
            message: "New sentence added via UI",
            content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64'),
            sha: getFile.data.sha
        }, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = app;
