from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    model_config = SettingsConfigDict(
        env_prefix="BACKEND_",
        env_file=".env",
        env_file_encoding="utf-8",
    )

    @property
    def wmts_base(self) -> str:
        prefix = self.gibs_path_prefix.strip("/")
        base = str(self.gibs_base_url).rstrip("/")
        return f"{base}/{prefix}"


settings = Settings()
