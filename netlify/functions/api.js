require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); 
const multer = require('multer');
const serverless = require('serverless-http'); 

const app = express();
const router = express.Router(); 

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
const upload = multer({ storage: multer.memoryStorage() }); 

// --- 1. GROQ (Questions) ---
router.post('/generate-question', async (req, res) => {
    const { promptText } = req.body;
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-20b", // Fast, free openAi reasoning model
                reasoning_effort: "medium",
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
        // Fallback question if Groq API fails or key is missing
        res.json({ topic: "Resilience", text: "Apni zindagi ke ek mushkil daur ke baare mein batayein." });
    }
});

// --- 2. ELEVENLABS (Speech - SERVERLESS BUFFER FIX) ---
router.post('/speak', async (req, res) => {
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
        
        if (!response.ok) throw new Error(`ElevenLabs API failed: ${response.statusText}`);
        
        // Netlify Serverless functions cannot stream directly. 
        // We must buffer the audio into memory and send it as a complete binary chunk.
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(buffer); 
    } catch (error) {
        console.error('\n❌ ElevenLabs Error:', error.message);
        res.status(500).json({ error: 'Failed to generate speech' });
    }
});

// --- 3. DEEPGRAM (Transcription) ---
router.post('/transcribe', upload.single('audio'), async (req, res) => {
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
router.post('/analyze', async (req, res) => {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-20b", // Fast, free openAi reasoning model
                reasoning_effort: "medium",
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

// Mount the router to both possible base paths so Netlify always catches it
app.use('/api', router);
app.use('/.netlify/functions/api', router);
app.use('/', router);

// Export the Express app as a Netlify Serverless Function
// CRUCIAL: Added binary configuration to allow audio files to pass through the function
module.exports.handler = serverless(app, {
    binary: ['audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/*']
});