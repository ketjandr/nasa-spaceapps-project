// app/components/TileViewer.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import type OpenSeadragon from "openseadragon";
import JSZip from "jszip";
import { xml2json } from "xml-js"; // optional helper if you prefer parsing XML to JSON (not required)
import toGeoJSON from "togeojson"; // note: togeojson exports DOM parsers; we'll use via DOMParser
import type OpenSeadragon from "openseadragon";
// (If togeojson import issues, you can also parse KML manually or use another KML->GeoJSON lib.)

type BodyKey = "moon" | "mars" | "mercury" | "ceres";

const TREK_TEMPLATES: Record<
  BodyKey,
  Array<{ id: string; title: string; template: string; example: string }>
> = {
  moon: [
    {
      id: "lro_wac",
      title: "LRO WAC Mosaic (global 303ppd)",
      // THIS is the WMTS tile URL template used by Trek (real pattern)
      template:
        "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{row}/{col}.jpg",
      example:
        "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/0/0/0.jpg",
    },
  ],
  mars: [
    {
      id: "mars_mgs_mola",
      title: "Mars MGS MOLA shaded relief (example)",
      template:
        "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{row}/{col}.jpg",
      example:
        "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/0/0/0.jpg",
    },
  ],
  mercury: [
    {
      id: "messenger_mdis",
      title: "Mercury MESSENGER MDIS basemap",
      template:
        "https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m/1.0.0/default/default028mm/{z}/{row}/{col}.jpg",
      example:
        "https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m/1.0.0/default/default028mm/0/0/0.jpg",
    },
  ],
  ceres: [
    {
      id: "ceres_dawn",
      title: "Ceres Dawn FC HAMO (example)",
      template:
        "https://trek.nasa.gov/tiles/Ceres/EQ/Ceres_Dawn_FC_HAMO_ClrShade_DLR_Global_60ppd_Oct2016/1.0.0/default/default028mm/{z}/{row}/{col}.jpg",
      example:
        "https://trek.nasa.gov/tiles/Ceres/EQ/Ceres_Dawn_FC_HAMO_ClrShade_DLR_Global_60ppd_Oct2016/1.0.0/default/default028mm/0/0/0.jpg",
    },
  ],
import toGeoJSON from "togeojson";
import type { FeatureCollection, Point } from "geojson";

type BodyKey =
  | "milky_way"
  | "moon"
  | "mars"
  | "mercury"
  | "ceres"
  | "unknown";

type DatasetListItem = {
  id: string;
  title: string;
  body?: string | null;
};

type ViewerConfigResponse = {
  id: string;
  title: string;
  tile_url_template: string;
  min_zoom: number;
  max_zoom: number;
  tile_size: number;
  projection?: string | null;
  attribution?: string | null;
  body?: string | null;
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
const backendBase = backendUrl ? backendUrl.replace(/\/$/, "") : "";

type PlanetFeature = {
  name: string;
  lat: number;
  lon: number;
  diamkm?: number;
};

interface TileViewerProps {
  externalSearchQuery?: string;
}

export default function TileViewer({ externalSearchQuery }: TileViewerProps) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [viewerObj, setViewerObj] = useState<OpenSeadragon.Viewer | null>(null);
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [layerConfig, setLayerConfig] = useState<ViewerConfigResponse | null>(
    null
  );
  const [selectedBody, setSelectedBody] = useState<BodyKey>("unknown");
  const [features, setFeatures] = useState<PlanetFeature[]>([]);
  const [searchText, setSearchText] = useState("");

  // Update internal search text when external search query changes
  useEffect(() => {
    if (externalSearchQuery) {
      setSearchText(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  // Auto-load features for Moon and Mars when selectedBody changes
  useEffect(() => {
    if (selectedBody === "moon") {
      loadMoonGazetteer();
    } else if (selectedBody === "mars") {
      queryMarsCraterDB();
    } else {
      setFeatures([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBody]);

  // Keep openseadragon import in effect (client-only)
  useEffect(() => {
    let viewer: OpenSeadragon.Viewer | null = null;
    let osd: typeof import("openseadragon") | null = null;
    let mounted = true;

    (async () => {
      if (!layerConfig) return;
      const OSDModule = await import("openseadragon");
      osd = (OSDModule.default ?? OSDModule) as typeof import("openseadragon");
      if (!viewerRef.current || !mounted) return;

      // Set maxLevel and tileSize for the tiling scheme
      const minZoom = layerConfig.min_zoom;
      const maxLevel = layerConfig.max_zoom - layerConfig.min_zoom;
      const tileSize = layerConfig.tile_size;
      // At maxLevel, columns = 2^(maxLevel+1), rows = 2^maxLevel
      const width = tileSize * Math.pow(2, maxLevel + 1);
      const height = tileSize * Math.pow(2, maxLevel);

      const tileSource: OpenSeadragon.TileSourceOptions = {
        width,
        height,
        tileSize,
        minLevel: 0,
        maxLevel,
        getTileUrl: function (level: number, x: number, y: number) {
          const maxCols = Math.pow(2, level + 1);
          const maxRows = Math.pow(2, level);

          // Handle horizontal wrapping
          x = ((x % maxCols) + maxCols) % maxCols;

          // Constrain vertical position
          if (y < 0 || y >= maxRows) return null;

          const z = level + minZoom;
          return layerConfig.tile_url_template
            .replace("{z}", String(z))
            .replace("{x}", String(x))
            .replace("{y}", String(y))
            .replace("{col}", String(x))
            .replace("{row}", String(y));
        },
      };

      viewer = osd({
        element: viewerRef.current!,
        prefixUrl:
          "https://cdn.jsdelivr.net/npm/openseadragon@latest/build/openseadragon/images/",
        showNavigator: true,
        navigatorSizeRatio: 0.15,
        tileSources: [tileSource],
        gestureSettingsMouse: { clickToZoom: false },
        constrainDuringPan: true,
        homeFillsViewer: true,
        visibilityRatio: 0.5, // Allow some overflow but not too much
        minZoomImageRatio: 0.8, // Prevent zooming out too far
        maxZoomPixelRatio: 2.0, // Limit maximum zoom
        defaultZoomLevel: 1,
        wrapHorizontal: true,
        wrapVertical: false,
        viewportConstraint: new osd.Rect(0, -0.1, 1, 1.2), // Constrain viewport more strictly
      });

      viewer.addHandler('open', function() {
        addOverlays();
      });

      setViewerObj(viewer);
    })();

    return () => {
      mounted = false;
      if (viewer) viewer.destroy();
    };
  }, [layerConfig]);

  // USGS Gazetteer KML/KMZ example links are available from the USGS "KML and Shapefile downloads" page.
  // Example KMZ (center points) for Moon and Mars (listed on USGS downloads page):
  // - Moon center points (KMZ):
  //   https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz
  // - Mars center points (KMZ):
  //   https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.kmz
  // (Those downloads are documented on the USGS Gazetteer downloads page.)
  // See Sources at the bottom for the official page link.

  // Fetch and parse a KMZ (USGS Gazetteer center points) and convert to GeoJSON (togeojson)
  async function fetchGazetteerKMZ(kmzUrl: string): Promise<PlanetFeature[]> {
    try {
      if (!backendBase) {
        console.warn("NEXT_PUBLIC_BACKEND_URL not set; skipping KMZ fetch");
        return [];
      }

      const proxyUrl = `${backendBase}/proxy/kmz?url=${encodeURIComponent(
        kmzUrl
      )}`;

      const r = await fetch(proxyUrl);
      if (!r.ok) {
        console.warn("KMZ fetch failed", r.status, r.statusText);
        return [];
      }
      const arrayBuffer = await r.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      // Look for the first .kml file inside the KMZ
      const kmlEntryName = Object.keys(zip.files).find((n) =>
        n.toLowerCase().endsWith(".kml")
      );
      if (!kmlEntryName) {
        console.warn("No KML inside KMZ");
        return [];
      }
      const kmlText = await zip.files[kmlEntryName].async("text");
      // Parse KML into DOM and convert
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(kmlText, "application/xml");
      const geojson = (toGeoJSON as {
        kml: (doc: Document) => FeatureCollection<Point, { name?: string; Name?: string }>;
      }).kml(kmlDoc);
      const points: PlanetFeature[] = [];
      for (const feat of geojson.features ?? []) {
        if (feat.geometry?.type !== "Point" || !feat.geometry.coordinates) continue;
        const [lon, lat] = feat.geometry.coordinates;
        points.push({
          name: feat.properties?.name || feat.properties?.Name || "unnamed",
          lat: Number(lat),
          lon: Number(lon),
        });
      }
      return points;
    } catch (err) {
      console.error("Error parsing KMZ", err);
      return [];
    }
  }

  // Example: load moon Gazetteer center points
  async function loadMoonGazetteer() {
    // Real KMZ links are listed on the USGS downloads page; here is the center-points KMZ for Moon:
    const moonKmz =
      "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz";
    const pts = await fetchGazetteerKMZ(moonKmz);
    setFeatures(pts.slice(0, 500)); // don't load too many into UI instantly
  }

  // Example: query USGS pygeoapi crater DB (Mars Robbins) — returns JSON features.
  // This endpoint is provided by USGS Astrogeology (pygeoapi). Example:
  // https://astrogeology.usgs.gov/pygeoapi/collections/mars/robbinsv1/items?limit=10
  async function queryMarsCraterDB(q: string) {
    const moonKmz =
      "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.kmz";
    const pts = await fetchGazetteerKMZ(moonKmz);
    setFeatures(pts.slice(0, 500)); // don't load too many into UI instantly
    const base =
      "https://astrogeology.usgs.gov/pygeoapi/collections/mars/robbinsv1/items?f=json";
    // We can use 'limit' and bbox params per pygeoapi. Here we do a simple limited fetch.
    const resp = await fetch(base + "&limit=200");
    if (!resp.ok) {
      console.warn("pygeoapi fetch failed", resp.status);
      return;
    }
    const j = await resp.json();
    type MarsApiFeature = {
      properties: {
        craterid?: string;
        name?: string;
        lat?: number;
        lon_e?: number;
        diamkm?: number;
      };
    };
    const rawFeatures = (j.features ?? []) as MarsApiFeature[];
    const items: PlanetFeature[] = rawFeatures
      .map((f) => {
        const lat = f.properties.lat;
        const lon = f.properties.lon_e;
        if (typeof lat !== "number" || typeof lon !== "number") {
          return null;
        }
        return {
          name: f.properties.craterid || f.properties.name || "crater",
          lat,
          lon,
          diamkm: f.properties.diamkm,
        } satisfies PlanetFeature;
      })
      .filter((f): f is PlanetFeature => Boolean(f));
    setFeatures(items.slice(0, 1000));
  }

  // Add overlay elements to the viewer
  function addOverlays() {
    if (!viewerObj) return;

    // Remove existing overlays
    viewerObj.removeAllOverlays();

    // Add center crosshair
    const centerElement = document.createElement('div');
    centerElement.style.cssText = `
      width: 20px;
      height: 20px;
      position: absolute;
      pointer-events: none;
      border: 2px solid rgba(255, 255, 255, 0.8);
      border-radius: 50%;
    `;
    
    // Add the center overlay (stays fixed in viewport center)
    viewerObj.addOverlay({
      element: centerElement,
      location: new viewerObj.viewport.pointFromPixel(
        viewerObj.viewport.getContainerSize().x / 2,
        viewerObj.viewport.getContainerSize().y / 2
      ),
      placement: 'CENTER',
      checkResize: false
    });

  // Utility: pan/zoom viewer to lon/lat for NASA Trek tiles
  function panToLonLat(lon: number, lat: number, zoomLevel = 4) {
    if (!viewerObj) return;
    
    // NASA Trek uses tiles in a Web Mercator-like projection
    // The source image represents 360° of longitude from 0° to 360° (not -180° to 180°)
    // and latitude from 90° to -90° (north to south)
    
    // Normalize longitude to 0-360° range
    lon = ((lon % 360) + 360) % 360;
    
    // Constrain latitude to -90° to 90°
    lat = Math.max(-90, Math.min(90, lat));
    
    // Get the current tile source dimensions
    const source = viewerObj.world.getItemAt(0);
    const imgW = source.source.width;
    const imgH = source.source.height;
    
    // Convert to tile coordinates
    // For longitude: 0° -> 0, 360° -> imgW
    const x = (lon / 360) * imgW;
    // For latitude: 90° -> 0, -90° -> imgH (matching Trek's coordinate system)
    const y = ((90 - lat) / 180) * imgH;
    
    // Create feature marker overlay
    const markerElement = document.createElement('div');
    markerElement.style.cssText = `
      width: 24px;
      height: 24px;
      position: absolute;
      pointer-events: none;
      border: 3px solid rgba(255, 100, 100, 0.8);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      animation: pulse 2s infinite;
    `;

    // Add pulse animation style
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        50% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.5; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // Remove old feature markers
    const oldMarkers = document.querySelectorAll('.feature-marker');
    oldMarkers.forEach(marker => marker.remove());
    markerElement.classList.add('feature-marker');

      // Add the feature marker overlay
    viewerObj.addOverlay({
      element: markerElement,
      location: viewerObj.viewport.imageToViewportCoordinates(x, y),
      placement: 'CENTER',
      checkResize: false
    });    // Debug log to verify coordinate transformation
    console.log(`Panning to: lon=${lon}°, lat=${lat}°, pixel=(${x}, ${y})`);
    
    // Convert to viewport coordinates and pan with animation
    const point = viewerObj.viewport.imageToViewportCoordinates(x, y);
    viewerObj.viewport.panTo(point, true);
    
    // Zoom with a slight delay to ensure pan completes first
    setTimeout(() => {
      viewerObj.viewport.zoomTo(zoomLevel, point, true);
    }, 100);
  }

  // Filter features by searchText (case-insensitive substring match on name)
  const filteredFeatures = features.filter((f) => {
    if (!searchText) return true;
    if (!f.name) return false;
    return f.name.toLowerCase().includes(searchText.toLowerCase());
  });

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
            Dataset
            <select
              value={selectedLayerId ?? ""}
              onChange={(e) => setSelectedLayerId(e.target.value)}
            >
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.title}
                </option>
              ))}
            </select>
          </label>

          {layerConfig?.attribution && (
            <span style={{ fontSize: 12, color: "#888" }}>
              {layerConfig.attribution}
            </span>
          )}

          {selectedBody === "moon" && (
            <button style={{ marginLeft: "auto" }} onClick={loadMoonGazetteer}>
              Reload Moon Gazetteer
            </button>
          )}
          {selectedBody === "mars" && (
            <button
              onClick={() => queryMarsCraterDB()}
            >
              Reload Mars Craters
            </button>
          )}
        </div>

        <div
          ref={viewerRef}
          style={{ width: "100%", height: "640px", background: "#000" }}
        />
      </div>

      <div style={{ width: 360, overflow: "auto", borderLeft: "1px solid #ddd", padding: 8 }}>
        <h3>Features / Search</h3>
        <p style={{ fontSize: 12, color: "#666" }}>
          Click a feature to pan/zoom the viewer (equirectangular layers).
        </p>
        {filteredFeatures.length === 0 ? (
          <div style={{ color: '#888', fontSize: 14, marginTop: 16 }}>
            {features.length === 0
              ? 'No features loaded for this body.'
              : 'No features match your search.'}
          </div>
        ) : (
          <ul style={{ padding: 0, listStyle: "none" }}>
            {filteredFeatures.map((f, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <button
                  style={{ width: "100%", textAlign: "left" }}
                  onClick={() => panToLonLat(f.lon, f.lat, 6)}
                >
                  <strong>{f.name}</strong>
                  <div style={{ fontSize: 12 }}>
                    {f.lat?.toFixed?.(4)}, {f.lon?.toFixed?.(4)}{" "}
                    {f.diamkm ? ` • ${f.diamkm} km` : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
