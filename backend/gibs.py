from __future__ import annotations

import time
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional

import httpx

from .config import settings
from .schemas import (
    BoundingBox,
    LayerSummary,
    TileMatrixSetSummary,
    TileMatrixSummary,
    TimeDimension,
)

WMTS_NS = {
    "wmts": "http://www.opengis.net/wmts/1.0",
    "ows": "http://www.opengis.net/ows/1.1",
    "gml": "http://www.opengis.net/gml",
}

_CAP_CACHE: Dict[str, tuple[float, str]] = {}


async def fetch_capabilities(projection: str) -> str:
    projection_key = projection.lower()
    cached = _CAP_CACHE.get(projection_key)
    if cached:
        cached_ts, payload = cached
        if time.time() - cached_ts < settings.cache_ttl_seconds:
            return payload

    url = (
        f"{settings.wmts_base}/{projection.lower()}/best/1.0.0/WMTSCapabilities.xml"
    )
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        payload = response.text

    _CAP_CACHE[projection_key] = (time.time(), payload)
    return payload


def _parse_tile_matrix_sets(root: ET.Element) -> Dict[str, TileMatrixSetSummary]:
    result: Dict[str, TileMatrixSetSummary] = {}
    for tms in root.findall(".//wmts:TileMatrixSet", WMTS_NS):
        identifier_text = tms.findtext(
            "ows:Identifier", default="", namespaces=WMTS_NS
        )
        if not identifier_text:
            continue

        supported_crs = tms.findtext("ows:SupportedCRS", namespaces=WMTS_NS)
        matrices: List[TileMatrixSummary] = []
        for matrix in tms.findall("wmts:TileMatrix", WMTS_NS):
            matrix_identifier = matrix.findtext(
                "ows:Identifier", default="0", namespaces=WMTS_NS
            )
            scale_denominator_text = matrix.findtext(
                "wmts:ScaleDenominator", default=None, namespaces=WMTS_NS
            )
            try:
                scale_denominator = (
                    float(scale_denominator_text) if scale_denominator_text else None
                )
            except ValueError:
                scale_denominator = None

            matrix_width = int(
                matrix.findtext("wmts:MatrixWidth", default="0", namespaces=WMTS_NS)
            )
            matrix_height = int(
                matrix.findtext("wmts:MatrixHeight", default="0", namespaces=WMTS_NS)
            )
            tile_width = int(
                matrix.findtext("wmts:TileWidth", default="256", namespaces=WMTS_NS)
            )
            tile_height = int(
                matrix.findtext("wmts:TileHeight", default="256", namespaces=WMTS_NS)
            )

            matrices.append(
                TileMatrixSummary(
                    identifier=matrix_identifier,
                    scale_denominator=scale_denominator,
                    matrix_width=matrix_width,
                    matrix_height=matrix_height,
                    tile_width=tile_width,
                    tile_height=tile_height,
                )
            )

        result[identifier_text] = TileMatrixSetSummary(
            identifier=identifier_text,
            supported_crs=supported_crs,
            matrices=matrices,
        )
    return result


def _parse_time_dimension(layer: ET.Element) -> Optional[TimeDimension]:
    # Dimension can be namespace-less in the XML; try both
    dimension = layer.find("wmts:Dimension", WMTS_NS)
    if dimension is None:
        dimension = layer.find("Dimension")
    if dimension is None:
        return None

    identifier = dimension.findtext("ows:Identifier", namespaces=WMTS_NS)
    if identifier is None or identifier.lower() != "time":
        return None

    default_value = dimension.findtext("Default")
    values_text = dimension.findtext("Value")
    values: List[str] = []
    if values_text:
        # Some GIBS layers provide space-separated or comma-separated values
        separators = [",", " "]
        candidate = [values_text]
        for sep in separators:
            if sep in values_text:
                candidate = values_text.split(sep)
                break
        values = [v for v in (item.strip() for item in candidate) if v]

    return TimeDimension(default=default_value, values=values)


def _parse_bounding_box(layer: ET.Element) -> Optional[BoundingBox]:
    bbox = layer.find("ows:WGS84BoundingBox", WMTS_NS)
    if bbox is None:
        return None

    lower = bbox.findtext("ows:LowerCorner", namespaces=WMTS_NS)
    upper = bbox.findtext("ows:UpperCorner", namespaces=WMTS_NS)
    if not lower or not upper:
        return None

    try:
        lower_vals = [float(value) for value in lower.split()]
        upper_vals = [float(value) for value in upper.split()]
        if len(lower_vals) == 2 and len(upper_vals) == 2:
            return BoundingBox(lower_corner=lower_vals, upper_corner=upper_vals)
    except ValueError:
        return None

    return None


def parse_layers(xml_payload: str) -> tuple[List[LayerSummary], Dict[str, TileMatrixSetSummary]]:
    root = ET.fromstring(xml_payload)
    tile_matrix_sets = _parse_tile_matrix_sets(root)

    layer_summaries: List[LayerSummary] = []
    for layer in root.findall(".//wmts:Contents/wmts:Layer", WMTS_NS):
        identifier = layer.findtext(
            "ows:Identifier", default="", namespaces=WMTS_NS
        )
        if not identifier:
            continue
        title = layer.findtext("ows:Title", default=None, namespaces=WMTS_NS)
        abstract = layer.findtext("ows:Abstract", default=None, namespaces=WMTS_NS)
        formats = [
            fmt.text
            for fmt in layer.findall("wmts:Format", WMTS_NS)
            if fmt.text is not None
        ]
        tile_matrix_refs = [
            element.findtext("wmts:TileMatrixSet", namespaces=WMTS_NS)
            for element in layer.findall("wmts:TileMatrixSetLink", WMTS_NS)
        ]
        tile_matrix_refs = [ref for ref in tile_matrix_refs if ref]

        time_dimension = _parse_time_dimension(layer)
        bbox = _parse_bounding_box(layer)

        layer_summaries.append(
            LayerSummary(
                identifier=identifier,
                title=title,
                abstract=abstract,
                formats=formats,
                tile_matrix_sets=tile_matrix_refs,
                time=time_dimension,
                bounding_box=bbox,
            )
        )

    return layer_summaries, tile_matrix_sets


async def get_capability_summaries(
    projection: Optional[str] = None,
) -> tuple[List[LayerSummary], Dict[str, TileMatrixSetSummary]]:
    effective_projection = (projection or settings.default_projection).lower()
    xml_payload = await fetch_capabilities(effective_projection)
    return parse_layers(xml_payload)


def pick_format(layer: LayerSummary) -> str:
    # prefer JPEG, fall back to first available
    for candidate in ("image/jpeg", "image/jpg", "image/png"):
        if candidate in layer.formats:
            return candidate
    if layer.formats:
        return layer.formats[0]
    return "image/jpeg"


def format_extension(mime_type: str) -> str:
    mapping = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/tiff": "tif",
    }
    return mapping.get(mime_type.lower(), "jpg")
