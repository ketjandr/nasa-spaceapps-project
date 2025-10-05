"""
AI-powered semantic search endpoints for planetary features and real-time events.
"""

from typing import List, Optional, Union, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_, func
import numpy as np

from backend.database import get_db_session, PlanetaryFeature
from backend.ai_service import generate_embedding, parse_natural_query, cosine_similarity
from backend.eonet import (
    search_events_by_category,
    format_event_for_display,
    EONETEvent
)


# Router for search endpoints
router = APIRouter(prefix="/search", tags=["search"])


# Request/Response Models
class SearchRequest(BaseModel):
    query: str
    target_body: Optional[str] = None
    limit: int = 10
    include_events: bool = True  # Include EONET events in search results
    event_days: int = 30  # Number of days to look back for events
    

class FeatureResult(BaseModel):
    id: Union[int, str]  # int for features, str for events
    name: str
    body: Optional[str] = None  # Events may not have a body
    category: Union[str, List[str]]  # Single for features, list for events
    latitude: Optional[float]
    longitude: Optional[float]
    diameter: Optional[float] = None
    origin: Optional[str] = None
    description: Optional[str] = None
    similarity_score: Optional[float] = None
    is_dynamic_event: bool = False  # True for EONET events
    event_date: Optional[str] = None  # For EONET events
    event_link: Optional[str] = None  # For EONET events
    event_sources: Optional[List[dict]] = None  # For EONET events


class SearchResponse(BaseModel):
    query: str
    parsed_query: dict
    results: List[FeatureResult]
    total_results: int
    event_count: int = 0  # Number of EONET events included
    feature_count: int = 0  # Number of database features included


class AutocompleteResponse(BaseModel):
    suggestions: List[str]


# Endpoints

@router.get("/autocomplete")
async def autocomplete_search(
    q: str = Query(..., min_length=2, description="Search query prefix"),
    target_body: Optional[str] = Query(None, description="Filter by planetary body"),
    limit: int = Query(10, ge=1, le=50)
) -> AutocompleteResponse:
    """
    Fast autocomplete suggestions based on feature names.
    Returns matches that start with the query string.
    """
    session = get_db_session()
    
    try:
        # Build query
        query = session.query(PlanetaryFeature.feature_name).distinct()
        
        # Filter by prefix (case-insensitive)
        query = query.filter(
            func.lower(PlanetaryFeature.feature_name).like(f"{q.lower()}%")
        )
        
        # Filter by target body if specified
        if target_body:
            query = query.filter(PlanetaryFeature.target_body == target_body)
        
        # Get results
        results = query.limit(limit).all()
        suggestions = [r[0] for r in results]
        
        return AutocompleteResponse(suggestions=suggestions)
        
    finally:
        session.close()


@router.post("/query")
async def semantic_search(request: SearchRequest) -> SearchResponse:
    """
    Unified semantic search combining static features and real-time EONET events.
    
    Process:
    1. Parse query using keyword extraction (no external API needed)
    2. Generate embedding for semantic matching using local model
    3. If event search: Fetch EONET events
    4. Filter database features by parsed criteria (body, category, size)
    5. Rank by cosine similarity to query embedding
    6. Combine and return top results
    """
    session = get_db_session()
    
    try:
        # Step 1: Parse natural language query using keyword-based extraction
        parsed_query = await parse_natural_query(
            request.query, 
            target_body=request.target_body
        )
        
        print(f"Parsed query: {parsed_query}")
        
        # Step 2: Generate query embedding using sentence transformers
        query_embedding = await generate_embedding(request.query)
        
        all_results = []
        event_count = 0
        feature_count = 0
        
        # Step 3: If this is an event search and events are enabled, fetch EONET events
        if request.include_events and parsed_query.get("search_type") == "event":
            event_category = parsed_query.get("event_category")
            if event_category:
                print(f"Fetching EONET events for category: {event_category}")
                try:
                    eonet_events = await search_events_by_category(
                        event_category,
                        limit=request.limit,
                        days=request.event_days
                    )
                    print(f"Found {len(eonet_events)} EONET events")
                    
                    # Convert EONET events to FeatureResult format
                    for event in eonet_events:
                        formatted_event = format_event_for_display(event)
                        result = FeatureResult(
                            id=formatted_event["id"],
                            name=formatted_event["name"],
                            body=None,  # Events are on Earth, not other bodies
                            category=formatted_event["categories"],
                            latitude=formatted_event["latitude"],
                            longitude=formatted_event["longitude"],
                            description=formatted_event["description"],
                            is_dynamic_event=True,
                            event_date=formatted_event["date"],
                            event_link=formatted_event["link"],
                            event_sources=formatted_event["sources"],
                            similarity_score=0.95  # High score for direct category match
                        )
                        all_results.append(result)
                        event_count += 1
                        
                except Exception as e:
                    print(f"Error fetching EONET events: {e}")
                    # Continue with feature search even if EONET fails
        
        # Step 4: Build database query with filters for static features
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
        
        # Filter by origin if specified
        if parsed_query.get("origin_filter") and parsed_query.get("origin_filter") is True:
            db_query = db_query.filter(PlanetaryFeature.origin.isnot(None))
        
        # Get all matching features (we'll rank them by similarity)
        features = db_query.all()
        
        print(f"Found {len(features)} matching features before similarity ranking")
        
        # Step 5: Calculate similarity scores for features
        scored_features = []
        for feature in features:
            if feature.embedding_data:
                similarity = cosine_similarity(query_embedding, feature.embedding_data)
                scored_features.append((feature, similarity))
        
        # Sort by similarity
        scored_features.sort(key=lambda x: x[1], reverse=True)
        
        # Format feature results
        for feature, score in scored_features[:request.limit]:
            result = FeatureResult(
                id=feature.id,
                name=feature.feature_name,
                body=feature.target_body,
                category=feature.category,
                latitude=feature.latitude,
                longitude=feature.longitude,
                diameter=feature.diameter,
                origin=feature.origin,
                description=feature.description,
                similarity_score=round(score, 4),
                is_dynamic_event=False
            )
            all_results.append(result)
            feature_count += 1
        
        # Step 6: Sort combined results by similarity score and limit
        all_results.sort(key=lambda x: x.similarity_score or 0, reverse=True)
        final_results = all_results[:request.limit]
        
        return SearchResponse(
            query=request.query,
            parsed_query=parsed_query,
            results=final_results,
            total_results=len(all_results),
            event_count=event_count,
            feature_count=feature_count
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")
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


@router.get("/nearby")
async def find_nearby_features(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    target_body: str = Query(...),
    radius_km: float = Query(100, ge=1, le=5000),
    limit: int = Query(10, ge=1, le=50)
) -> List[FeatureResult]:
    """
    Find features near a coordinate using simple distance calculation.
    
    Note: This uses a simple Euclidean approximation, not great-circle distance.
    Good enough for small areas on a planetary body.
    """
    session = get_db_session()
    
    try:
        # Get all features on the target body
        features = session.query(PlanetaryFeature).filter(
            PlanetaryFeature.target_body == target_body
        ).all()
        
        # Calculate distances (simple Euclidean in lat/lon space)
        # For better accuracy, use haversine formula
        nearby = []
        for feature in features:
            lat_diff = abs(feature.latitude - lat)
            lon_diff = abs(feature.longitude - lon)
            
            # Rough distance estimate (not accurate for poles or large distances)
            distance = np.sqrt(lat_diff**2 + lon_diff**2) * 111  # ~111 km per degree
            
            if distance <= radius_km:
                nearby.append((feature, distance))
        
        # Sort by distance
        nearby.sort(key=lambda x: x[1])
        
        # Return top results
        results = [
            FeatureResult(
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
            for feature, distance in nearby[:limit]
        ]
        
        return results
        
    finally:
        session.close()


@router.get("/events")
async def get_eonet_events(
    category: Optional[str] = Query(None, description="Event category (e.g., 'Dust and Haze', 'Wildfires')"),
    limit: int = Query(10, ge=1, le=50),
    days: int = Query(30, ge=1, le=365, description="Number of days to look back")
) -> Dict[str, Any]:
    """
    Fetch real-time events from NASA EONET API.
    
    This endpoint provides access to live natural events like wildfires, storms, volcanoes, etc.
    Events are sourced from NASA's Earth Observatory Natural Event Tracker (EONET).
    
    Categories:
    - Dust and Haze
    - Wildfires
    - Volcanoes
    - Severe Storms
    - Floods
    - Earthquakes
    - Drought
    - Sea and Lake Ice
    - Snow
    """
    try:
        if category:
            events = await search_events_by_category(category, limit=limit, days=days)
        else:
            # Import get_eonet_events from eonet module
            from backend.eonet import get_eonet_events as fetch_all_events, EONETStatus
            events = await fetch_all_events(limit=limit, days=days, status=EONETStatus.ALL)
        
        # Format events for response
        formatted_events = [format_event_for_display(event) for event in events]
        
        return {
            "total": len(formatted_events),
            "category": category,
            "days": days,
            "events": formatted_events
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching EONET events: {str(e)}")


@router.get("/events/{event_id}")
async def get_event_detail(event_id: str) -> Dict[str, Any]:
    """
    Get detailed information about a specific EONET event.
    
    Args:
        event_id: EONET event ID
    """
    try:
        from backend.eonet import get_event_by_id
        
        event = await get_event_by_id(event_id)
        
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        return format_event_for_display(event)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching event: {str(e)}")
