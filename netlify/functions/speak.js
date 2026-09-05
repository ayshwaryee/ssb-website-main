const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);
        const { text, voiceId } = body;
        
        // Netlify securely injects your API key here
        const apiKey = process.env.ELEVENLABS_API_KEY; 

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: { 
                'xi-api-key': apiKey, 
                'Content-Type': 'application/json', 
                'Accept': 'audio/mpeg' 
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                language_code: 'hi',
                voice_settings: { stability: 0.58, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true }
            })
        });

        if (!response.ok) {
            throw new Error(`ElevenLabs API responded with ${response.status}`);
        }

        // Fetch the audio as an ArrayBuffer, then convert to a Buffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Return the binary audio data as a base64 encoded string
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
            },
            body: buffer.toString('base64'),
            isBase64Encoded: true // Crucial: tells Netlify to decode this back into a file
        };
    } catch (error) {
        console.error('TTS Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate speech' }) };
    }
};