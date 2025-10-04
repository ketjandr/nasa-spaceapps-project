// app/components/TileViewer.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import type OpenSeadragon from "openseadragon";
import JSZip from "jszip";
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
  async function queryMarsCraterDB() {
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

  // Utility: pan/zoom viewer to lon/lat assuming equirectangular projection and the same virtual width/height used above
  function panToLonLat(lon: number, lat: number, zoomLevel = 4) {
    if (!viewerObj) return;
    const imgW = 360 * 1024;
    const imgH = 180 * 1024;
    // convert lon/lat to pixel coords on the virtual image
    // lon: -180..180 -> x: 0..imgW
    const x = ((lon + 180) / 360) * imgW;
    // lat: -90..90 -> y  (flip Y because image coordinates top=0)
    const y = ((90 - lat) / 180) * imgH;
    // OpenSeadragon uses viewport coordinates; convert image points -> viewport points
    const point = viewerObj.viewport.imageToViewportCoordinates(x, y);
    // Set center and zoom (zoom is viewer.viewport.getZoom(); choose a value)
    viewerObj.viewport.panTo(point);
    // zoom level (we use zoomTo)
    viewerObj.viewport.zoomTo(zoomLevel, point);
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

          <input
            placeholder="search text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ marginLeft: "auto" }}
          />
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
