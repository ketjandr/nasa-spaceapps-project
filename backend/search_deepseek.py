"""
Fast AI-powered search using DeepSeek API
Replaces slow local embeddings with fast API-based intelligence
"""

from typing import List, Optional, Union, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
import time
from functools import lru_cache

from backend.database import get_db_session, PlanetaryFeature
from backend.deepseek_service import parse_query_with_deepseek, generate_search_summary

# Router for search endpoints
router = APIRouter(prefix="/search", tags=["search"])

# Simple in-memory cache for frequent queries
_search_cache = {}
_cache_max_size = 100

def _get_cache_key(query: str, target_body: Optional[str] = None) -> str:
    """Generate cache key for search query."""
    return f"{query.lower()}:{target_body or 'all'}"

def _get_cached_result(cache_key: str) -> Optional[Dict]:
    """Get cached search result if available and not expired."""
    if cache_key in _search_cache:
        result, timestamp = _search_cache[cache_key]
        # Cache for 5 minutes
        if time.time() - timestamp < 300:
            return result
        else:
            del _search_cache[cache_key]
    return None

def _cache_result(cache_key: str, result: Dict):
    """Cache search result."""
    # Simple cache eviction - remove oldest if full
    if len(_search_cache) >= _cache_max_size:
        oldest_key = min(_search_cache.keys(), key=lambda k: _search_cache[k][1])
        del _search_cache[oldest_key]
    
    _search_cache[cache_key] = (result, time.time())


# Request/Response Models
class SearchRequest(BaseModel):
    query: str
    target_body: Optional[str] = None
    limit: int = 10


class FeatureResult(BaseModel):
    id: int
    name: str
    body: str
    category: str
    latitude: float
    longitude: float
    diameter: Optional[float] = None
    origin: Optional[str] = None
    description: Optional[str] = None
    match_score: Optional[float] = None
    image_url: Optional[str] = None  # Direct link to feature images endpoint


class SearchResponse(BaseModel):
    query: str
    parsed_query: dict
    results: List[FeatureResult]
    total_results: int
    summary: Optional[str] = None


@router.post("/query")
async def semantic_search(request: SearchRequest) -> SearchResponse:
    """
    Fast AI-powered semantic search using DeepSeek API.
    
    Process:
    1. Check cache for recent similar queries
    2. Parse query with DeepSeek API (fast, intelligent)
    3. Filter database by parsed criteria (body, category, size)
    4. Rank by keyword relevance
    5. Return top results
    
    Speed: 50-500ms (vs 5-10s for local models)
    Cost: ~$0.00003 per query (essentially free)
    """
    # Check cache first
    cache_key = _get_cache_key(request.query, request.target_body)
    cached_result = _get_cached_result(cache_key)
    if cached_result:
        print(f"Cache hit for query: {request.query}")
        return SearchResponse(**cached_result)
    
    session = get_db_session()
    
    try:
        # Step 1: Parse query using DeepSeek API
        parsed_query = await parse_query_with_deepseek(request.query, request.target_body)
        
        print(f"DeepSeek parsed: {parsed_query}")
        
        # Step 2: Build database query with filters
        db_query = session.query(PlanetaryFeature)
        
        # Filter by target body (case-insensitive)
        target = parsed_query.get("target_body") or request.target_body
        if target:
            db_query = db_query.filter(
                func.lower(PlanetaryFeature.target_body) == func.lower(target)
            )
        
        # Filter by category
        if category := parsed_query.get("category"):
            db_query = db_query.filter(
                func.lower(PlanetaryFeature.category).like(f"%{category.lower()}%")
            )
        
        # Filter by size (currently disabled - database has no diameter data)
        # Size filtering is done in keyword scoring instead
        # if size_filter := parsed_query.get("size_filter"):
        #     if size_filter.lower() == "large":
        #         db_query = db_query.filter(PlanetaryFeature.diameter > 50)
        #     elif size_filter.lower() == "small":
        #         db_query = db_query.filter(PlanetaryFeature.diameter < 10)
        
        # Limit results for performance
        features = db_query.limit(1000).all()
        
        print(f"Found {len(features)} features after filtering")
        
        # Step 3: Score features based on keyword relevance
        search_keywords = parsed_query.get("search_keywords", [])
        scored_features = []
        
        for feature in features:
            score = _calculate_keyword_score(feature, search_keywords, parsed_query)
            if score > 0:
                scored_features.append((feature, score))
        
        # Sort by score
        scored_features.sort(key=lambda x: x[1], reverse=True)
        
        print(f"Scored {len(scored_features)} features")
        
        # Step 4: Format results
        results = []
        for feature, score in scored_features[:request.limit]:
            results.append(FeatureResult(
                id=feature.id,
                name=feature.feature_name,
                body=feature.target_body,
                category=feature.category,
                latitude=feature.latitude,
                longitude=feature.longitude,
                diameter=feature.diameter,
                origin=feature.origin,
                description=feature.description,
                match_score=round(score, 4),
                image_url=f"/features/{feature.id}/images"  # Link to images endpoint
            ))
        
        # Step 5: Generate natural language summary (optional, only if results exist)
        summary = None
        if results and len(results) > 0:
            try:
                summary = await generate_search_summary(
                    [r.dict() for r in results],
                    request.query
                )
            except Exception as e:
                print(f"Summary generation failed: {e}")
                summary = f"Found {len(results)} matching features"
        
        response = SearchResponse(
            query=request.query,
            parsed_query=parsed_query,
            results=results,
            total_results=len(scored_features),
            summary=summary
        )
        
        # Cache the result for future requests
        _cache_result(cache_key, response.dict())
        
        return response
        
    except Exception as e:
        print(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")
    finally:
        session.close()


def _calculate_keyword_score(
    feature: PlanetaryFeature,
    keywords: List[str],
    parsed_query: Dict[str, Any]
) -> float:
    """
    Calculate relevance score based on keyword matching.
    Fast alternative to embedding similarity.
    """
    # Start with base score for features that passed filtering
    score = 1.0  # Base score for being in filtered results
    
    # Combine all searchable text
    feature_text = (
        f"{feature.feature_name} {feature.category} {feature.description or ''}"
    ).lower()
    
    # Score based on keyword matches
    for keyword in keywords:
        if keyword.lower() in feature_text:
            # Higher score for name matches
            if keyword.lower() in feature.feature_name.lower():
                score += 1.0
            # Medium score for category matches
            elif keyword.lower() in feature.category.lower():
                score += 0.5
            # Lower score for description matches
            else:
                score += 0.3
    
    # Big bonus for matching parsed category exactly (most important)
    if parsed_query.get("category"):
        if parsed_query["category"].lower() in feature.category.lower():
            score += 2.0
    
    # Bonus for target body match
    if parsed_query.get("target_body"):
        if parsed_query["target_body"].lower() == feature.target_body.lower():
            score += 1.0
    
    # Bonus for size matches (even without diameter data, give partial credit)
    if parsed_query.get("size_filter"):
        if feature.diameter:
            if parsed_query["size_filter"] == "large" and feature.diameter > 100:
                score += 1.0
            elif parsed_query["size_filter"] == "small" and feature.diameter < 10:
                score += 1.0
        else:
            # No diameter data - give small bonus for having size in keywords
            score += 0.2
    
    return score


@router.get("/autocomplete")
async def autocomplete_search(
    q: str = Query(..., min_length=2, description="Search query prefix"),
    target_body: Optional[str] = Query(None, description="Filter by planetary body"),
    limit: int = Query(10, ge=1, le=50)
):
    """Fast autocomplete based on feature names."""
    session = get_db_session()
    
    try:
        query = session.query(PlanetaryFeature.feature_name).distinct()
        query = query.filter(
            func.lower(PlanetaryFeature.feature_name).like(f"{q.lower()}%")
        )
        
        if target_body:
            query = query.filter(PlanetaryFeature.target_body == target_body)
        
        results = query.limit(limit).all()
        return {"suggestions": [r[0] for r in results]}
        
    finally:
        session.close()


@router.get("/feature/{feature_id}")
async def get_feature_detail(feature_id: int) -> FeatureResult:
    """Get detailed information about a specific feature."""
    session = get_db_session()
    
    try:
        feature = session.query(PlanetaryFeature).filter(
            PlanetaryFeature.id == feature_id
        ).first()
        
        if not feature:
            raise HTTPException(status_code=404, detail="Feature not found")
        
        return FeatureResult(
            id=feature.id,
            name=feature.feature_name,
            body=feature.target_body,
            category=feature.category,
            latitude=feature.latitude,
            longitude=feature.longitude,
            diameter=feature.diameter,
            origin=feature.origin,
            description=feature.description
        )
        
    finally:
        session.close()


@router.post("/discover/recommendations")
async def get_discovery_recommendations(
    interests: List[str] = Query([], description="User interests"),
    limit: int = Query(6, ge=1, le=20)
):
    """Get personalized feature recommendations using AI."""
    from backend.deepseek_service import generate_discovery_recommendations
    
    session = get_db_session()
    
    try:
        # Get available features
        features = session.query(PlanetaryFeature).limit(200).all()
        feature_data = []
        
        for f in features:
            feature_data.append({
                "name": f.feature_name,
                "body": f.target_body,
                "category": f.category,
                "keywords": [f.target_body, f.category, f.feature_name],
                "coordinates": {"lat": f.latitude, "lon": f.longitude}
            })
        
        # Get AI recommendations
        recommendations = await generate_discovery_recommendations(
            interests, feature_data, limit
        )
        
        return {
            "recommendations": recommendations,
            "total": len(recommendations)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")
    finally:
        session.close()


@router.get("/discover/insights/{feature_name}")
async def get_feature_insights(feature_name: str):
    """Get AI-generated insights about a specific feature."""
    from backend.deepseek_service import generate_feature_insights
    
    session = get_db_session()
    
    try:
        # Find the feature
        feature = session.query(PlanetaryFeature).filter(
            PlanetaryFeature.feature_name.ilike(f"%{feature_name}%")
        ).first()
        
        if not feature:
            raise HTTPException(status_code=404, detail="Feature not found")
        
        feature_data = {
            "name": feature.feature_name,
            "body": feature.target_body,
            "category": feature.category,
            "coordinates": {"lat": feature.latitude, "lon": feature.longitude},
            "description": feature.description
        }
        
        # Generate insights
        insights = await generate_feature_insights(feature_data)
        
        return {
            "feature": feature_data,
            "insights": insights
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Insights error: {str(e)}")
    finally:
        session.close()
