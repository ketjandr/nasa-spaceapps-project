from __future__ import annotations

from typing import List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .config import settings
from .gibs import (
    format_extension,
    get_capability_summaries,
    pick_format,
)
from .schemas import (
    LayerConfig,
    LayerSummary,
    ViewerConfigResponse,
    ViewerTileSource,
)

# Import new AI search router
from .search import router as search_router

app = FastAPI(
    title="NASA GIBS Proxy",
    version="0.1.0",
    description="Lightweight FastAPI service that exposes curated access to NASA GIBS layers.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include AI search endpoints
app.include_router(search_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# ========== SEARCH ENDPOINTS ==========

class SearchRequest(BaseModel):
    query: str
    context: Optional[dict] = None


@app.post("/search")
async def search_location(request: SearchRequest):
    """
    Search for planetary features by natural language query
    
    Examples:
    - {"query": "Show me Tycho crater on the Moon"}
    - {"query": "Find valleys on Mars"}
    - {"query": "Show me Olympus Mons"}
    """
    try:
        from .search_engine import search_features
        result = search_features(request.query)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search/test")
async def test_search():
    """Test endpoint to verify search engine is loaded"""
    try:
        from .search_engine import search_engine
        return {
            'status': 'ok',
            'features_loaded': len(search_engine.features),
            'sample_bodies': list(set(f.get('body') for f in search_engine.features[:100])) if search_engine.features else [],
            'sample_features': [
                {'name': f.get('name'), 'category': f.get('category'), 'body': f.get('body')}
                for f in search_engine.features[:5]
            ] if search_engine.features else []
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            'status': 'error',
            'error': str(e),
            'message': 'Run: python backend/scripts/kmzparser.py moon'
        }

# ========== END SEARCH ENDPOINTS ==========


@app.get("/layers", response_model=List[LayerSummary])
async def list_layers(
    projection: Optional[str] = Query(None, description="Projection identifier, e.g. epsg3857."),
) -> List[LayerSummary]:
    layers, _ = await get_capability_summaries(projection)
    return layers


async def _prepare_layer_config(
    layer_id: str,
    request: Request,
    projection: Optional[str] = Query(None, description="Projection identifier."),
    tile_matrix_set: Optional[str] = Query(None, description="Tile matrix set identifier."),
    time: Optional[str] = Query(None, description="ISO timestamp for temporal layers."),
) -> LayerConfig:
    layers, tile_matrix_sets = await get_capability_summaries(projection)
    layer = next((item for item in layers if item.identifier == layer_id), None)
    if layer is None:
        raise HTTPException(status_code=404, detail="Layer not found")

    chosen_tile_matrix_set = tile_matrix_set or (layer.tile_matrix_sets[0] if layer.tile_matrix_sets else None)
    if chosen_tile_matrix_set is None:
        raise HTTPException(
            status_code=400,
            detail="Layer does not define any tile matrix sets",
        )

    tile_matrix_summary = tile_matrix_sets.get(chosen_tile_matrix_set)
    if tile_matrix_summary is None:
        raise HTTPException(status_code=400, detail="Tile matrix set not available in capabilities")

    selected_time: Optional[str] = time
    if layer.time:
        if selected_time is None:
            selected_time = layer.time.default or (layer.time.values[0] if layer.time.values else None)
        elif layer.time.values and selected_time not in layer.time.values:
            raise HTTPException(
                status_code=400,
                detail="Requested time not available for this layer",
            )
    if selected_time is None:
        selected_time = "default"

    mime_type = pick_format(layer)
    extension = format_extension(mime_type)

    base_url = str(request.base_url).rstrip("/")
    tile_url_template = (
        f"{base_url}/tiles/{layer_id}/{selected_time}/{tile_matrix_summary.identifier}/"
        "{z}/{x}/{y}." + extension
    )

    min_zoom = 0
    max_zoom = len(tile_matrix_summary.matrices) - 1 if tile_matrix_summary.matrices else 0
    tile_size = tile_matrix_summary.matrices[0].tile_width if tile_matrix_summary.matrices else 256

    return LayerConfig(
        layer=layer,
        tile_matrix_set=tile_matrix_summary,
        time=selected_time,
        format=mime_type,
        tile_url_template=tile_url_template,
        min_zoom=min_zoom,
        max_zoom=max_zoom,
        tile_size=tile_size,
    )


@app.get("/layers/{layer_id}/config", response_model=LayerConfig)
async def get_layer_config(
    layer_id: str,
    request: Request,
    projection: Optional[str] = Query(None, description="Projection identifier."),
    tile_matrix_set: Optional[str] = Query(None, description="Tile matrix set identifier."),
    time: Optional[str] = Query(None, description="ISO timestamp for temporal layers."),
) -> LayerConfig:
    return await _prepare_layer_config(
        layer_id=layer_id,
        request=request,
        projection=projection,
        tile_matrix_set=tile_matrix_set,
        time=time,
    )


@app.get("/viewer/layers/{layer_id}", response_model=ViewerConfigResponse)
async def get_viewer_layer(
    layer_id: str,
    request: Request,
    projection: Optional[str] = Query(None, description="Projection identifier."),
    tile_matrix_set: Optional[str] = Query(None, description="Tile matrix set identifier."),
    time: Optional[str] = Query(None, description="ISO timestamp for temporal layers."),
) -> ViewerConfigResponse:
    config = await _prepare_layer_config(
        layer_id=layer_id,
        request=request,
        projection=projection,
        tile_matrix_set=tile_matrix_set,
        time=time,
    )

    matrices = config.tile_matrix_set.matrices
    if not matrices:
        raise HTTPException(status_code=400, detail="Tile matrix definition is empty")

    max_matrix = matrices[-1]
    width = max_matrix.matrix_width * max_matrix.tile_width
    height = max_matrix.matrix_height * max_matrix.tile_height

    tile_source = ViewerTileSource(
        width=width,
        height=height,
        tile_size=config.tile_size,
        min_level=config.min_zoom,
        max_level=config.max_zoom,
        url_template=config.tile_url_template,
    )

    return ViewerConfigResponse(
        layer_id=config.layer.identifier,
        title=config.layer.title,
        abstract=config.layer.abstract,
        time=config.time,
        format=config.format,
        tile_source=tile_source,
    )


@app.get(
    "/tiles/{layer_id}/{time_segment}/{tile_matrix_set}/{z}/{x}/{y}.{file_ext}",
    response_class=StreamingResponse,
)
async def proxy_tile(
    layer_id: str,
    time_segment: str,
    tile_matrix_set: str,
    z: int,
    x: int,
    y: int,
    file_ext: str,
    projection: Optional[str] = Query(None, description="Projection identifier"),
) -> StreamingResponse:
    effective_projection = (projection or settings.default_projection).lower()
    upstream_url = (
        f"{settings.wmts_base}/{effective_projection}/best/{layer_id}/default/{time_segment}/"
        f"{tile_matrix_set}/{z}/{y}/{x}.{file_ext}"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(upstream_url)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to retrieve tile")

    headers = {}
    cache_control = response.headers.get("Cache-Control")
    if cache_control:
        headers["Cache-Control"] = cache_control
    else:
        headers["Cache-Control"] = "public, max-age=86400"

    return StreamingResponse(
        content=response.aiter_bytes(),
        status_code=response.status_code,
        media_type=response.headers.get("Content-Type", "image/jpeg"),
        headers=headers,
    )
