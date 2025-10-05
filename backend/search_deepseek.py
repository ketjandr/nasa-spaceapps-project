"""
Fast AI-powered search using DeepSeek API
Replaces slow local embeddings with fast API-based intelligence
"""

from typing import List, Optional, Union, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func

from backend.database import get_db_session, PlanetaryFeature
from backend.deepseek_service import parse_query_with_deepseek, generate_search_summary

# Router for search endpoints
router = APIRouter(prefix="/search", tags=["search"])


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
    1. Parse query with DeepSeek API (fast, intelligent)
    2. Filter database by parsed criteria (body, category, size)
    3. Rank by keyword relevance
    4. Return top results
    
    Speed: 200-500ms (vs 5-10s for local models)
    Cost: ~$0.00003 per query (essentially free)
    """
    session = get_db_session()
    
    try:
        # Step 1: Parse query using DeepSeek API
        parsed_query = await parse_query_with_deepseek(request.query, request.target_body)
        
        print(f"DeepSeek parsed: {parsed_query}")
        
        # Step 2: Build database query with filters
        db_query = session.query(PlanetaryFeature)
        
        # Filter by target body
        target = parsed_query.get("target_body") or request.target_body
        if target:
            db_query = db_query.filter(
                func.lower(PlanetaryFeature.target_body) == target.lower()
            )
        
        # Filter by category
        if category := parsed_query.get("category"):
            db_query = db_query.filter(
                func.lower(PlanetaryFeature.category).like(f"%{category.lower()}%")
            )
        
        # Filter by size
        if size_filter := parsed_query.get("size_filter"):
            if size_filter.lower() == "large":
                db_query = db_query.filter(PlanetaryFeature.diameter > 50)
            elif size_filter.lower() == "small":
                db_query = db_query.filter(PlanetaryFeature.diameter < 10)
        
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
                match_score=round(score, 4)
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
        
        return SearchResponse(
            query=request.query,
            parsed_query=parsed_query,
            results=results,
            total_results=len(scored_features),
            summary=summary
        )
        
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
    score = 0.0
    
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
    
    # Bonus for matching parsed category exactly
    if parsed_query.get("category"):
        if parsed_query["category"].lower() in feature.category.lower():
            score += 1.5
    
    # Bonus for size matches
    if parsed_query.get("size_filter") == "large" and feature.diameter and feature.diameter > 100:
        score += 0.5
    elif parsed_query.get("size_filter") == "small" and feature.diameter and feature.diameter < 10:
        score += 0.5
    
    # Apply confidence multiplier from DeepSeek
    confidence = parsed_query.get("confidence", 0.8)
    score *= confidence
    
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
