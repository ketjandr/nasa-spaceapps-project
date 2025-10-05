"""
NASA EONET (Earth Observatory Natural Event Tracker) API integration.
Provides real-time and historical data for natural events like wildfires, storms, volcanoes, etc.

API Documentation: https://eonet.gsfc.nasa.gov/docs/v3
"""

from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import httpx
from pydantic import BaseModel
from enum import Enum


# EONET API Configuration
EONET_BASE_URL = "https://eonet.gsfc.nasa.gov/api/v3"
EONET_TIMEOUT = 30.0


class EONETCategory(str, Enum):
    """EONET event categories."""
    DUST_HAZE = "dustHaze"
    WILDFIRES = "wildfires"
    VOLCANOES = "volcanoes"
    SEVERE_STORMS = "severeStorms"
    FLOODS = "floods"
    EARTHQUAKES = "earthquakes"
    DROUGHT = "drought"
    SEA_LAKE_ICE = "seaLakeIce"
    SNOW = "snow"
    TEMPERATURE_EXTREMES = "tempExtremes"
    WATER_COLOR = "waterColor"
    LANDSLIDES = "landslides"
    MANMADE = "manmade"


class EONETStatus(str, Enum):
    """Event status."""
    OPEN = "open"
    CLOSED = "closed"
    ALL = "all"


# Mapping from our internal event categories to EONET categories
CATEGORY_MAPPING = {
    "Dust and Haze": EONETCategory.DUST_HAZE,
    "Wildfires": EONETCategory.WILDFIRES,
    "Volcanoes": EONETCategory.VOLCANOES,
    "Severe Storms": EONETCategory.SEVERE_STORMS,
    "Floods": EONETCategory.FLOODS,
    "Earthquakes": EONETCategory.EARTHQUAKES,
    "Drought": EONETCategory.DROUGHT,
    "Sea and Lake Ice": EONETCategory.SEA_LAKE_ICE,
    "Snow": EONETCategory.SNOW,
}


class EONETGeometry(BaseModel):
    """Geographic information for an event."""
    date: str
    type: str  # Usually "Point" or "Polygon"
    coordinates: List[float]  # [longitude, latitude] or list of coordinates
    
    @property
    def latitude(self) -> Optional[float]:
        """Extract latitude from coordinates."""
        if self.type == "Point" and len(self.coordinates) >= 2:
            return self.coordinates[1]
        return None
    
    @property
    def longitude(self) -> Optional[float]:
        """Extract longitude from coordinates."""
        if self.type == "Point" and len(self.coordinates) >= 1:
            return self.coordinates[0]
        return None


class EONETSource(BaseModel):
    """Source information for an event."""
    id: str
    url: str


class EONETCategory(BaseModel):
    """Category information."""
    id: str
    title: str


class EONETEvent(BaseModel):
    """EONET event data."""
    id: str
    title: str
    description: Optional[str] = None
    link: Optional[str] = None
    categories: List[Dict[str, str]]
    sources: List[Dict[str, str]]
    geometry: List[Dict[str, Any]]
    
    @property
    def category_names(self) -> List[str]:
        """Get list of category titles."""
        return [cat.get("title", "") for cat in self.categories]
    
    @property
    def latest_geometry(self) -> Optional[Dict[str, Any]]:
        """Get most recent geometry data."""
        if self.geometry:
            return self.geometry[-1]  # Last entry is most recent
        return None
    
    @property
    def latitude(self) -> Optional[float]:
        """Get latitude from latest geometry."""
        geom = self.latest_geometry
        if geom and geom.get("type") == "Point":
            coords = geom.get("coordinates", [])
            if len(coords) >= 2:
                return coords[1]
        return None
    
    @property
    def longitude(self) -> Optional[float]:
        """Get longitude from latest geometry."""
        geom = self.latest_geometry
        if geom and geom.get("type") == "Point":
            coords = geom.get("coordinates", [])
            if len(coords) >= 1:
                return coords[0]
        return None
    
    @property
    def event_date(self) -> Optional[str]:
        """Get event date from latest geometry."""
        geom = self.latest_geometry
        if geom:
            return geom.get("date")
        return None


class EONETResponse(BaseModel):
    """EONET API response."""
    title: str
    description: str
    link: str
    events: List[Dict[str, Any]]


async def get_eonet_events(
    category: Optional[str] = None,
    status: EONETStatus = EONETStatus.OPEN,
    limit: int = 10,
    days: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    bbox: Optional[str] = None
) -> List[EONETEvent]:
    """
    Fetch events from NASA EONET API.
    
    Args:
        category: Event category (dustHaze, wildfires, etc.)
        status: Event status (open, closed, all)
        limit: Maximum number of events to return
        days: Number of days to look back (optional)
        start_date: Start date in YYYY-MM-DD format (optional)
        end_date: End date in YYYY-MM-DD format (optional)
        bbox: Bounding box as "west,south,east,north" (optional)
        
    Returns:
        List of EONET events
        
    Raises:
        httpx.HTTPError: If API request fails
    """
    # Build URL
    if category:
        url = f"{EONET_BASE_URL}/categories/{category}"
    else:
        url = f"{EONET_BASE_URL}/events"
    
    # Build query parameters
    params = {
        "status": status.value,
        "limit": limit
    }
    
    if days:
        params["days"] = days
    if start_date:
        params["start"] = start_date
    if end_date:
        params["end"] = end_date
    if bbox:
        params["bbox"] = bbox
    
    # Make request
    async with httpx.AsyncClient(timeout=EONET_TIMEOUT) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
    
    # Parse events
    events = []
    for event_data in data.get("events", []):
        try:
            event = EONETEvent(**event_data)
            events.append(event)
        except Exception as e:
            print(f"Error parsing event {event_data.get('id')}: {e}")
            continue
    
    return events


async def get_eonet_categories() -> List[Dict[str, str]]:
    """
    Fetch all available EONET categories.
    
    Returns:
        List of category dictionaries with id and title
    """
    url = f"{EONET_BASE_URL}/categories"
    
    async with httpx.AsyncClient(timeout=EONET_TIMEOUT) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
    
    return data.get("categories", [])


async def get_event_by_id(event_id: str) -> Optional[EONETEvent]:
    """
    Fetch a specific event by ID.
    
    Args:
        event_id: EONET event ID
        
    Returns:
        EONETEvent or None if not found
    """
    url = f"{EONET_BASE_URL}/events/{event_id}"
    
    try:
        async with httpx.AsyncClient(timeout=EONET_TIMEOUT) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
        
        return EONETEvent(**data)
    except Exception as e:
        print(f"Error fetching event {event_id}: {e}")
        return None


async def search_events_by_category(
    category_name: str,
    limit: int = 10,
    days: int = 30
) -> List[EONETEvent]:
    """
    Search events by our internal category name.
    
    Args:
        category_name: Internal category name (e.g., "Dust and Haze", "Wildfires")
        limit: Maximum number of events
        days: Number of days to look back
        
    Returns:
        List of EONET events
    """
    # Map internal category to EONET category
    eonet_category = CATEGORY_MAPPING.get(category_name)
    
    if not eonet_category:
        print(f"Warning: No EONET category mapping for '{category_name}'")
        return []
    
    return await get_eonet_events(
        category=eonet_category.value,
        status=EONETStatus.ALL,
        limit=limit,
        days=days
    )


async def search_events_in_region(
    bbox: str,
    category: Optional[str] = None,
    limit: int = 10,
    days: int = 30
) -> List[EONETEvent]:
    """
    Search events within a geographic bounding box.
    
    Args:
        bbox: Bounding box as "west,south,east,north" in degrees
        category: Optional EONET category filter
        limit: Maximum number of events
        days: Number of days to look back
        
    Returns:
        List of EONET events in the region
    """
    return await get_eonet_events(
        category=category,
        status=EONETStatus.ALL,
        limit=limit,
        days=days,
        bbox=bbox
    )


def format_event_for_display(event: EONETEvent) -> Dict[str, Any]:
    """
    Format EONET event for frontend display.
    
    Args:
        event: EONETEvent object
        
    Returns:
        Dictionary with formatted event data
    """
    return {
        "id": event.id,
        "type": "event",
        "name": event.title,
        "description": event.description or f"Natural event: {event.title}",
        "categories": event.category_names,
        "latitude": event.latitude,
        "longitude": event.longitude,
        "date": event.event_date,
        "sources": event.sources,
        "link": event.link,
        "is_dynamic_event": True
    }


if __name__ == "__main__":
    # Test the EONET integration
    import asyncio
    import json
    
    async def test():
        print("=" * 80)
        print("Testing NASA EONET API Integration")
        print("=" * 80)
        
        # Test 1: Fetch categories
        print("\nTest 1: Fetching available categories...")
        categories = await get_eonet_categories()
        print(f"Found {len(categories)} categories:")
        for cat in categories:
            print(f"  - {cat['title']} ({cat['id']})")
        
        # Test 2: Fetch recent wildfires
        print("\n" + "-" * 80)
        print("Test 2: Fetching recent wildfires...")
        wildfires = await get_eonet_events(
            category=EONETCategory.WILDFIRES.value,
            limit=5,
            days=30
        )
        print(f"Found {len(wildfires)} wildfire events:")
        for event in wildfires:
            print(f"\n  Event: {event.title}")
            print(f"  ID: {event.id}")
            print(f"  Categories: {', '.join(event.category_names)}")
            if event.latitude and event.longitude:
                print(f"  Location: {event.latitude:.4f}°, {event.longitude:.4f}°")
            print(f"  Date: {event.event_date}")
        
        # Test 3: Search dust storms
        print("\n" + "-" * 80)
        print("Test 3: Searching for dust storms...")
        dust_events = await search_events_by_category("Dust and Haze", limit=5, days=60)
        print(f"Found {len(dust_events)} dust/haze events:")
        for event in dust_events:
            formatted = format_event_for_display(event)
            print(f"\n  {formatted['name']}")
            print(f"  Location: {formatted['latitude']}, {formatted['longitude']}")
        
        # Test 4: Fetch all recent events
        print("\n" + "-" * 80)
        print("Test 4: Fetching all recent events...")
        all_events = await get_eonet_events(limit=10, days=7)
        print(f"Found {len(all_events)} events in last 7 days:")
        for event in all_events:
            print(f"  - {event.title} ({', '.join(event.category_names)})")
        
        print("\n" + "=" * 80)
        print("Test Complete")
        print("=" * 80)
    
    asyncio.run(test())
