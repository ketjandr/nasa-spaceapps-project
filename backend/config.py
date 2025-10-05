from pathlib import Path
from typing import Dict, Optional

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatasetConfig(BaseModel):
    """Dataset configuration for Trek API tiles"""
    id: str
    title: str
    tile_url: str
    min_zoom: int = 0
    max_zoom: int = 18
    tile_size: int = 256
    projection: Optional[str] = "EPSG:4326"
    attribution: Optional[str] = "NASA Trek"
    body: Optional[str] = None
    use_proxy: bool = True


class Settings(BaseSettings):
    dataset_manifest: Path = Field(default=Path("backend/datasets.json"))
    cache_ttl_seconds: int = Field(default=600)
    
    # OpenAI Settings
    openai_api_key: str = Field(
        default="",
        description="OpenAI API key for embeddings and NLP"
    )
    
    # Database Settings
    database_url: str = Field(
        default="sqlite:///./stellarcanvas.db",
        description="Database connection URL"
    )

    model_config = SettingsConfigDict(
        env_prefix="BACKEND_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"  # Ignore extra fields from .env (like NEXT_PUBLIC_*)
    )


settings = Settings()


def load_datasets() -> Dict[str, DatasetConfig]:
    """Load dataset configurations from JSON manifest or return Trek API defaults"""
    import json
    
    # Try loading from JSON manifest first (main branch approach)
    if settings.dataset_manifest.exists():
        with settings.dataset_manifest.open("r", encoding="utf-8") as fh:
            raw = json.load(fh)
        return {key: DatasetConfig(**value) for key, value in raw.items()}
    
    # Fallback to hardcoded Trek API datasets (backup branch approach)
    datasets = {
        "moon_lro_wac": DatasetConfig(
            id="moon_lro_wac",
            title="Moon LRO WAC Mosaic (Global 303ppd)",
            body="moon",
            tile_url="https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{row}/{col}.jpg",
            use_proxy=True,
        ),
        "mars_mola": DatasetConfig(
            id="mars_mola",
            title="Mars MGS MOLA Shaded Relief",
            body="mars",
            tile_url="https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{row}/{col}.jpg",
            use_proxy=True,
        ),
        "mercury_mdis": DatasetConfig(
            id="mercury_mdis",
            title="Mercury MESSENGER MDIS Basemap",
            body="mercury",
            tile_url="https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m/1.0.0/default/default028mm/{z}/{row}/{col}.jpg",
            use_proxy=True,
        ),
    }
    return datasets
