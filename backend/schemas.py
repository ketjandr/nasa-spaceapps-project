from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


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
