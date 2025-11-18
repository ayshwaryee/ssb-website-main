import requests
import json
import os
import time

# --- 1. CONFIGURATION ---
# Get your keys from GitHub Secrets (we'll set this up in Step 4)
NEWS_API_KEY = os.environ.get('NEWS_API_KEY')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

# Keywords to find SSB-relevant news
KEYWORDS = '"DRDO" OR "Indian Navy" OR "Indian Army" OR "Indian Air Force" OR ISRO OR HAL OR "Defence Ministry"'

# The output file your HTML reads
OUTPUT_FILE = 'news.json'
# ---

def summarize_with_gemini(article_text, retries=3):
    """
    Uses the Gemini AI to summarize an article and categorize it.
    """
    if not GEMINI_API_KEY:
        print("GEMINI_API_KEY not found.")
        return None

    # This prompt asks the AI to return *only* a JSON object
    prompt = f"""
    You are an expert news summarizer for an SSB (Service Selection Board) academy website.
    Your goal is to provide a concise summary and a category for the following article text.
    
    The categories must be *only* one of these:
    "Defence", "National", "International", "Sci & Tech"

    Analyze the text and return *only* a single valid JSON object in the following format:
    {{"summary": "Your concise summary here.", "category": "One of the categories"}}

    ARTICLE TEXT:
    "{article_text}"
    """
    
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={GEMINI_API_KEY}"
    
    headers = {"Content-Type": "application/json"}
    data = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }

    for attempt in range(retries):
        try:
            response = requests.post(gemini_url, headers=headers, data=json.dumps(data), timeout=20)
            response.raise_for_status() # Raise an error for bad responses (4xx, 5xx)
            
            result = response.json()
            
            # Extract the raw text and clean it
            raw_json_text = result['candidates'][0]['content']['parts'][0]['text']
            
            # Clean it in case the AI adds markdown backticks
            cleaned_json_text = raw_json_text.strip().replace("```json", "").replace("```", "").strip()
            
            # Parse the JSON string from the AI
            ai_data = json.loads(cleaned_json_text)
            return ai_data

        except Exception as e:
            print(f"Error calling Gemini (Attempt {attempt + 1}/{retries}): {e}")
            print("Response:", response.text if 'response' in locals() else 'No response')
            time.sleep(5) # Wait before retrying
    
    return None

def fetch_and_process_news():
    """
    Main function to fetch news, summarize, and write to news.json
    """
    if not NEWS_API_KEY:
        print("NEWS_API_KEY not found. Exiting.")
        return

    print("Fetching news from NewsAPI...")
    # We fetch 'content' to give the AI something to summarize
    news_url = (f'https://newsapi.org/v2/everything?'
                f'q={KEYWORDS}&'
                f'language=en&'
                f'sortBy=publishedAt&'
                f'pageSize=12&' # Get 12 recent articles
                f'apiKey={NEWS_API_KEY}')

    try:
        response = requests.get(news_url)
        news_data = response.json()

        if news_data['status'] != 'ok':
            print(f"Error from NewsAPI: {news_data.get('message')}")
            return

        final_articles_list = []
        
        for article in news_data['articles']:
            title = article.get('title')
            url = article.get('url')
            # Use 'description' or 'content' as text for the AI
            text_to_summarize = article.get('content') or article.get('description')

            if not text_to_summarize or not title or not url:
                continue

            print(f"\nProcessing article: {title}")
            
            # Call the AI for summarization and categorization
            ai_result = summarize_with_gemini(text_to_summarize)
            
            if ai_result and ai_result.get('summary') and ai_result.get('category'):
                # Format it exactly as your 'current-affairs.html' expects
                formatted_article = {
                    "title": title,
                    "summary": ai_result['summary'],
                    "url": url,
                    "category": ai_result['category']
                }
                final_articles_list.append(formatted_article)
                print(f"-> Success. Category: {ai_result['category']}")
            else:
                print("-> Failed to get AI summary. Skipping.")

        # Write the final list to the JSON file
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(final_articles_list, f, indent=4)
        
        print(f"\nSuccessfully created {OUTPUT_FILE} with {len(final_articles_list)} articles.")

    except Exception as e:
        print(f"A critical error occurred: {e}")

# --- 3. RUN THE SCRIPT ---
if __name__ == "__main__":
    fetch_and_process_news()