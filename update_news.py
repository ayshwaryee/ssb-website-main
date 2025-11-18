import requests
import json
import os
import google.generativeai as genai
from datetime import datetime, timezone

# --- CONFIGURATION ---
# These keys are automatically provided by GitHub Secrets
NEWS_API_KEY = os.environ.get('NEWS_API_KEY')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

# Keywords to find SSB-relevant news (Example: expanded list)
KEYWORDS = 'DRDO OR "Indian Navy" OR "Indian Army" OR "Indian Air Force" OR ISRO OR HAL OR "Defence Ministry" OR BrahMos OR Agni-V OR Malabar OR LAC OR LOC OR Submarine OR Tejas OR Chandrayaan OR "Make in India"'

# The output file your HTML reads
OUTPUT_FILE = 'news.json'
# ---

def get_ai_summary(text):
    """Uses Gemini to summarize and categorize the news."""
    if not GEMINI_API_KEY: 
        print("GEMINI_API_KEY not found.")
        return None
    
    # Use the supported model: gemini-2.5-flash
    genai.configure(api_key=GEMINI_API_KEY)
    
    # The prompt requests a detailed 60-word summary and specific JSON output
    prompt = f"""
    You are an expert news summarizer for an SSB (Service Selection Board) academy website.
    Summarize this news for an SSB aspirant in about 60 words, providing slightly more detail. 
    Also assign a category: "Defence", "National", "International", or "Sci & Tech".

    Analyze the text and return *only* a single valid JSON object in the following format:
    {{"summary": "Your concise summary here.", "category": "One of the categories"}}

    ARTICLE TEXT:
    "{text}"
    """
    
    # Use the stable REST API endpoint for Gemini 2.5 Flash
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    headers = {"Content-Type": "application/json"}
    data = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }

    try:
        response = requests.post(gemini_url, headers=headers, data=json.dumps(data), timeout=20)
        response.raise_for_status() 
        
        result = response.json()
        
        # Extract and clean the JSON response from AI
        raw_json_text = result['candidates'][0]['content']['parts'][0]['text']
        cleaned_json_text = raw_json_text.strip().replace("```json", "").replace("```", "").strip()
        
        return json.loads(cleaned_json_text)

    except Exception as e:
        print(f"Error calling Gemini: {e}")
        return None

def fetch_and_process_news():
    """Main function to fetch news, summarize, and write to news.json"""
    if not NEWS_API_KEY:
        print("NEWS_API_KEY not found. Exiting.")
        return

    print("Fetching news from NewsAPI...")
    news_url = (f'https://newsapi.org/v2/everything?'
                f'q={KEYWORDS}&'
                f'language=en&'
                f'sortBy=publishedAt&'
                f'pageSize=35&' # Fetching 35 articles now
                f'apiKey={NEWS_API_KEY}')

    try:
        response = requests.get(news_url)
        news_data = response.json()

        if news_data['status'] != 'ok':
            print(f"Error from NewsAPI: {news_data.get('message')}")
            return

        initial_articles_list = []
        
        # 1. Capture the current time (This is the "Last Updated" time for the whole site)
        workflow_timestamp = datetime.now(timezone.utc).isoformat()
        
        for article in news_data['articles']:
            title = article.get('title')
            url = article.get('url')
            article_date = article.get('publishedAt') 
            text_to_summarize = article.get('content') or article.get('description')

            if not text_to_summarize or not title or not url:
                continue

            print(f"\nProcessing article: {title[:30]}...")
            
            ai_result = get_ai_summary(text_to_summarize)
            
            if ai_result and ai_result.get('summary') and ai_result.get('category'):
                formatted_article = {
                    "title": title,
                    "summary": ai_result['summary'],
                    "url": url,
                    "category": ai_result['category'],
                    "date": article_date, # Publication date of the article
                }
                initial_articles_list.append(formatted_article)
                print(f"-> Success. Category: {ai_result['category']}")
            else:
                print("-> Failed to get AI summary. Skipping.")

        
        # 3. Deduplicate the articles using the URL (unique identifier)
        unique_articles = {}
        for article in initial_articles_list:
            if article['url'] not in unique_articles:
                unique_articles[article['url']] = article
        
        final_articles_list = list(unique_articles.values())

        print(f"Initial article count: {len(initial_articles_list)}. Final unique count: {len(final_articles_list)} articles.")

        # 4. Create the final data structure with the timestamp
        final_json_data = {
            "last_updated": workflow_timestamp,
            "articles": final_articles_list
        }

        # Write the final list to the JSON file
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(final_json_data, f, indent=4)
        
        print(f"\nSuccessfully created {OUTPUT_FILE} with {len(final_articles_list)} unique articles.")

    except Exception as e:
        print(f"A critical error occurred: {e}")

if __name__ == "__main__":
    fetch_and_process_news()