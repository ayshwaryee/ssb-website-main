// netlify/functions/groq.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed'
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { promptText } = body;

        // Netlify securely injects your API key here
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'GROQ_API_KEY is not configured'
                })
            };
        }

        const response = await fetch(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'openai/gpt-oss-20b',
                    reasoning_effort: 'low',

                    messages: [
                        {
                            role: 'user',
                            content: promptText
                        }
                    ],

                    response_format: {
                        type: 'json_object'
                    }
                })
            }
        );

        const data = await response.json();

        // Check if Groq returned an error
        if (!response.ok) {
            console.error('Groq API Error:', data);

            return {
                statusCode: response.status,
                body: JSON.stringify({
                    error: data.error?.message || 'Groq API request failed'
                })
            };
        }

        // Get the AI response
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'Groq returned an empty response'
                })
            };
        }

        // Send the AI response back to your frontend
        return {
            statusCode: 200,
            body: JSON.stringify(JSON.parse(content))
        };

    } catch (error) {
        console.error('Groq Function Error:', error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to connect to Groq'
            })
        };
    }
};