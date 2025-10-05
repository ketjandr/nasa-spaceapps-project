"""AI service for generating embeddings using sentence transformers."""

from typing import List, Dict, Optional, Any, Tuple
import json
import os
import re
from pathlib import Path
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import numpy as np

# Load .env file if it exists
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

# Global model instance
_model: Optional[SentenceTransformer] = None
MODEL_NAME = "all-MiniLM-L6-v2"  # 384 dimensions, fast and efficient

# Input validation constants
MAX_QUERY_LENGTH = 500
MIN_QUERY_LENGTH = 2
DANGEROUS_PATTERNS = [
    r"[;<>|&$`]",  # Shell injection characters
    r"--",          # SQL comment
    r"/\*.*\*/",    # SQL block comment
    r"\bunion\s+select\b",  # SQL injection
    r"\bdrop\s+table\b",    # SQL injection
    r"<script",     # XSS
]


def get_model() -> SentenceTransformer:
    """
    Get or initialize the sentence transformer model.
    Model is cached globally for efficiency.
    """
    global _model
    if _model is None:
        print(f"Loading sentence transformer model: {MODEL_NAME}...")
        _model = SentenceTransformer(MODEL_NAME)
        print(f"Model loaded successfully. Embedding dimension: {_model.get_sentence_embedding_dimension()}")
    return _model


def sanitize_input(text: str) -> str:
    """
    Sanitize user input by removing potentially dangerous characters.
    
    Args:
        text: Raw user input
        
    Returns:
        Sanitized text safe for processing
    """
    if not text:
        return ""
    
    # Strip leading/trailing whitespace
    text = text.strip()
    
    # Remove null bytes
    text = text.replace('\x00', '')
    
    # Remove control characters except newline and tab
    text = ''.join(char for char in text if ord(char) >= 32 or char in ['\n', '\t'])
    
    # Replace multiple spaces with single space
    text = re.sub(r'\s+', ' ', text)
    
    return text


def validate_query(query: str) -> Tuple[bool, Optional[str]]:
    """
    Validate search query for safety and correctness.
    
    Args:
        query: Search query to validate
        
    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if query is valid, False otherwise
        - error_message: None if valid, error description if invalid
    """
    # Check if query is empty
    if not query or not query.strip():
        return False, "Query cannot be empty"
    
    # Check query length
    if len(query) < MIN_QUERY_LENGTH:
        return False, f"Query must be at least {MIN_QUERY_LENGTH} characters"
    
    if len(query) > MAX_QUERY_LENGTH:
        return False, f"Query must be less than {MAX_QUERY_LENGTH} characters"
    
    # Check for dangerous patterns
    query_lower = query.lower()
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, query_lower, re.IGNORECASE):
            return False, "Query contains invalid characters or patterns"
    
    # Check for excessive special characters (likely gibberish)
    special_char_count = sum(1 for char in query if not char.isalnum() and char not in [' ', '-', "'", ',', '.'])
    if special_char_count > len(query) * 0.3:
        return False, "Query contains too many special characters"
    
    return True, None


async def generate_embedding(text: str, validate: bool = True) -> List[float]:
    """
    Generate embedding vector for text using sentence transformers.
    
    Args:
        text: Text to embed (feature description or search query)
        validate: Whether to validate input (default True for user queries, False for trusted data)
        
    Returns:
        List of floats representing the embedding vector (384 dimensions for all-MiniLM-L6-v2)
        
    Raises:
        ValueError: If validation fails
    """
    try:
        # Sanitize input
        text = sanitize_input(text)
        
        # Validate if requested (typically for user queries)
        if validate:
            is_valid, error_msg = validate_query(text)
            if not is_valid:
                raise ValueError(f"Invalid query: {error_msg}")
        
        # Handle empty text after sanitization
        if not text:
            print("Warning: Empty text after sanitization, returning zero vector")
            return [0.0] * 384
        
        model = get_model()
        # Generate embedding (returns numpy array)
        embedding = model.encode(text, convert_to_numpy=True)
        # Convert to list of floats
        return embedding.tolist()
    except ValueError:
        # Re-raise validation errors
        raise
    except Exception as e:
        print(f"Error generating embedding: {e}")
        # Return zero vector as fallback to prevent crashes
        return [0.0] * 384


def create_searchable_text(feature: Dict[str, Any]) -> str:
    """
    Create comprehensive text description for a feature to embed.
    
    Args:
        feature: Dictionary with feature data
        
    Returns:
        Formatted text description
    """
    parts = []
    
    # Add feature name
    if name := feature.get("feature_name"):
        parts.append(f"Name: {name}")
    
    # Add target body
    if body := feature.get("target"):
        parts.append(f"Location: {body}")
    
    # Add category
    if category := feature.get("category"):
        parts.append(f"Type: {category}")
    
    # Add origin/etymology
    if origin := feature.get("origin"):
        parts.append(f"Named after: {origin}")
    
    # Add geographic info
    if lat := feature.get("center_lat"):
        parts.append(f"Latitude: {lat}")
    if lon := feature.get("center_lon"):
        parts.append(f"Longitude: {lon}")
    if diameter := feature.get("diameter"):
        parts.append(f"Diameter: {diameter} km")
    
    return ". ".join(parts)


async def parse_natural_query(query: str, target_body: Optional[str] = None) -> Dict[str, Any]:
    """
    Parse natural language query to extract intent using keyword-based rules.
    
    Examples:
        "show me dust storms on mars" -> {search_type: "event", event_category: "Dust and Haze", body: "Mars"}
        "large craters near tycho" -> {search_type: "feature", category: "crater", size_filter: "large"}
        "lunar mountains" -> {search_type: "feature", target_body: "Moon", category: "mons"}
        "features named after scientists" -> {origin_filter: "scientist"}
    
    Args:
        query: Natural language search query
        target_body: Optional body filter (Moon, Mars, etc.)
        
    Returns:
        Structured query parameters with search_type ("feature" or "event")
    """
    # Sanitize and validate input
    query = sanitize_input(query)
    is_valid, error_msg = validate_query(query)
    if not is_valid:
        return {
            "semantic_query": query,
            "error": error_msg,
            "search_type": "feature"
        }
    
    query_lower = query.lower()
    result: Dict[str, Any] = {
        "semantic_query": query,
        "search_type": "feature"  # Default to feature search
    }
    
    # Body keyword mapping (includes synonyms)
    # NOTE: Specific multi-word patterns should come before single words
    BODY_KEYWORDS = {
        "red planet": "Mars",  # Multi-word pattern first
        "moon": "Moon",
        "lunar": "Moon",
        "selenian": "Moon",
        "the moon": "Moon",
        "mars": "Mars",
        "martian": "Mars",
        "mercury": "Mercury",
        "mercurian": "Mercury",
        "venus": "Venus",
        "venusian": "Venus",
        "earth": "Earth",
        "terrestrial": "Earth",
        "terra": "Earth"
    }
    
    # Event keyword mapping for dynamic phenomena
    # NOTE: More specific patterns MUST come before general ones (e.g., "dust storm" before "storm")
    EVENT_KEYWORDS = {
        # Dust and atmospheric events (check specific patterns first)
        "dust storm": "Dust and Haze",
        "dust storms": "Dust and Haze",
        "sandstorm": "Dust and Haze",
        "sandstorms": "Dust and Haze",
        "dust devil": "Dust and Haze",
        "dust cloud": "Dust and Haze",
        "haze": "Dust and Haze",
        
        # Fire events
        "wildfire": "Wildfires",
        "wildfires": "Wildfires",
        "forest fire": "Wildfires",
        "fire": "Wildfires",
        "fires": "Wildfires",
        "burn": "Wildfires",
        "burning": "Wildfires",
        
        # Volcanic events
        "volcano": "Volcanoes",
        "volcanoes": "Volcanoes",
        "volcanic": "Volcanoes",
        "eruption": "Volcanoes",
        "eruptions": "Volcanoes",
        "lava": "Volcanoes",
        
        # Weather storms (more general, comes after dust storms)
        "hurricane": "Severe Storms",
        "cyclone": "Severe Storms",
        "typhoon": "Severe Storms",
        "tornado": "Severe Storms",
        "storm": "Severe Storms",
        "storms": "Severe Storms",
        "tempest": "Severe Storms",
        
        # Water events
        "flood": "Floods",
        "floods": "Floods",
        "flooding": "Floods",
        "inundation": "Floods",
        
        # Seismic events
        "earthquake": "Earthquakes",
        "earthquakes": "Earthquakes",
        "seismic": "Earthquakes",
        "tremor": "Earthquakes",
        "quake": "Earthquakes",
        
        # Climate events
        "drought": "Drought",
        "droughts": "Drought",
        "dry spell": "Drought",
        
        # Ice and snow events
        "sea ice": "Sea and Lake Ice",
        "lake ice": "Sea and Lake Ice",
        "ice": "Sea and Lake Ice",
        "snow": "Snow",
        "snowfall": "Snow",
        "blizzard": "Snow"
    }
    
    # Check for event keywords first (higher priority)
    for keyword, event_category in EVENT_KEYWORDS.items():
        if keyword in query_lower:
            result["search_type"] = "event"
            result["event_category"] = event_category
            result["event_keyword"] = keyword
            break
    
    # Extract target body with synonym support
    for keyword, body_name in BODY_KEYWORDS.items():
        if keyword in query_lower:
            result["target_body"] = body_name
            break
    
    if target_body and "target_body" not in result:
        result["target_body"] = target_body
    
    # Add warning for event searches (database currently only has static features)
    if result["search_type"] == "event":
        result["warning"] = (
            f"Searching for dynamic events like '{result.get('event_keyword', 'events')}'. "
            "Note: Current database contains only static planetary features (craters, mountains, etc.). "
            "For real-time event data, NASA EONET API integration is required. "
            "Results will show semantically similar features if available."
        )
    
    # Extract category keywords (only for feature searches)
    if result["search_type"] == "feature":
        category_patterns = {
            "crater": ["crater", "impact", "basin"],
            "mons": ["mountain", "peak", "mons"],
            "montes": ["mountains", "range", "montes"],
            "vallis": ["valley", "vallis"],
            "mare": ["sea", "mare", "plain"],
            "rima": ["rille", "channel", "rima"],
            "rupes": ["cliff", "scarp", "rupes"],
            "dorsum": ["ridge", "dorsum"],
            "lacus": ["lake", "lacus"],
            "palus": ["marsh", "palus"]
        }
        
        for category, keywords in category_patterns.items():
            if any(kw in query_lower for kw in keywords):
                result["category"] = category.capitalize()
                break
    
    # Extract size filters
    if any(word in query_lower for word in ["large", "big", "huge", "major"]):
        result["size_filter"] = "large"
    elif any(word in query_lower for word in ["small", "tiny", "minor"]):
        result["size_filter"] = "small"
    
    # Extract origin keywords
    if any(word in query_lower for word in ["named after", "origin", "scientist", "astronaut", "person"]):
        result["origin_filter"] = True
    
    return result


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors.
    
    Args:
        vec1: First embedding vector
        vec2: Second embedding vector
        
    Returns:
        Similarity score between -1 and 1 (higher is more similar)
    """
    import numpy as np
    
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    
    dot_product = np.dot(v1, v2)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return float(dot_product / (norm1 * norm2))


if __name__ == "__main__":
    # Test the AI service
    import asyncio
    
    async def test():
        # Test embedding generation
        test_text = "Tycho is a large impact crater on the Moon"
        embedding = await generate_embedding(test_text)
        print(f"Generated embedding with {len(embedding)} dimensions")
        print(f"First 5 values: {embedding[:5]}")
        
        # Test query parsing
        queries = [
            "show me dust storms on mars",
            "large craters near tycho",
            "mountains on the moon"
        ]
        
        for q in queries:
            result = await parse_natural_query(q)
            print(f"\nQuery: {q}")
            print(f"Parsed: {json.dumps(result, indent=2)}")
        
        # Test cosine similarity
        text1 = "large impact crater on the moon"
        text2 = "lunar crater formation"
        text3 = "martian volcano"
        
        emb1 = await generate_embedding(text1)
        emb2 = await generate_embedding(text2)
        emb3 = await generate_embedding(text3)
        
        print(f"\nSimilarity between '{text1}' and '{text2}': {cosine_similarity(emb1, emb2):.4f}")
        print(f"Similarity between '{text1}' and '{text3}': {cosine_similarity(emb1, emb3):.4f}")
    
    asyncio.run(test())
