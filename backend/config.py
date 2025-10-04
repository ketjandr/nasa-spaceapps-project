from pathlib import Path
from typing import Dict, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# KMZ recaches
class DatasetConfig(BaseSettings):
    id: str
    title: str
    tile_url: str
    min_zoom: int
    max_zoom: int
    tile_size: int
    projection: Optional[str] = None
    attribution: Optional[str] = None
    body: Optional[str] = None
    use_proxy: bool = True


class Settings(BaseSettings):
    dataset_manifest: Path = Field(default=Path("backend/datasets.json"))
    cache_ttl_seconds: int = Field(default=600)

    model_config = SettingsConfigDict(env_prefix="BACKEND_", env_file=".env", env_file_encoding="utf-8")


settings = Settings()


def load_datasets() -> Dict[str, DatasetConfig]:
    import json

    with settings.dataset_manifest.open("r", encoding="utf-8") as fh:
        raw = json.load(fh)
    return {key: DatasetConfig(**value) for key, value in raw.items()}
