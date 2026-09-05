const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const apiKey = process.env.DEEPGRAM_API_KEY;
        const contentType = event.headers['content-type'] || 'audio/webm';
        
        // Because the frontend sent raw binary, Netlify gives it to us in base64. 
        // We decode it back to a buffer to send to Deepgram.
        const audioBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');

        const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=hi&detect_language=true&smart_format=true&punctuate=true', {
            method: 'POST',
            headers: { 
                'Authorization': `Token ${apiKey}`, 
                'Content-Type': contentType 
            },
            body: audioBuffer
        });
        
        const data = await response.json();
        const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        
        return { statusCode: 200, body: JSON.stringify({ transcript: transcript.trim() }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Transcription failed' }) };
    }
};