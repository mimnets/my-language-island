const express = require('express');
const app = express();

app.use(express.json());

// ============ CONFIGURATION ============
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ADMIN_EMAIL = "mdmonirulislammonir@gmail.com";

const REPO_OWNER = "mimnets";
const REPO_NAME = "my-language-island";
const FILE_PATH = "data.json";

// ============ HELPERS ============
async function getGitHubFile() {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`GitHub fetch failed: ${response.status}`);
    }
    
    return await response.json();
}

async function updateGitHubFile(content, commitMessage) {
    const fileData = await getGitHubFile();
    
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
            message: commitMessage,
            content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
            sha: fileData.sha
        })
    });
    
    if (!response.ok) {
        throw new Error(`GitHub update failed: ${response.status}`);
    }
    
    return await response.json();
}

async function parseJSONSafely(content) {
    try {
        return JSON.parse(Buffer.from(content, 'base64').toString());
    } catch {
        return [];
    }
}

// ============ ENDPOINTS ============

// GET /island - Fetch all sentences
app.get('/api/island', async (req, res) => {
    try {
        const fileData = await getGitHubFile();
        const data = await parseJSONSafely(fileData.content);
        res.json(data);
    } catch (error) {
        console.error('GET /island error:', error.message);
        res.status(500).json({ error: 'Failed to fetch island data' });
    }
});

// POST /check-admin - Verify admin
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

// POST /add-sentence - Add new sentence
app.post('/api/add-sentence', async (req, res) => {
    try {
        const { bn, fr, category, email, topic, generateAI } = req.body;
        
        // Admin check
        if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized. Admin access only.' });
        }
        
        let sentence = { bn, fr, category, date: new Date().toISOString().split('T')[0] };
        
        // AI generation mode
        if (generateAI && topic) {
            const prompt = `Generate exactly one French learning sentence for the topic "${topic}". Return ONLY valid JSON like this, no markdown or extra text:
{"bn": "Bengali translation", "fr": "French sentence", "category": "${topic}"}`;
            
            const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const aiResponse = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 256
                    }
                })
            });
            
            if (!aiResponse.ok) {
                throw new Error('Gemini API failed');
            }
            
            const aiData = await aiResponse.json();
            const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (aiText) {
                // Safe JSON extraction without regex
                let cleaned = aiText.trim();
                const jsonStart = cleaned.indexOf('{');
                const jsonEnd = cleaned.lastIndexOf('}') + 1;
                
                if (jsonStart !== -1 && jsonEnd !== 0) {
                    cleaned = cleaned.substring(jsonStart, jsonEnd);
                }
                
                const parsed = JSON.parse(cleaned);
                sentence = {
                    ...parsed,
                    category: topic,
                    date: new Date().toISOString().split('T')[0]
                };
            }
        }
        
        // Fetch current data and add new sentence
        const fileData = await getGitHubFile();
        const currentData = await parseJSONSafely(fileData.content);
        
        currentData.push(sentence);
        
        await updateGitHubFile(currentData, `Admin added: ${sentence.category || 'Manual'}`);
        
        res.json({ 
            success: true, 
            sentence,
            total: currentData.length
        });
        
    } catch (error) {
        console.error('POST /add-sentence error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to add sentence' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;