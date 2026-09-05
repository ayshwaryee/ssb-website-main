// netlify/functions/gemini.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);
        const { b64, promptText } = body;
        
        // Netlify securely injects your API key here
        const apiKey = process.env.GEMINI_API_KEY; 

        const parts = [{ text: promptText }];
        if (b64) parts.push({ inline_data: { mime_type: "image/jpeg", data: b64 } });

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: parts }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();
        
        // Send the AI response back to your frontend
        return {
            statusCode: 200,
            body: JSON.stringify(JSON.parse(data.candidates[0].content.parts[0].text))
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to connect to Gemini' }) };
    }
};