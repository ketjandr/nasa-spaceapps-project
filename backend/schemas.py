from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from datetime import datetime


class TileMatrixSummary(BaseModel):
    identifier: str
    scale_denominator: Optional[float] = None
    matrix_width: int
    matrix_height: int
    tile_width: int
    tile_height: int


class TileMatrixSetSummary(BaseModel):
    identifier: str
    supported_crs: Optional[str] = None
    matrices: List[TileMatrixSummary]

    @property
    def max_zoom(self) -> int:
        # assumes matrix identifiers are zero-based increasing integers
        return len(self.matrices) - 1


class TimeDimension(BaseModel):
    default: Optional[str] = None
    values: List[str] = Field(default_factory=list)


class BoundingBox(BaseModel):
    lower_corner: List[float] = Field(min_length=2, max_length=2)
    upper_corner: List[float] = Field(min_length=2, max_length=2)


class LayerSummary(BaseModel):
    identifier: str
    title: Optional[str] = None
    abstract: Optional[str] = None
    formats: List[str]
    tile_matrix_sets: List[str]
    time: Optional[TimeDimension] = None
    bounding_box: Optional[BoundingBox] = None


class LayerConfig(BaseModel):
    layer: LayerSummary
    tile_matrix_set: TileMatrixSetSummary
    time: Optional[str] = None
    format: str
    tile_url_template: str
    min_zoom: int
    max_zoom: int
    tile_size: int


class ViewerTileSource(BaseModel):
    width: int
    height: int
    tile_size: int
    min_level: int
    max_level: int
    url_template: str


class ViewerConfigResponse(BaseModel):
    layer_id: str
    title: Optional[str] = None
    abstract: Optional[str] = None
    time: Optional[str] = None
    format: str
    tile_source: ViewerTileSource


class DatasetListItem(BaseModel):
    """Dataset item for listing available layers"""
    id: str
    title: str
    body: str


class ViewerConfig(BaseModel):
    """Viewer configuration for OpenSeadragon"""
    id: str
    title: str
    tile_url_template: str
    min_zoom: int = 0
    max_zoom: int = 18
    tile_size: int = 256
    projection: str = "EPSG:4326"
    attribution: str = "NASA"
    body: str


class FeatureCategory:
    """Official IAU feature type categories"""
    CRATER = "Crater"
    VALLIS = "Vallis"  # Valley
    MONS = "Mons"  # Mountain
    MARE = "Mare"  # Sea (dark plain)
    LACUS = "Lacus"  # Lake
    RUPES = "Rupes"  # Scarp/cliff
    DORSUM = "Dorsum"  # Ridge
    RIMA = "Rima"  # Fissure
    PLANITIA = "Planitia"  # Plain
    PATERA = "Patera"  # Shallow crater
    THOLUS = "Tholus"  # Small mountain
    TERRA = "Terra"  # Highlands
    CHAOS = "Chaos"  # Chaotic terrain
    CATENA = "Catena"  # Crater chain
    CAVUS = "Cavus"  # Hollows
    FLUCTUS = "Fluctus"  # Flow terrain
    FOSSA = "Fossa"  # Long narrow depression
    LABYRINTHUS = "Labyrinthus"  # Valley complex
    LINEA = "Linea"  # Linear marking
    MENSA = "Mensa"  # Mesa
    OCEANUS = "Oceanus"  # Ocean
    PALUS = "Palus"  # Marsh
    PLANUM = "Planum"  # Plateau
    PROMONTORIUM = "Promontorium"  # Cape/headland
    REGIO = "Regio"  # Region
    SINUS = "Sinus"  # Bay
    SULCUS = "Sulcus"  # Grooves
    TESSERA = "Tessera"  # Tile-like terrain
    VASTITAS = "Vastitas"  # Extensive plain
    OTHER = "Other"

class PlanetaryFeature(BaseModel):
    """Planetary surface feature from IAU nomenclature"""
    id: str = Field(..., description="Unique identifier")
    name: str = Field(..., description="Official IAU name")
    body: str = Field(..., description="Celestial body: moon, mars, mercury, etc.")
    category: str = Field(..., description="Feature type: Crater, Vallis, Mons, etc.")
    lat: float = Field(..., ge=-90, le=90, description="Latitude in degrees")
    lon: float = Field(..., ge=-180, le=180, description="Longitude in degrees")
    diameter_km: Optional[float] = Field(None, description="Diameter in kilometers")
    origin: Optional[str] = Field(None, description="Name origin/etymology")
    approval_date: Optional[str] = Field(None, description="IAU approval date")
    keywords: List[str] = Field(default_factory=list, description="Searchable keywords")
    embedding: Optional[List[float]] = Field(None, description="Vector embedding for semantic search")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "id": "moon_tycho_crater",
                "name": "Tycho",
                "body": "moon",
                "category": "Crater",
                "lat": -43.31,
                "lon": -11.36,
                "diameter_km": 85.0,
                "origin": "Named after Tycho Brahe, Danish astronomer",
                "keywords": ["crater", "impact", "ray system", "prominent"],
            }
        }