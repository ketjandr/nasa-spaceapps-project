from pydantic import AnyHttpUrl, BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Dict


class Settings(BaseSettings):
    gibs_base_url: AnyHttpUrl = Field(
        default="https://gibs.earthdata.nasa.gov",
        description="Base host for NASA GIBS services.",
    )
    gibs_path_prefix: str = Field(
        default="/wmts",
        description="Base path prefix for WMTS requests.",
    )
    default_projection: str = Field(default="epsg3857")
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
        extra="ignore",  # Ignore extra fields from .env (like NEXT_PUBLIC_*)
    )

    @property
    def wmts_base(self) -> str:
        prefix = self.gibs_path_prefix.strip("/")
        base = str(self.gibs_base_url).rstrip("/")
        return f"{base}/{prefix}"


settings = Settings()


# Dataset configuration for Trek API tiles
class DatasetConfig(BaseModel):
    id: str
    title: str
    body: str
    tile_url: str
    min_zoom: int = 0
    max_zoom: int = 18
    tile_size: int = 256
    projection: str = "EPSG:4326"
    attribution: str = "NASA Trek"
    use_proxy: bool = True


def load_datasets() -> Dict[str, DatasetConfig]:
    """Load Trek API dataset configurations for Moon, Mars, and Mercury"""
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
