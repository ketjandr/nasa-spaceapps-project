"""
Intelligent Search Service using DeepSeek API
Provides natural language query understanding and intelligent filtering
"""

from typing import Dict, List, Optional, Any
import re
from .deepseek_service import parse_query_with_deepseek
import logging
import httpx

logger = logging.getLogger(__name__)


class QueryUnderstanding:
    """Structured understanding of a search query"""
    def __init__(
        self,
        intent: str,
        target_body: Optional[str] = None,
        feature_type: Optional[str] = None,
        size_filter: Optional[str] = None,
        keywords: Optional[List[str]] = None,
        temporal_filter: Optional[str] = None,
        spatial_filter: Optional[Dict[str, Any]] = None,
        comparison: Optional[Dict[str, Any]] = None
    ):
        self.intent = intent
        self.target_body = target_body
        self.feature_type = feature_type
        self.size_filter = size_filter
        self.keywords = keywords or []
        self.temporal_filter = temporal_filter
        self.spatial_filter = spatial_filter or {}
        self.comparison = comparison or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "intent": self.intent,
            "target_body": self.target_body,
            "feature_type": self.feature_type,
            "size_filter": self.size_filter,
            "keywords": self.keywords,
            "temporal_filter": self.temporal_filter,
            "spatial_filter": self.spatial_filter,
            "comparison": self.comparison
        }


def is_complex_query(query: str) -> bool:
    """
    Detect if query requires natural language processing
    Returns True for complex queries, False for simple keyword searches
    """
    query_lower = query.lower().strip()
    
    # Simple single-word or two-word searches
    if len(query_lower.split()) <= 2:
        return False
    
    # Complex query indicators
    complex_indicators = [
        r'\b(show|find|get|display|give)\s+(me|us)\b',  # "show me", "find me"
        r'\b(large|small|huge|massive|tiny|recent|old|ancient)\b',  # Size/time adjectives
        r'\b(than|more|less|over|under|above|below)\b',  # Comparisons
        r'\b(near|around|in|on|at|within)\b',  # Spatial
        r'\b(where|what|which|when|how)\b',  # Questions
        r'\d+\s*(km|meters|miles)',  # Measurements
        r'\b(between|from|to)\b',  # Ranges
    ]
    
    for pattern in complex_indicators:
        if re.search(pattern, query_lower):
            return True
    
    return False


async def understand_query(query: str) -> QueryUnderstanding:
    """
    Use DeepSeek API to understand natural language search queries
    """
    try:
        # Use existing parse_query_with_deepseek function
        parsed = await parse_query_with_deepseek(query)
        
        # Map the parsed result to QueryUnderstanding
        return QueryUnderstanding(
            intent=parsed.get("intent", "explore"),
            target_body=parsed.get("target_body"),
            feature_type=parsed.get("feature_type"),
            size_filter=parsed.get("size_description"),  # Maps to size filter
            keywords=parsed.get("keywords", []),
            temporal_filter=None,  # Not in current parser
            spatial_filter={},
            comparison={}
        )
            
    except Exception as e:
        logger.error(f"Error understanding query with DeepSeek: {e}")
        return fallback_understanding(query)


def fallback_understanding(query: str) -> QueryUnderstanding:
    """Fallback understanding using simple keyword extraction"""
    query_lower = query.lower()
    
    # Extract body
    target_body = None
    if "mars" in query_lower:
        target_body = "Mars"
    elif "moon" in query_lower:
        target_body = "Moon"
    elif "mercury" in query_lower:
        target_body = "Mercury"
    
    # Extract feature type
    feature_type = None
    if "crater" in query_lower:
        feature_type = "Crater"
    elif "mountain" in query_lower or "mons" in query_lower:
        feature_type = "Mountain"
    elif "valley" in query_lower or "vallis" in query_lower:
        feature_type = "Valley"
    
    # Extract size
    size_filter = None
    if any(word in query_lower for word in ["large", "big", "huge", "massive"]):
        size_filter = "large"
    elif any(word in query_lower for word in ["small", "tiny", "little"]):
        size_filter = "small"
    
    # Extract keywords
    keywords = [word for word in query_lower.split() if len(word) > 2]
    
    return QueryUnderstanding(
        intent="explore",
        target_body=target_body,
        feature_type=feature_type,
        size_filter=size_filter,
        keywords=keywords
    )


def apply_intelligent_filters(
    features: List[Dict[str, Any]], 
    understanding: QueryUnderstanding
) -> List[Dict[str, Any]]:
    """
    Apply intelligent filtering based on query understanding
    """
    filtered = features
    
    # Filter by body
    if understanding.target_body:
        filtered = [f for f in filtered if f.get("body") == understanding.target_body]
    
    # Filter by feature type
    if understanding.feature_type:
        filtered = [f for f in filtered 
                   if understanding.feature_type.lower() in f.get("category", "").lower()]
    
    # Filter by size
    if understanding.size_filter:
        size_keywords = {
            "large": ["large", "major", "big"],
            "small": ["small", "minor", "little"],
            "huge": ["huge", "massive", "giant"],
        }
        
        relevant_keywords = size_keywords.get(understanding.size_filter, [])
        filtered = [f for f in filtered 
                   if any(kw in " ".join(f.get("keywords", [])).lower() 
                         for kw in relevant_keywords)]
    
    # Filter by keywords
    if understanding.keywords:
        filtered = [f for f in filtered
                   if any(kw in f.get("name", "").lower() or
                         kw in f.get("category", "").lower() or
                         kw in " ".join(f.get("keywords", [])).lower()
                         for kw in understanding.keywords)]
    
    # Apply comparisons (e.g., height > 5km)
    if understanding.comparison:
        comp = understanding.comparison
        if comp.get("attribute") == "height":
            operator = comp.get("operator")
            value = comp.get("value", 0)
            
            # Filter features with height data
            filtered = [f for f in filtered if "height" in f.get("properties", {})]
            
            if operator == ">":
                filtered = [f for f in filtered 
                           if f.get("properties", {}).get("height", 0) > value]
            elif operator == "<":
                filtered = [f for f in filtered 
                           if f.get("properties", {}).get("height", 0) < value]
    
    return filtered
