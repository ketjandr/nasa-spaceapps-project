"""
DeepSeek API integration for intelligent query processing.
Provides fast semantic search with minimal cost.
"""

import os
import json
from typing import Dict, Any, Optional, List
import httpx
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
MAX_TOKENS_OUTPUT = 200
REQUEST_TIMEOUT = 10


async def parse_query_with_deepseek(query: str, target_body: Optional[str] = None) -> Dict[str, Any]:
    """
    Use DeepSeek API to intelligently parse natural language search queries.
    
    This replaces the local keyword-based parser with AI understanding.
    
    Args:
        query: Natural language search query (e.g., "Show me large craters on the Moon")
        target_body: Optional target body filter
        
    Returns:
        Structured search parameters with:
        - target_body: Planet/moon name
        - category: Feature type
        - size_filter: large/small if mentioned
        - search_keywords: Key terms for matching
        - confidence: How confident the parsing is (0-1)
    """
    
    if not DEEPSEEK_API_KEY:
        print("WARNING: DEEPSEEK_API_KEY not set in .env, using fallback parser")
        return _fallback_parser(query, target_body)
    
    system_prompt = """You are a planetary science search assistant. Parse natural language queries into structured JSON.

Extract these fields:
- target_body: "Moon", "Mars", "Mercury", "Venus", or "Earth"
- category: "crater", "mons", "montes", "vallis", "mare", "rima", "rupes", "dorsum", etc.
- size_filter: "large" or "small" if size is mentioned
- search_keywords: 3-5 most important search terms (array of strings)
- confidence: 0.0-1.0 how confident you are in the parsing

Return ONLY valid JSON, no other text.

Examples:
Input: "Show me large craters on the Moon"
Output: {"target_body": "Moon", "category": "crater", "size_filter": "large", "search_keywords": ["crater", "large", "impact", "moon"], "confidence": 0.95}

Input: "Find mountains on Mars"
Output: {"target_body": "Mars", "category": "mons", "search_keywords": ["mountain", "mons", "peak", "mars"], "confidence": 0.9}

Input: "Where are the biggest features on Mercury"
Output: {"target_body": "Mercury", "size_filter": "large", "search_keywords": ["large", "big", "feature", "mercury"], "confidence": 0.85}"""

    user_prompt = f"Parse this query: {query}"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                DEEPSEEK_API_URL,
                headers={
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "max_tokens": MAX_TOKENS_OUTPUT,
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"}
                },
                timeout=REQUEST_TIMEOUT
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                
                if target_body and not parsed.get("target_body"):
                    parsed["target_body"] = target_body
                
                print(f"DeepSeek parsed query: {parsed}")
                return parsed
            else:
                print(f"DeepSeek API error: {response.status_code} - {response.text}")
                return _fallback_parser(query, target_body)
                
    except httpx.TimeoutException:
        print("DeepSeek API timeout, using fallback")
        return _fallback_parser(query, target_body)
    except Exception as e:
        print(f"DeepSeek API error: {e}, using fallback")
        return _fallback_parser(query, target_body)


def _fallback_parser(query: str, target_body: Optional[str] = None) -> Dict[str, Any]:
    """Keyword-based fallback parser when DeepSeek API is unavailable."""
    query_lower = query.lower()
    result = {
        "confidence": 0.6,
        "search_keywords": []
    }
    
    body_keywords = {
        "moon": "Moon",
        "lunar": "Moon",
        "mars": "Mars",
        "martian": "Mars",
        "mercury": "Mercury",
        "venus": "Venus",
        "earth": "Earth"
    }
    
    for keyword, body in body_keywords.items():
        if keyword in query_lower:
            result["target_body"] = body
            break
    
    if target_body and "target_body" not in result:
        result["target_body"] = target_body
    
    if any(word in query_lower for word in ["crater", "impact", "basin"]):
        result["category"] = "crater"
    elif any(word in query_lower for word in ["mountain", "peak", "mons"]):
        result["category"] = "mons"
    elif any(word in query_lower for word in ["mountains", "range", "montes"]):
        result["category"] = "montes"
    elif any(word in query_lower for word in ["valley", "vallis"]):
        result["category"] = "vallis"
    elif any(word in query_lower for word in ["sea", "mare", "plain"]):
        result["category"] = "mare"
    
    if any(word in query_lower for word in ["large", "big", "huge", "biggest", "largest", "massive"]):
        result["size_filter"] = "large"
    elif any(word in query_lower for word in ["small", "tiny", "smallest"]):
        result["size_filter"] = "small"
    
    stop_words = {"show", "me", "find", "the", "on", "in", "at", "where", "are", "a", "an", "is"}
    words = query_lower.split()
    result["search_keywords"] = [w for w in words if w not in stop_words and len(w) > 2][:5]
    
    return result


async def generate_search_summary(results: List[Dict[str, Any]], query: str) -> str:
    """
    Use DeepSeek to generate a natural language summary of search results.
    
    Optional feature for enhanced UX. Only called if API key is available.
    
    Args:
        results: List of search results
        query: Original query
        
    Returns:
        Natural language summary
    """
    
    if not DEEPSEEK_API_KEY or not results:
        return f"Found {len(results)} results"
    
    # Create concise result summary for API
    result_summary = []
    for r in results[:5]:  # Only top 5
        result_summary.append({
            "name": r.get("name"),
            "type": r.get("category"),
            "body": r.get("body")
        })
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                DEEPSEEK_API_URL,
                headers={
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a helpful astronomy assistant. Summarize search results in 1-2 sentences."
                        },
                        {
                            "role": "user",
                            "content": f"Query: '{query}'\nResults: {json.dumps(result_summary)}\n\nSummarize:"
                        }
                    ],
                    "max_tokens": 100,
                    "temperature": 0.7
                },
                timeout=5
            )
            
            if response.status_code == 200:
                result = response.json()
                return result["choices"][0]["message"]["content"]
            else:
                return f"Found {len(results)} results"
                
    except Exception as e:
        print(f"Summary generation error: {e}")
        return f"Found {len(results)} results"


# Test function
if __name__ == "__main__":
    import asyncio
    
    async def test():
        queries = [
            "Show me large craters on the Moon",
            "Find mountains on Mars",
            "Where are the biggest features on Mercury"
        ]
        
        for query in queries:
            print(f"\nQuery: {query}")
            result = await parse_query_with_deepseek(query)
            print(f"Parsed: {json.dumps(result, indent=2)}")
    
    asyncio.run(test())
