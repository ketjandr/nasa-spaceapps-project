// app/components/TileViewer.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { xml2json } from "xml-js"; // optional helper if you prefer parsing XML to JSON (not required)
import * as toGeoJSON from "@mapbox/togeojson"; // updated package for KML to GeoJSON conversion

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
};

export default function TileViewer() {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [viewerObj, setViewerObj] = useState<any>(null);
  const [selectedBody, setSelectedBody] = useState<BodyKey>("moon");
  const [selectedLayerId, setSelectedLayerId] = useState<string>(
    TREK_TEMPLATES["moon"][0].id
  );
  const [features, setFeatures] = useState<any[]>([]); // planet features (name, lat, lon)
  const [searchText, setSearchText] = useState("");

  // Auto-load features for Moon and Mars when selectedBody changes
  useEffect(() => {
    if (selectedBody === "moon") {
      loadMoonGazetteer();
    } else if (selectedBody === "mars") {
      queryMarsCraterDB("");
    } else {
      setFeatures([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBody]);

  // Keep openseadragon import in effect (client-only)
  useEffect(() => {
    let viewer: any = null;
    let osd: any = null;
    let mounted = true;

    (async () => {
      const OSDModule = await import("openseadragon");
      osd = OSDModule.default ?? OSDModule;
      if (!viewerRef.current || !mounted) return;

      // default tile source (we set a 'fake' size; WMTS will tile dynamically)
      const activeTemplate = getActiveTemplate();

      // Set maxLevel and tileSize for the tiling scheme
      const maxLevel = 8; // or your desired max zoom
      const tileSize = 256;
      // At maxLevel, columns = 2^(maxLevel+1), rows = 2^maxLevel
      const width = tileSize * Math.pow(2, maxLevel + 1);
      const height = tileSize * Math.pow(2, maxLevel);

      const tileSource = {
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
          
          const z = level;
          const template = activeTemplate.template;
          return template
            .replace("{z}", String(z))
            .replace("{row}", String(y))
            .replace("{col}", String(x));
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
  }, [selectedBody, selectedLayerId]);

  // Helper to pick the currently selected template object
  function getActiveTemplate() {
    const list = TREK_TEMPLATES[selectedBody];
    return list.find((l) => l.id === selectedLayerId) || list[0];
  }

  // USGS Gazetteer KML/KMZ example links are available from the USGS "KML and Shapefile downloads" page.
  // Example KMZ (center points) for Moon and Mars (listed on USGS downloads page):
  // - Moon center points (KMZ):
  //   https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz
  // - Mars center points (KMZ):
  //   https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.kmz
  // (Those downloads are documented on the USGS Gazetteer downloads page.)
  // See Sources at the bottom for the official page link.

  // Fetch and parse a KMZ (USGS Gazetteer center points) and convert to GeoJSON (togeojson)
  async function fetchGazetteerKMZ(kmzUrl: string) {
    try {
      // Use our proxy API route instead of fetching directly
      const proxyUrl = `/api/proxy/kmz?url=${encodeURIComponent(kmzUrl)}`;
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
      const geojson = (toGeoJSON as any).kml(kmlDoc);
      // normalize features to a simple {name, lat, lon}
      const points: any[] = [];
      for (const feat of geojson.features || []) {
        const props = feat.properties || {};
        const geom = feat.geometry;
        if (!geom || geom.type !== "Point") continue;
        const [lon, lat] = geom.coordinates;
        points.push({ name: props.name || props.Name || "unnamed", lat, lon });
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
    const base =
      "https://astrogeology.usgs.gov/pygeoapi/collections/mars/robbinsv1/items?f=json";
    // We can use 'limit' and bbox params per pygeoapi. Here we do a simple limited fetch.
    const resp = await fetch(base + "&limit=200");
    if (!resp.ok) {
      console.warn("pygeoapi fetch failed", resp.status);
      return;
    }
    const j = await resp.json();
    // pygeoapi returns features with properties lon_e, lat, craterid, diamkm
    const items = (j.features || []).map((f: any) => ({
      name: f.properties.craterid || f.properties.name || "crater",
      lat: f.properties.lat,
      lon: f.properties.lon_e,
      diamkm: f.properties.diamkm,
    }));
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
        <div style={{ marginBottom: 8 }}>
          <label>
            Body:
            <select
              value={selectedBody}
              onChange={(e) => {
                const b = e.target.value as BodyKey;
                setSelectedBody(b);
                setSelectedLayerId(TREK_TEMPLATES[b][0].id);
              }}
            >
              <option value="moon">Moon</option>
              <option value="mars">Mars</option>
              <option value="mercury">Mercury</option>
              <option value="ceres">Ceres</option>
            </select>
          </label>

          <label style={{ marginLeft: 8 }}>
            Layer:
            <select
              value={selectedLayerId}
              onChange={(e) => setSelectedLayerId(e.target.value)}
            >
              {TREK_TEMPLATES[selectedBody].map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>

          <button
            style={{ marginLeft: 8 }}
            onClick={() => setSelectedLayerId(getActiveTemplate().id)}
          >
            Load layer
          </button>

          <button
            style={{ marginLeft: 8 }}
            onClick={loadMoonGazetteer}
          >
            Load Moon Gazetteer (KMZ)
          </button>

          <button
            style={{ marginLeft: 8 }}
            onClick={() => queryMarsCraterDB(searchText)}
          >
            Load Mars crater DB (Robbins)
          </button>

          <input
            placeholder="search text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ marginLeft: 8 }}
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
            {filteredFeatures.map((f: any, i: number) => (
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
