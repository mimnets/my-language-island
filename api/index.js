const express = require('express');
const app = express();

app.use(express.json());

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "mdmonirulislammonir@gmail.com";
const REPO_OWNER = "mimnets";
const REPO_NAME = "my-language-island";
const FILE_PATH = "data.json";
const PENDING_FILE = "pending.json";
const RESOURCES_FILE = "resources.json";

async function getGitHubFile(filename) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!response.ok) { if (response.status === 404) return null; throw new Error(`GitHub fetch failed: ${response.status}`); }
    return await response.json();
}

async function updateGitHubFile(filename, content, commitMessage) {
    const existing = await getGitHubFile(filename);
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;
    const body = { message: commitMessage, content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64') };
    if (existing) body.sha = existing.sha;
    const response = await fetch(url, { method: 'PUT', headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`GitHub update failed: ${response.status}`);
    return await response.json();
}

async function parseJSONSafely(content) {
    if (!content) return [];
    try { return JSON.parse(Buffer.from(content, 'base64').toString()); } catch { return []; }
}

// PUBLIC ENDPOINTS
app.get('/api/island', async (req, res) => {
    try {
        const fileData = await getGitHubFile(FILE_PATH);
        if (!fileData) return res.json([]);
        res.json(await parseJSONSafely(fileData.content));
    } catch (error) { res.status(500).json({ error: 'Failed to fetch island data' }); }
});

app.post('/api/submit-sentence', async (req, res) => {
    try {
        const { bn, fr, category, submitterEmail, fr_phonetic, bn_phonetic } = req.body;
        if (!bn || !fr) return res.status(400).json({ error: 'Bengali and French sentences are required' });
        const sentence = { id: Date.now().toString(), bn: bn.trim(), fr: fr.trim(), fr_phonetic: fr_phonetic?.trim() || '', bn_phonetic: bn_phonetic?.trim() || '', category: (category || 'General').trim(), submitterEmail: submitterEmail || 'anonymous', date: new Date().toISOString().split('T')[0], status: 'pending', submittedAt: new Date().toISOString() };
        const pendingData = await getGitHubFile(PENDING_FILE);
        let currentPending = pendingData ? await parseJSONSafely(pendingData.content) : [];
        currentPending.push(sentence);
        await updateGitHubFile(PENDING_FILE, currentPending, `New submission: ${bn}`);
        res.json({ success: true, message: 'Sentence submitted for review', id: sentence.id });
    } catch (error) { res.status(500).json({ error: error.message || 'Failed to submit sentence' }); }
});

// RESOURCES ENDPOINTS
app.get('/api/resources', async (req, res) => {
    try {
        const fileData = await getGitHubFile(RESOURCES_FILE);
        if (!fileData) return res.json([]);
        res.json(await parseJSONSafely(fileData.content));
    } catch (error) { res.status(500).json({ error: 'Failed to fetch resources' }); }
});

app.post('/api/resources', async (req, res) => {
    try {
        const { email, title, description, url, type, tags } = req.body;
        if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ error: 'Unauthorized' });
        if (!title || !url) return res.status(400).json({ error: 'Title and URL are required' });
        const resource = { id: Date.now().toString(), title: title.trim(), description: description?.trim() || '', url: url.trim(), type: type?.trim() || 'link', tags: Array.isArray(tags) ? tags : (tags ? [tags] : []), addedBy: email, addedAt: new Date().toISOString() };
        const fileData = await getGitHubFile(RESOURCES_FILE);
        let currentData = fileData ? await parseJSONSafely(fileData.content) : [];
        currentData.push(resource);
        await updateGitHubFile(RESOURCES_FILE, currentData, `Added resource: ${title}`);
        res.json({ success: true, resource });
    } catch (error) { res.status(500).json({ error: error.message || 'Failed to add resource' }); }
});

app.delete('/api/resources/:id', async (req, res) => {
    try {
        const { email } = req.body;
        const { id } = req.params;
        if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ error: 'Unauthorized' });
        const fileData = await getGitHubFile(RESOURCES_FILE);
        if (!fileData) return res.status(404).json({ error: 'No resources found' });
        let currentData = await parseJSONSafely(fileData.content);
        const resourceIndex = currentData.findIndex(r => r.id === id);
        if (resourceIndex === -1) return res.status(404).json({ error: 'Resource not found' });
        const deletedResource = currentData[resourceIndex];
        currentData.splice(resourceIndex, 1);
        await updateGitHubFile(RESOURCES_FILE, currentData, `Deleted resource: ${deletedResource.title}`);
        res.json({ success: true, deleted: deletedResource });
    } catch (error) { res.status(500).json({ error: error.message || 'Failed to delete resource' }); }
});

// ADMIN ENDPOINTS
app.post('/api/check-admin', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    res.json({ isAdmin: email.toLowerCase() === ADMIN_EMAIL.toLowerCase(), email: email.toLowerCase() });
});

app.get('/api/admin/pending', async (req, res) => {
    try {
        const email = req.headers['x-admin-email'];
        if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ error: 'Unauthorized' });
        const fileData = await getGitHubFile(PENDING_FILE);
        if (!fileData) return res.json([]);
        res.json((await parseJSONSafely(fileData.content)).filter(s => s.status === 'pending'));
    } catch (error) { res.status(500).json({ error: 'Failed to fetch pending submissions' }); }
});

app.post('/api/admin/approve', async (req, res) => {
    try {
        const { email, id } = req.body;
        if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ error: 'Unauthorized' });
        if (!id) return res.status(400).json({ error: 'Submission ID required' });
        const pendingFile = await getGitHubFile(PENDING_FILE);
        if (!pendingFile) return res.status(404).json({ error: 'No pending submissions found' });
        let pendingData = await parseJSONSafely(pendingFile.content);
        const submission = pendingData.find(s => s.id === id);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });
        const mainFile = await getGitHubFile(FILE_PATH);
        let mainData = mainFile ? await parseJSONSafely(mainFile.content) : [];
        const approvedSentence = { bn: submission.bn, fr: submission.fr, fr_phonetic: submission.fr_phonetic || '', bn_phonetic: submission.bn_phonetic || '', category: submission.category, date: new Date().toISOString().split('T')[0], approvedBy: email };
        mainData.push(approvedSentence);
        await updateGitHubFile(FILE_PATH, mainData, `Approved: ${submission.bn}`);
        pendingData = pendingData.filter(s => s.id !== id);
        await updateGitHubFile(PENDING_FILE, pendingData, `Approved and removed: ${submission.bn}`);
        res.json({ success: true, message: 'Sentence approved and added to island', sentence: approvedSentence });
    } catch (error) { res.status(500).json({ error: error.message || 'Failed to approve sentence' }); }
});

app.post('/api/admin/reject', async (req, res) => {
    try {
        const { email, id } = req.body;
        if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ error: 'Unauthorized' });
        if (!id) return res.status(400).json({ error: 'Submission ID required' });
        const pendingFile = await getGitHubFile(PENDING_FILE);
        if (!pendingFile) return res.status(404).json({ error: 'No pending submissions found' });
        let pendingData = await parseJSONSafely(pendingFile.content);
        const submission = pendingData.find(s => s.id === id);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });
        pendingData = pendingData.filter(s => s.id !== id);
        await updateGitHubFile(PENDING_FILE, pendingData, `Rejected: ${submission.bn}`);
        res.json({ success: true, message: 'Submission rejected' });
    } catch (error) { res.status(500).json({ error: error.message || 'Failed to reject sentence' }); }
});

app.post('/api/admin/delete', async (req, res) => {
    try {
        const { email, id } = req.body;
        if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ error: 'Unauthorized' });
        if (!id) return res.status(400).json({ error: 'Sentence ID required' });
        const fileData = await getGitHubFile(FILE_PATH);
        if (!fileData) return res.status(404).json({ error: 'No sentences found' });
        let currentData = await parseJSONSafely(fileData.content);
        const sentenceIndex = currentData.findIndex(s => s.id === id || s.bn === id);
        if (sentenceIndex === -1) return res.status(404).json({ error: 'Sentence not found' });
        const deletedSentence = currentData[sentenceIndex];
        currentData.splice(sentenceIndex, 1);
        await updateGitHubFile(FILE_PATH, currentData, `Deleted: ${deletedSentence.bn}`);
        res.json({ success: true, message: 'Sentence deleted', deleted: deletedSentence });
    } catch (error) { res.status(500).json({ error: error.message || 'Failed to delete sentence' }); }
});

app.post('/api/add-sentence', async (req, res) => {
    try {
        const { bn, fr, category, email, topic, generateAI, fr_phonetic, bn_phonetic } = req.body;
        if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return res.status(403).json({ error: 'Unauthorized. Admin access only.' });
        let sentence = { bn: bn?.trim() || '', fr: fr?.trim() || '', fr_phonetic: fr_phonetic?.trim() || '', bn_phonetic: bn_phonetic?.trim() || '', category: (category || 'General').trim(), date: new Date().toISOString().split('T')[0] };
        
        if (generateAI && topic) {
            if (!GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY is not set. Please add it to Vercel environment variables.' });
            const prompt = `Generate exactly one French learning sentence for the topic "${topic}". Return ONLY valid JSON like this, no markdown or extra text:
{"bn": "Bengali translation", "fr": "French sentence", "fr_phonetic": "English phonetic", "bn_phonetic": "Bengali phonetic", "category": "${topic}"}`;
            const GROQ_URL = `https://api.groq.com/openai/v1/chat/completions`;
            const aiResponse = await fetch(GROQ_URL, { method: 'POST', headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'system', content: 'You are a helpful French language tutor. Always respond with ONLY valid JSON like: {"bn": "Bengali text", "fr": "French text", "fr_phonetic": "English phonetic", "bn_phonetic": "Bengali phonetic", "category": "Topic"}' }, { role: 'user', content: prompt }], temperature: 0.7, max_tokens: 512 }) });
            if (!aiResponse.ok) { const errorData = await aiResponse.json(); return res.status(aiResponse.status).json({ error: 'Groq API failed: ' + (errorData?.error?.message || 'Unknown error') }); }
            const aiData = await aiResponse.json();
            const aiText = aiData.choices?.[0]?.message?.content;
            if (aiText) {
                let cleaned = aiText.trim();
                const jsonStart = cleaned.indexOf('{');
                const jsonEnd = cleaned.lastIndexOf('}') + 1;
                if (jsonStart !== -1 && jsonEnd !== 0) cleaned = cleaned.substring(jsonStart, jsonEnd);
                const parsed = JSON.parse(cleaned);
                sentence = { bn: parsed.bn || '', fr: parsed.fr || '', fr_phonetic: parsed.fr_phonetic || '', bn_phonetic: parsed.bn_phonetic || '', category: topic, date: new Date().toISOString().split('T')[0] };
            }
        }
        if (!sentence.id) sentence.id = Date.now().toString();
        const fileData = await getGitHubFile(FILE_PATH);
        const currentData = fileData ? await parseJSONSafely(fileData.content) : [];
        currentData.push(sentence);
        await updateGitHubFile(FILE_PATH, currentData, `Admin added: ${sentence.category || 'Manual'}`);
        res.json({ success: true, sentence, total: currentData.length });
    } catch (error) { res.status(500).json({ error: error.message || 'Failed to add sentence' }); }
});

app.get('/api/health', (req, res) => { res.json({ status: 'ok', adminEmail: ADMIN_EMAIL, groqKeySet: !!GROQ_API_KEY, timestamp: new Date().toISOString() }); });

module.exports = app;
