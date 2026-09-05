require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); 
const multer = require('multer');
const serverless = require('serverless-http'); 

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
const upload = multer({ storage: multer.memoryStorage() }); 

// --- 1. GROQ (Questions) ---
app.post('/api/generate-question', async (req, res) => {
    const { promptText } = req.body;
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-20b",
                reasoning_effort: 'low', // Replaced openai/gpt-oss-20b with Mixtral
                messages: [{ role: "user", content: promptText }],
                response_format: { type: "json_object" }
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        const content = data.choices[0].message.content;
        res.json(JSON.parse(content));
    } catch (error) {
        console.error('\n❌ Groq Question Error:', error.message);
        res.json({ topic: "Resilience", text: "Apni zindagi ke ek mushkil daur ke baare mein batayein." });
    }
});

// --- 2. ELEVENLABS (Speech) ---
app.post('/api/speak', async (req, res) => {
    const { text, voiceId } = req.body;
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: { 
                'xi-api-key': process.env.ELEVENLABS_API_KEY, 
                'Content-Type': 'application/json', 
                'Accept': 'audio/mpeg' 
            },
            body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', language_code: 'hi' })
        });
        if (!response.ok) throw new Error('ElevenLabs API failed');
        res.setHeader('Content-Type', 'audio/mpeg');
        response.body.pipe(res); 
    } catch (error) {
        console.error('\n❌ ElevenLabs Error:', error.message);
        res.status(500).json({ error: 'Failed to generate speech' });
    }
});

// --- 3. DEEPGRAM (Transcription) ---
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=hi&detect_language=true', {
            method: 'POST',
            headers: { 'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': req.file.mimetype },
            body: req.file.buffer
        });
        const data = await response.json();
        const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        res.json({ transcript: transcript.trim() });
    } catch (error) {
        console.error('\n❌ Deepgram Error:', error.message);
        res.status(500).json({ error: 'Transcription failed' });
    }
});

// --- 4. GROQ (Analysis) ---
app.post('/api/analyze', async (req, res) => {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile", // Kept exactly as you requested
                messages: [{ role: "user", content: req.body.prompt }],
                response_format: { type: "json_object" }
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        const content = data.choices[0].message.content;
        res.json(JSON.parse(content));
    } catch (error) {
        console.error('\n❌ Groq Analysis Error:', error.message);
        res.json({ score: 5, olqs_demonstrated: ["Initiative"], feedback: "Keep practicing your structure." });
    }
});

// Export the Express app as a Netlify Serverless Function
module.exports.handler = serverless(app);