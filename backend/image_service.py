"""
NASA Image Service - Fetch actual images of planetary features
Uses multiple NASA APIs to find and retrieve images:
1. NASA Image and Video Library
2. PDS Image Atlas
3. LRO QuickMap for Moon features
4. Mars Orbital Data Explorer
"""

from typing import List, Dict, Optional, Any
import httpx
from datetime import datetime
import re

# NASA API endpoints
NASA_IMAGE_API = "https://images-api.nasa.gov"
PDS_IMAGE_ATLAS = "https://pds-imaging.jpl.nasa.gov/api"
LRO_QUICKMAP = "https://quickmap.lroc.asu.edu"


async def search_nasa_images(
    query: str,
    feature_name: str,
    target_body: str,
    media_type: str = "image"
) -> List[Dict[str, Any]]:
    """
    Search NASA Image and Video Library for images of a feature.
    
    Args:
        query: Search query
        feature_name: Name of the planetary feature
        target_body: moon, mars, mercury, etc.
        media_type: image, video, or audio
    
    Returns:
        List of image results with URLs, descriptions, dates
    """
    images = []
    
    # Build search query combining feature name and body
    search_query = f"{feature_name} {target_body}"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{NASA_IMAGE_API}/search",
                params={
                    "q": search_query,
                    "media_type": media_type,
                    "page_size": 20,
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if "collection" in data and "items" in data["collection"]:
                    for item in data["collection"]["items"]:
                        item_data = item.get("data", [{}])[0]
                        links = item.get("links", [])
                        
                        # Get preview image URL
                        preview_url = None
                        full_url = None
                        for link in links:
                            if link.get("render") == "image":
                                if "thumb" in link.get("href", ""):
                                    preview_url = link["href"]
                                else:
                                    full_url = link["href"]
                        
                        if preview_url or full_url:
                            images.append({
                                "source": "NASA Image Library",
                                "title": item_data.get("title", ""),
                                "description": item_data.get("description", ""),
                                "date": item_data.get("date_created", ""),
                                "preview_url": preview_url,
                                "full_url": full_url or preview_url,
                                "nasa_id": item_data.get("nasa_id", ""),
                                "keywords": item_data.get("keywords", []),
                            })
            
    except Exception as e:
        print(f"Error fetching NASA images: {e}")
    
    return images


async def get_lro_images(feature_name: str, lat: float, lon: float) -> List[Dict[str, Any]]:
    """
    Get Lunar Reconnaissance Orbiter (LRO) images for Moon features.
    Uses LRO QuickMap API to find relevant images.
    
    Args:
        feature_name: Name of the lunar feature
        lat: Latitude
        lon: Longitude
    
    Returns:
        List of LRO image URLs and metadata
    """
    images = []
    
    try:
        # LRO QuickMap allows querying by lat/lon
        # We can construct direct tile URLs based on location
        
        # Example: LRO WAC global mosaic tile
        zoom_levels = [3, 4, 5, 6, 7]  # Different zoom levels for timeline
        
        for zoom in zoom_levels:
            # Calculate tile coordinates from lat/lon
            tile_x, tile_y = _latlon_to_tile(lat, lon, zoom)
            
            lro_url = (
                f"https://trek.nasa.gov/tiles/Moon/EQ/"
                f"LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/"
                f"{zoom}/{tile_y}/{tile_x}.jpg"
            )
            
            images.append({
                "source": "LRO QuickMap",
                "title": f"{feature_name} - LRO WAC (Zoom {zoom})",
                "description": f"Lunar Reconnaissance Orbiter image at zoom level {zoom}",
                "date": "2009-present",
                "preview_url": lro_url,
                "full_url": lro_url,
                "zoom_level": zoom,
                "lat": lat,
                "lon": lon,
            })
    
    except Exception as e:
        print(f"Error fetching LRO images: {e}")
    
    return images


async def get_mars_images(feature_name: str, lat: float, lon: float) -> List[Dict[str, Any]]:
    """
    Get Mars Reconnaissance Orbiter and other Mars mission images.
    
    Args:
        feature_name: Name of the Mars feature
        lat: Latitude
        lon: Longitude
    
    Returns:
        List of Mars image URLs and metadata
    """
    images = []
    
    try:
        # Use Mars TREK tiles at different zoom levels
        zoom_levels = [3, 4, 5, 6]
        
        for zoom in zoom_levels:
            tile_x, tile_y = _latlon_to_tile(lat, lon, zoom)
            
            # Mars MGS MOLA color shaded relief
            mars_url = (
                f"https://trek.nasa.gov/tiles/Mars/EQ/"
                f"Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/"
                f"{zoom}/{tile_y}/{tile_x}.jpg"
            )
            
            images.append({
                "source": "Mars TREK",
                "title": f"{feature_name} - MGS MOLA (Zoom {zoom})",
                "description": f"Mars Global Surveyor MOLA color relief at zoom level {zoom}",
                "date": "1997-2006",
                "preview_url": mars_url,
                "full_url": mars_url,
                "zoom_level": zoom,
                "lat": lat,
                "lon": lon,
            })
    
    except Exception as e:
        print(f"Error fetching Mars images: {e}")
    
    return images


async def get_feature_images(
    feature_name: str,
    target_body: str,
    lat: float,
    lon: float,
    query: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get all available images for a planetary feature.
    Combines results from multiple sources.
    
    Args:
        feature_name: Name of the feature
        target_body: moon, mars, mercury, etc.
        lat: Latitude
        lon: Longitude
        query: Original search query
    
    Returns:
        Dictionary with images grouped by source and timeline
    """
    all_images = []
    
    # Search NASA Image Library
    nasa_images = await search_nasa_images(
        query or feature_name,
        feature_name,
        target_body
    )
    all_images.extend(nasa_images)
    
    # Get mission-specific images based on target body
    body_lower = target_body.lower()
    
    if body_lower == "moon":
        lro_images = await get_lro_images(feature_name, lat, lon)
        all_images.extend(lro_images)
    
    elif body_lower == "mars":
        mars_images = await get_mars_images(feature_name, lat, lon)
        all_images.extend(mars_images)
    
    # Sort by date (newest first, with undated items last)
    def get_sort_key(img):
        date_str = img.get("date", "")
        if date_str and date_str != "present":
            try:
                # Try to parse date
                date_match = re.search(r'\d{4}', date_str)
                if date_match:
                    return (0, -int(date_match.group()))
            except:
                pass
        return (1, 0)
    
    all_images.sort(key=get_sort_key)
    
    return {
        "feature_name": feature_name,
        "target_body": target_body,
        "location": {"lat": lat, "lon": lon},
        "total_images": len(all_images),
        "images": all_images,
        "sources": list(set(img["source"] for img in all_images)),
    }


def _latlon_to_tile(lat: float, lon: float, zoom: int) -> tuple[int, int]:
    """
    Convert lat/lon to tile coordinates for WMTS.
    
    Args:
        lat: Latitude (-90 to 90)
        lon: Longitude (-180 to 180)
        zoom: Zoom level
    
    Returns:
        (tile_x, tile_y) coordinates
    """
    # Normalize longitude to 0-360
    lon_norm = ((lon % 360) + 360) % 360
    
    # Clamp latitude
    lat_clamped = max(-90, min(90, lat))
    
    # Calculate tile coordinates
    # For equirectangular projection (used by TREK)
    cols = 2 ** (zoom + 1)
    rows = 2 ** zoom
    
    tile_x = int((lon_norm / 360) * cols)
    tile_y = int(((90 - lat_clamped) / 180) * rows)
    
    return tile_x, tile_y
