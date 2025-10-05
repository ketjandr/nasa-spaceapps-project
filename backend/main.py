from __future__ import annotations

from typing import Dict

import httpx
from fastapi import FastAPI, HTTPException, Path, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .config import DatasetConfig, load_datasets
from .schemas import DatasetListItem, ViewerConfig

app = FastAPI(title="StellarCanvas Tiles", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_DATASETS: Dict[str, DatasetConfig] = load_datasets()


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


@app.get("/viewer/layers", response_model=list[DatasetListItem])
async def list_layers() -> list[DatasetListItem]:
    return [DatasetListItem(id=cfg.id, title=cfg.title, body=cfg.body) for cfg in _DATASETS.values()]


@app.get("/viewer/layers/{layer_id}", response_model=ViewerConfig)
async def get_layer_config(
    request: Request,
    layer_id: str = Path(..., description="Dataset identifier"),
) -> ViewerConfig:
    dataset = _DATASETS.get(layer_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Layer not found")

    base_url = str(request.base_url).rstrip("/")
    if dataset.use_proxy:
        tile_template = f"{base_url}/tiles/{dataset.id}/{{z}}/{{x}}/{{y}}"
    else:
        tile_template = dataset.tile_url

    return ViewerConfig(
        id=dataset.id,
        title=dataset.title,
        tile_url_template=tile_template,
        min_zoom=dataset.min_zoom,
        max_zoom=dataset.max_zoom,
        tile_size=dataset.tile_size,
        projection=dataset.projection,
        attribution=dataset.attribution,
        body=dataset.body,
    )


@app.get("/tiles/{layer_id}/{z}/{x}/{y}")
async def proxy_tile(
    layer_id: str,
    z: int,
    x: int,
    y: int,
):
    dataset = _DATASETS.get(layer_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Layer not found")

    upstream = dataset.tile_url.replace("{z}", str(z))
    if "{x}" in upstream:
        upstream = upstream.replace("{x}", str(x))
    if "{y}" in upstream:
        upstream = upstream.replace("{y}", str(y))
    if "{col}" in upstream:
        upstream = upstream.replace("{col}", str(x))
    if "{row}" in upstream:
        upstream = upstream.replace("{row}", str(y))

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        response = await client.get(upstream)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch tile")

    return StreamingResponse(
        response.aiter_bytes(),
        media_type=response.headers.get("Content-Type", "image/jpeg"),
        headers={"Cache-Control": response.headers.get("Cache-Control", "public, max-age=86400")},
    )


@app.get("/proxy/kmz")
async def proxy_kmz(url: str = Query(..., description="Remote KMZ URL")) -> StreamingResponse:
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        resp = await client.get(url)

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch KMZ")

    return StreamingResponse(
        resp.aiter_bytes(),
        media_type=resp.headers.get(
            "Content-Type", "application/vnd.google-earth.kmz"
        ),
        headers={
            "Cache-Control": resp.headers.get(
                "Cache-Control", "public, max-age=86400"
            )
        },
    )
