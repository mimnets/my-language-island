const express = require('express');
const app = express();

app.use(express.json());

// ============ CONFIGURATION ============
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "mdmonirulislammonir@gmail.com";

const REPO_OWNER = "mimnets";
const REPO_NAME = "my-language-island";
const FILE_PATH = "data.json";
const PENDING_FILE = "pending.json";

// ============ HELPERS ============
async function getGitHubFile(filename) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    
    if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`GitHub fetch failed: ${response.status}`);
    }
    
    return await response.json();
}

async function updateGitHubFile(filename, content, commitMessage) {
    const existing = await getGitHubFile(filename);
    
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;
    const body = {
        message: commitMessage,
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64')
    };
    
    if (existing) {
        body.sha = existing.sha;
    }
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        throw new Error(`GitHub update failed: ${response.status}`);
    }
    
    return await response.json();
}

async function parseJSONSafely(content) {
    if (!content) return [];
    try {
        return JSON.parse(Buffer.from(content, 'base64').toString());
    } catch {
        return [];
    }
}

// ============ PUBLIC ENDPOINTS ============

// GET /island - Fetch approved sentences
app.get('/api/island', async (req, res) => {
    try {
        const fileData = await getGitHubFile(FILE_PATH);
        if (!fileData) return res.json([]);
        const data = await parseJSONSafely(fileData.content);
        res.json(data);
    } catch (error) {
        console.error('GET /island error:', error.message);
        res.status(500).json({ error: 'Failed to fetch island data' });
    }
});

// POST /submit-sentence - PUBLIC - Anyone can submit for review
app.post('/api/submit-sentence', async (req, res) => {
    try {
        const { bn, fr, category, submitterEmail } = req.body;
        
        if (!bn || !fr) {
            return res.status(400).json({ error: 'Bengali and French sentences are required' });
        }
        
        const sentence = {
            id: Date.now().toString(),
            bn: bn.trim(),
            fr: fr.trim(),
            category: (category || 'General').trim(),
            submitterEmail: submitterEmail || 'anonymous',
            date: new Date().toISOString().split('T')[0],
            status: 'pending',
            submittedAt: new Date().toISOString()
        };
        
        const pendingData = await getGitHubFile(PENDING_FILE);
        let currentPending = pendingData ? await parseJSONSafely(pendingData.content) : [];
        currentPending.push(sentence);
        
        await updateGitHubFile(PENDING_FILE, currentPending, `New submission: ${bn}`);
        
        res.json({ 
            success: true, 
            message: 'Sentence submitted for review',
            id: sentence.id
        });
        
    } catch (error) {
        console.error('POST /submit-sentence error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to submit sentence' });
    }
});

// ============ ADMIN ENDPOINTS ============

// POST /check-admin - Verify admin email
app.post('/api/check-admin', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        res.json({ 
            isAdmin,
            email: email.toLowerCase()
        });
    } catch (error) {
        console.error('POST /check-admin error:', error.message);
        res.status(500).json({ error: 'Admin check failed' });
    }
});

// GET /admin/pending - Get all pending submissions (admin only)
app.get('/api/admin/pending', async (req, res) => {
    try {
        const email = req.headers['x-admin-email'];
        
        if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const fileData = await getGitHubFile(PENDING_FILE);
        if (!fileData) return res.json([]);
        
        const pending = await parseJSONSafely(fileData.content);
        res.json(pending.filter(s => s.status === 'pending'));
        
    } catch (error) {
        console.error('GET /admin/pending error:', error.message);
        res.status(500).json({ error: 'Failed to fetch pending submissions' });
    }
});

// POST /admin/approve - Approve a submission (admin only)
app.post('/api/admin/approve', async (req, res) => {
    try {
        const { email, id } = req.body;
        
        if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        if (!id) {
            return res.status(400).json({ error: 'Submission ID required' });
        }
        
        const pendingFile = await getGitHubFile(PENDING_FILE);
        if (!pendingFile) {
            return res.status(404).json({ error: 'No pending submissions found' });
        }
        
        let pendingData = await parseJSONSafely(pendingFile.content);
        const submission = pendingData.find(s => s.id === id);
        
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        const mainFile = await getGitHubFile(FILE_PATH);
        let mainData = mainFile ? await parseJSONSafely(mainFile.content) : [];
        
        const approvedSentence = {
            bn: submission.bn,
            fr: submission.fr,
            category: submission.category,
            date: new Date().toISOString().split('T')[0],
            approvedBy: email
        };
        
        mainData.push(approvedSentence);
        await updateGitHubFile(FILE_PATH, mainData, `Approved: ${submission.bn}`);
        
        pendingData = pendingData.filter(s => s.id !== id);
        await updateGitHubFile(PENDING_FILE, pendingData, `Approved and removed: ${submission.bn}`);
        
        res.json({ 
            success: true, 
            message: 'Sentence approved and added to island',
            sentence: approvedSentence
        });
        
    } catch (error) {
        console.error('POST /admin/approve error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to approve sentence' });
    }
});

// POST /admin/reject - Reject a submission (admin only)
app.post('/api/admin/reject', async (req, res) => {
    try {
        const { email, id } = req.body;
        
        if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        if (!id) {
            return res.status(400).json({ error: 'Submission ID required' });
        }
        
        const pendingFile = await getGitHubFile(PENDING_FILE);
        if (!pendingFile) {
            return res.status(404).json({ error: 'No pending submissions found' });
        }
        
        let pendingData = await parseJSONSafely(pendingFile.content);
        const submission = pendingData.find(s => s.id === id);
        
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        pendingData = pendingData.filter(s => s.id !== id);
        await updateGitHubFile(PENDING_FILE, pendingData, `Rejected: ${submission.bn}`);
        
        res.json({ 
            success: true, 
            message: 'Submission rejected'
        });
        
    } catch (error) {
        console.error('POST /admin/reject error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to reject sentence' });
    }
});

// POST /add-sentence - AI generation (admin only)
app.post('/api/add-sentence', async (req, res) => {
    try {
        const { bn, fr, category, email, topic, generateAI } = req.body;
        
        if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized. Admin access only.' });
        }
        
        let sentence = { bn, fr, category, date: new Date().toISOString().split('T')[0] };
        
        if (generateAI && topic) {
            if (!GEMINI_API_KEY) {
                throw new Error('GEMINI_API_KEY environment variable is not set');
            }
            
            const prompt = `Generate exactly one French learning sentence for the topic "${topic}". Return ONLY valid JSON like this, no markdown or extra text:
{"bn": "Bengali translation", "fr": "French sentence", "category": "${topic}"}`;
            
            const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
            
            console.log('Calling Gemini API with key:', GEMINI_API_KEY ? 'SET (' + GEMINI_API_KEY.substring(0, 10) + '...)' : 'NOT SET');
            
            const aiResponse = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 256 }
                })
            });
            
            console.log('Gemini response status:', aiResponse.status);
            
            if (!aiResponse.ok) {
                const errorText = await aiResponse.text();
                console.log('Gemini error response:', errorText);
                throw new Error('Gemini API failed: ' + errorText);
            }
            
            const aiData = await aiResponse.json();
            console.log('Gemini response:', JSON.stringify(aiData));
            
            const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (aiText) {
                let cleaned = aiText.trim();
                const jsonStart = cleaned.indexOf('{');
                const jsonEnd = cleaned.lastIndexOf('}') + 1;
                if (jsonStart !== -1 && jsonEnd !== 0) {
                    cleaned = cleaned.substring(jsonStart, jsonEnd);
                }
                const parsed = JSON.parse(cleaned);
                sentence = { ...parsed, category: topic, date: new Date().toISOString().split('T')[0] };
            }
        }
        
        const fileData = await getGitHubFile(FILE_PATH);
        const currentData = fileData ? await parseJSONSafely(fileData.content) : [];
        currentData.push(sentence);
        await updateGitHubFile(FILE_PATH, currentData, `Admin added: ${sentence.category || 'Manual'}`);
        
        res.json({ success: true, sentence, total: currentData.length });
        
    } catch (error) {
        console.error('POST /add-sentence error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to add sentence' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        adminEmail: ADMIN_EMAIL,
        geminiKeySet: !!GEMINI_API_KEY,
        timestamp: new Date().toISOString() 
    });
});

module.exports = app;
