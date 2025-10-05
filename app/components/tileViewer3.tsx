// app/components/TileViewer.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
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

type PlanetFeature = {
  name: string;
  lat: number;
  lon: number;
  diamkm?: number;
};

// --- local TREK templates (fallback / examples) ----------------------
const TREK_TEMPLATES: Record<
  BodyKey,
  Array<{ id: string; title: string; template: string; example?: string; type?: "base" | "overlay" | "temporal"; temporalRange?: any }>
> = {
  moon: [
    {
      id: "lro_wac",
      title: "LRO WAC Mosaic (global 303ppd)",
      template:
        "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{row}/{col}.jpg",
      example:
        "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/0/0/0.jpg",
      type: "base",
    },
    {
      id: "lro_lola_elevation",
      title: "LRO LOLA Elevation (overlay)",
      template:
        "https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_ClrShade_Global_128ppd_v04/1.0.0/default/default028mm/{z}/{row}/{col}.png",
      type: "overlay",
    },
  ],
  mars: [
    {
      id: "mars_mgs_mola",
      title: "Mars MGS MOLA (shaded)",
      template:
        "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{row}/{col}.jpg",
      type: "base",
    },
    {
      id: "mars_hirise",
      title: "Mars HiRISE Imagery (overlay)",
      template:
        "https://trek.nasa.gov/tiles/Mars/EQ/Mars_HiRISE_Mosaic_Global_256ppd/1.0.0/default/default028mm/{z}/{row}/{col}.jpg",
      type: "overlay",
    },
  ],
  mercury: [
    {
      id: "messenger_mdis",
      title: "MESSENGER MDIS Basemap",
      template:
        "https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m/1.0.0/default/default028mm/{z}/{row}/{col}.jpg",
      type: "base",
    },
  ],
  ceres: [
    {
      id: "ceres_dawn",
      title: "Ceres Dawn FC HAMO",
      template:
        "https://trek.nasa.gov/tiles/Ceres/EQ/Ceres_Dawn_FC_HAMO_ClrShade_DLR_Global_60ppd_Oct2016/1.0.0/default/default028mm/{z}/{row}/{col}.jpg",
      type: "base",
    },
  ],
  milky_way: [],
  unknown: [],
};

// backend config
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
const backendBase = backendUrl ? backendUrl.replace(/\/$/, "") : "";

// --- component -------------------------------------------------------
interface TileViewerProps {
  externalSearchQuery?: string;
}

export default function TileViewer({ externalSearchQuery }: TileViewerProps) {
  // refs and viewer instances
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const compareViewerRef = useRef<HTMLDivElement | null>(null);
  const viewerObjRef = useRef<any | null>(null);
  const compareViewerObjRef = useRef<any | null>(null);

  // state
  const [isClient, setIsClient] = useState(false);
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [layerConfig, setLayerConfig] = useState<ViewerConfigResponse | null>(null);
  const [selectedBody, setSelectedBody] = useState<BodyKey>("moon");
  const [selectedOverlayId, setSelectedOverlayId] = useState<string>("");
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.5);
  const [viewMode, setViewMode] = useState<"single" | "split" | "overlay">("single");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [features, setFeatures] = useState<PlanetFeature[]>([]);
  const [searchText, setSearchText] = useState<string>(externalSearchQuery ?? "");

  // sync external search
  useEffect(() => {
    if (externalSearchQuery) setSearchText(externalSearchQuery);
  }, [externalSearchQuery]);

  // client-side detection to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // load datasets list from backend if configured (optional)
  useEffect(() => {
    if (!backendBase) {
      // no backend configured — fallback to TREK_TEMPLATES as dataset list
      const fallback: DatasetListItem[] = [];
      (Object.keys(TREK_TEMPLATES) as BodyKey[]).forEach((body) => {
        TREK_TEMPLATES[body].forEach((d) => {
          fallback.push({ id: `${body}:${d.id}`, title: `${d.title} — ${body}`, body });
        });
      });
      setDatasets(fallback);
      if (fallback.length > 0 && !selectedLayerId) setSelectedLayerId(fallback[0].id);
      return;
    }

    let mounted = true;
    (async function load() {
      try {
        const resp = await fetch(`${backendBase}/viewer/layers`);
        if (!mounted) return;
        if (!resp.ok) {
          console.warn("Failed to load datasets from backend:", resp.status);
          return;
        }
        const data = await resp.json();
        setDatasets(data);
        if (data.length > 0 && !selectedLayerId) setSelectedLayerId(data[0].id);
      } catch (err) {
        console.error("Error loading datasets:", err);
      }
    })();

    return () => { mounted = false; };
  }, [backendBase, selectedLayerId]);

  // Load layer config (either from backend or from local TREK_TEMPLATES)
  useEffect(() => {
    let mounted = true;
    if (!selectedLayerId) {
      setLayerConfig(null);
      return;
    }

    (async () => {
      // If backend configured and selectedLayerId appears to be backend id, fetch it
      if (backendBase && !selectedLayerId.includes(":")) {
        try {
          const resp = await fetch(`${backendBase}/viewer/layers/${selectedLayerId}`);
          if (!mounted) return;
          if (!resp.ok) {
            console.warn("Failed to load layer config:", resp.status);
            setLayerConfig(null);
            return;
          }
          const cfg = await resp.json();
          setLayerConfig(cfg);
          const body = (cfg.body || "unknown").toLowerCase() as BodyKey;
          setSelectedBody(body);
          return;
        } catch (err) {
          console.error("Error loading layer config from backend:", err);
        }
      }

      // fallback: parse our TREK_TEMPLATES selection string `body:id` or id
      const [maybeBody, maybeId] = selectedLayerId.split(":");
      let foundTemplate;
      if (maybeId) {
        const bodyKey = (maybeBody as BodyKey) || "unknown";
        foundTemplate = TREK_TEMPLATES[bodyKey]?.find((t) => t.id === maybeId);
        if (foundTemplate) {
          // build a minimal layerConfig from template
          const cfg: ViewerConfigResponse = {
            id: selectedLayerId,
            title: foundTemplate.title,
            tile_url_template: foundTemplate.template,
            min_zoom: 0,
            max_zoom: 8,
            tile_size: 256,
            body: maybeBody,
          };
          if (!mounted) return;
          setLayerConfig(cfg);
          setSelectedBody(maybeBody as BodyKey);
          return;
        }
      } else {
        // maybe selectedLayerId is just template id (search all bodies)
        for (const body of Object.keys(TREK_TEMPLATES) as BodyKey[]) {
          const t = TREK_TEMPLATES[body].find((x) => x.id === selectedLayerId);
          if (t) {
            foundTemplate = t;
            const cfg: ViewerConfigResponse = {
              id: selectedLayerId,
              title: t.title,
              tile_url_template: t.template,
              min_zoom: 0,
              max_zoom: 8,
              tile_size: 256,
              body,
            };
            if (!mounted) return;
            setLayerConfig(cfg);
            setSelectedBody(body);
            return;
          }
        }
      }

      // If nothing found, clear
      if (!mounted) setLayerConfig(null);
    })();

    return () => { mounted = false; };
  }, [selectedLayerId]);

  // When selectedBody changes, auto-load features (Moon Gazetteer or Mars Robbins)
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

      viewer = new osd.Viewer({
        element: viewerRef.current,
        prefixUrl: "https://cdn.jsdelivr.net/npm/openseadragon@latest/build/openseadragon/images/",
        showNavigator: true,
        navigatorSizeRatio: 0.15,
        tileSources: [tileSource as any],
        gestureSettingsMouse: { clickToZoom: false },
        constrainDuringPan: true,
        homeFillsViewer: true,
        visibilityRatio: 0.5,
        minZoomImageRatio: 0.8,
        maxZoomPixelRatio: 2.0,
        defaultZoomLevel: 1,
        wrapHorizontal: true,
        wrapVertical: false,
        viewportConstraint: new osd.Rect(0, -0.1, 1, 1.2),
        immediateRender: true,
        preserveImageSizeOnResize: true,
        animationTime: 0,
        springStiffness: 5,
        maxImageCacheCount: 200
      });

      viewerObjRef.current = viewer;
    })();

    return () => {
      mounted = false;
      if (viewer) viewer.destroy();
    };
  }, [layerConfig]);

  // Split/overlay viewer functionality
  // Initialize and sync viewers
  useEffect(() => {
    let mounted = true;
    let osdModule: any = null;
    let mainViewer: any = null;
    let compareViewer: any = null;

    const cleanup = () => {
      try {
        if (mainViewer) { mainViewer.destroy(); mainViewer = null; }
      } catch (e) { } // ignore
      try {
        if (compareViewer) { compareViewer.destroy(); compareViewer = null; }
      } catch (e) { } // ignore
      viewerObjRef.current = null;
      compareViewerObjRef.current = null;
    };

    (async () => {
      if (!layerConfig) {
        cleanup();
        return;
      }

      try {
        const OSDModule = await import("openseadragon");
        osdModule = OSDModule.default ?? OSDModule;

        // wait one tick for DOM
        await new Promise((r) => setTimeout(r, 0));
        if (!mounted) return;

        // destroy any existing viewers
        cleanup();

        // create tileSource object appropriate for OpenSeadragon
        const minZoom = layerConfig.min_zoom ?? 0;
        const maxZoom = layerConfig.max_zoom ?? 8;
        const tileSize = layerConfig.tile_size ?? 256;
        const zoomLevels = Math.max(0, maxZoom - minZoom);

        // pick a virtual image size that matches rows/cols pattern:
        // width = tileSize * 2^(maxLevel+1), height = tileSize * 2^(maxLevel)
        const virtualWidth = tileSize * Math.pow(2, zoomLevels + 1);
        const virtualHeight = tileSize * Math.pow(2, zoomLevels);

        // tile URL template from layerConfig
        const template = layerConfig.tile_url_template;
        
        // Create a template object for comparison logic
        const foundTemplate = {
          template: layerConfig.tile_url_template,
          type: "base" as const
        };

        const tileSource: any = {
          width: virtualWidth,
          height: virtualHeight,
          tileSize,
          minLevel: 0,
          maxLevel: zoomLevels,
          getTileUrl: function (level: number, x: number, y: number) {
            // Map OpenSeadragon level (0..maxLevel) -> WMTS z (minZoom..maxZoom)
            const z = level + minZoom;
            // compute wrapping & row/col counts at that z
            const cols = Math.pow(2, level + 1);
            const rows = Math.pow(2, level);

            // wrap x horizontally
            const wrappedX = ((x % cols) + cols) % cols;
            // if y outside range, return null (OS will skip)
            if (y < 0 || y >= rows) return null;

            // template might use {z}/{row}/{col} or {z}/{y}/{x} or {z}/{col}/{row}
            return template
              .replace(/{z}/g, String(z))
              .replace(/{row}/g, String(y))
              .replace(/{col}/g, String(wrappedX))
              .replace(/{x}/g, String(wrappedX))
              .replace(/{y}/g, String(y));
          },
        };

        // Create main viewer
        if (!viewerRef.current) return;
        mainViewer = new osdModule({
          element: viewerRef.current,
          prefixUrl: "https://cdn.jsdelivr.net/npm/openseadragon@latest/build/openseadragon/images/",
          tileSources: [tileSource],
          showNavigator: true,
          navigatorSizeRatio: 0.18,
          gestureSettingsMouse: { clickToZoom: false },
          constrainDuringPan: true,
          homeFillsViewer: true,
          visibilityRatio: 0.5,
          wrapHorizontal: true,
          wrapVertical: false,
          animationTime: 0.25,
        });

        viewerObjRef.current = mainViewer;

        // Add overlays (like center crosshair) when open
        mainViewer.addHandler("open", function () {
          addCenterCrosshair(mainViewer);
        });

        // If split or overlay mode, create compare viewer
        const overlayTemplate = selectedOverlayId
          ? (TREK_TEMPLATES[selectedBody] || []).find((t) => t.id === selectedOverlayId)
          : null;
        
        // For split mode, use the overlay template if selected, otherwise use the main template
        // For overlay mode, require an overlay template
        const compareTemplate = overlayTemplate || (viewMode === "split" ? foundTemplate : null);

        console.log("Debug viewer creation:", {
          viewMode,
          selectedOverlayId,
          overlayTemplate: !!overlayTemplate,
          foundTemplate: !!foundTemplate,
          compareTemplate: !!compareTemplate,
          shouldCreateCompare: (viewMode === "split" || viewMode === "overlay") && compareTemplate
        });

        if ((viewMode === "split" || viewMode === "overlay") && compareTemplate) {
          if (!compareViewerRef.current) {
            console.error("Compare viewer container not found");
          } else {
            // Build compare viewer tile source using compareTemplate
            const compareTileSource: any = {
              width: virtualWidth,
              height: virtualHeight,
              tileSize,
              minLevel: 0,
              maxLevel: zoomLevels,
              getTileUrl(level: number, x: number, y: number) {
                const z = level + minZoom;
                const cols = Math.pow(2, level + 1);
                const rows = Math.pow(2, level);
                const wrappedX = ((x % cols) + cols) % cols;
                if (y < 0 || y >= rows) return null;
                let url = compareTemplate.template;
                if (compareTemplate.type === "temporal" && selectedDate) {
                  url = url.replace("{date}", selectedDate.replace(/-/g, ""));
                }
                return url
                  .replace(/{z}/g, String(z))
                  .replace(/{row}/g, String(y))
                  .replace(/{col}/g, String(wrappedX))
                  .replace(/{x}/g, String(wrappedX))
                  .replace(/{y}/g, String(y));
              },
            };

            compareViewer = new osdModule({
              element: compareViewerRef.current,
              prefixUrl: "https://cdn.jsdelivr.net/npm/openseadragon@latest/build/openseadragon/images/",
              tileSources: [compareTileSource],
              showNavigator: viewMode === "split",
              navigatorSizeRatio: 0.14,
              gestureSettingsMouse: { clickToZoom: false },
              constrainDuringPan: true,
              homeFillsViewer: true,
              visibilityRatio: 0.5,
              wrapHorizontal: true,
            });

            compareViewerObjRef.current = compareViewer;

            // Sync viewers with guards to prevent infinite recursion
            let isUpdating = false;
            const sync = (src: any, dst: any, id: string) => {
              if (!src || !dst) return;
              const handler = () => {
                if (isUpdating) return; // Prevent infinite recursion
                
                try {
                  isUpdating = true;
                  const center = src.viewport.getCenter();
                  const zoom = src.viewport.getZoom();
                  
                  // Use immediate=false to prevent triggering events during sync
                  dst.viewport.panTo(center, false);
                  dst.viewport.zoomTo(zoom, null, false);
                } catch (error) {
                  console.error(`Error syncing viewer ${id}:`, error);
                } finally {
                  // Reset the flag after a short delay to allow the sync to complete
                  setTimeout(() => { isUpdating = false; }, 10);
                }
              };
              src.addHandler("pan", handler);
              src.addHandler("zoom", handler);
              // return cleanup
              return () => {
                src.removeHandler("pan", handler);
                src.removeHandler("zoom", handler);
              };
            };

            // attach bidirectional sync
            const cleanupA = sync(mainViewer, compareViewer, "main->compare");
            const cleanupB = sync(compareViewer, mainViewer, "compare->main");

            // set overlay opacity if in overlay mode (use world item)
            try {
              if (viewMode === "overlay" && compareViewer.world.getItemAt(0)) {
                compareViewer.world.getItemAt(0).setOpacity(overlayOpacity);
              }
            } catch (err) {
              // ignore
            }

            // ensure we remove handlers on cleanup (we'll call cleanup() below)
            // store cleanups in local closures
          }
        } // end overlay

      } catch (err) {
        console.error("Error creating OpenSeadragon viewers:", err);
      }
    })();

    return () => {
      mounted = false;
      try { if (viewerObjRef.current) viewerObjRef.current.destroy(); } catch {}
      try { if (compareViewerObjRef.current) compareViewerObjRef.current.destroy(); } catch {}
      viewerObjRef.current = null;
      compareViewerObjRef.current = null;
    };
  }, [selectedBody, selectedLayerId, selectedOverlayId, viewMode, selectedDate]);

  // Update overlay opacity when it changes
  useEffect(() => {
    if (viewMode !== "overlay") return;
    const cmp = compareViewerObjRef.current;
    if (!cmp) return;
    try {
      const item = cmp.world.getItemAt(0);
      if (item && item.setOpacity) item.setOpacity(overlayOpacity);
    } catch (err) {
      // ignore
    }
  }, [overlayOpacity, viewMode]);

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
  async function fetchGazetteerKMZ(kmzUrl: string): Promise<PlanetFeature[]> {
    try {
      // If backend proxy set, use it to avoid CORS problems; otherwise try direct fetch
      const fetchUrl = backendBase ? `${backendBase}/proxy/kmz?url=${encodeURIComponent(kmzUrl)}` : kmzUrl;
      const r = await fetch(fetchUrl);
      if (!r.ok) {
        console.warn("KMZ fetch failed", r.status, r.statusText);
        return [];
      }
      const arrayBuffer = await r.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const kmlEntryName = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(".kml"));
      if (!kmlEntryName) {
        console.warn("No KML inside KMZ");
        return [];
      }
      const kmlText = await zip.files[kmlEntryName].async("text");
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(kmlText, "application/xml");
      const geojson = (toGeoJSON as any).kml(kmlDoc) as FeatureCollection;
      const pts: PlanetFeature[] = [];
      for (const feat of geojson.features ?? []) {
        if (!feat.geometry || feat.geometry.type !== "Point") continue;
        const [lon, lat] = (feat.geometry as Point).coordinates;
        pts.push({
          name: (feat.properties as any)?.name || (feat.properties as any)?.Name || "unnamed",
          lat: Number(lat),
          lon: Number(lon),
        });
      }
      return pts;
    } catch (err) {
      console.error("Error parsing KMZ:", err);
      return [];
    }
  }

  async function loadMoonGazetteer() {
    const moonKmz = "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz";
    const pts = await fetchGazetteerKMZ(moonKmz);
    setFeatures(pts.slice(0, 500));
  }

  async function queryMarsCraterDB() {
    // First try USGS center points KMZ to populate names
    const marsKmz = "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.kmz";
    const ptsFromKmz = await fetchGazetteerKMZ(marsKmz);
    // then fetch Robbins crater DB via pygeoapi
    const base = "https://astrogeology.usgs.gov/pygeoapi/collections/mars/robbinsv1/items?f=json&limit=500";
    try {
      const resp = await fetch(base);
      if (!resp.ok) {
        console.warn("pygeoapi fetch failed", resp.status);
        // fallback to kmz points
        setFeatures(ptsFromKmz.slice(0, 500));
        return;
      }
      const j = await resp.json();
      const items = (j.features ?? []).map((f: any) => {
        const lat = f.properties?.lat;
        const lon = f.properties?.lon_e;
        if (typeof lat !== "number" || typeof lon !== "number") return null;
        return {
          name: f.properties?.craterid || f.properties?.name || "crater",
          lat,
          lon,
          diamkm: f.properties?.diamkm,
        } as PlanetFeature;
      }).filter(Boolean) as PlanetFeature[];

      // merge with kmz names (prefer pygeoapi for craters)
      const merged = items.concat(ptsFromKmz).slice(0, 1000);
      setFeatures(merged);
    } catch (err) {
      console.error("Error fetching Mars crater DB:", err);
      setFeatures(ptsFromKmz.slice(0, 500));
    }
  }

  // ---------- overlays / helpers ----------
  function addCenterCrosshair(viewer: any) {
    if (!viewer) return;
    try {
      const centerEl = document.createElement("div");
      centerEl.className = "osd-center-crosshair";
      centerEl.style.cssText = `
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255,255,255,0.9);
        border-radius: 50%;
        pointer-events: none;
        transform: translate(-50%, -50%);
      `;
      // place at viewport center
      viewer.addOverlay({
        element: centerEl,
        location: viewer.viewport.getCenter(),
        placement: "CENTER",
        checkResize: false,
      });
    } catch (err) {
      console.error("addCenterCrosshair error:", err);
    }
  }

  // Utility: pan/zoom viewer to lon/lat for NASA Trek tiles
  function panToLonLat(lon: number, lat: number, zoomLevel = 4) {
    const v = viewerObjRef.current;
    if (!v) return;

    // Normalize lon from -180..180 to 0..360 used by Trek tile images
    lon = ((lon % 360) + 360) % 360;
    lat = Math.max(-90, Math.min(90, lat));

    // get image dimensions from the first world item
    let sourceItem;
    try {
      sourceItem = v.world.getItemAt(0);
    } catch (err) {
      console.error("No world item in viewer", err);
      return;
    }
    if (!sourceItem || !sourceItem.source) {
      console.error("No source info");
      return;
    }
    const imgW = sourceItem.source.width;
    const imgH = sourceItem.source.height;
    if (!imgW || !imgH) {
      console.error("Invalid source dimensions", imgW, imgH);
      return;
    }

    // convert lon/lat -> image pixels
    const x = (lon / 360) * imgW;
    const y = ((90 - lat) / 180) * imgH;

    // create marker element
    const marker = document.createElement("div");
    marker.className = "feature-marker";
    marker.style.cssText = `
      width: 22px; height:22px; border:3px solid rgba(255,80,80,0.95);
      border-radius:50%; background: rgba(255, 80, 80, 0.25);
      transform: translate(-50%, -50%); pointer-events: auto;
    `;

    // remove old markers
    document.querySelectorAll(".feature-marker").forEach((el) => el.remove());

    // add overlay
    try {
      v.addOverlay({
        element: marker,
        location: v.viewport.imageToViewportCoordinates(x, y),
        placement: "CENTER",
        checkResize: false,
      });
    } catch (err) {
      console.error("Error adding overlay:", err);
    }

    // pan+zoom
    const viewportPoint = v.viewport.imageToViewportCoordinates(x, y);
    v.viewport.panTo(viewportPoint, true);
    setTimeout(() => {
      v.viewport.zoomTo(zoomLevel, viewportPoint, true);
    }, 120);
  }

  // filtered features by search text
  const filteredFeatures = features.filter((f) => {
    if (!searchText) return true;
    return f.name?.toLowerCase().includes(searchText.toLowerCase());
  });

  // ---------- UI -----------------------------------------------------
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <label>
            Dataset:
            <select value={selectedLayerId ?? ""} onChange={(e) => setSelectedLayerId(e.target.value)}>
              <option value="">(none)</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </label>

          <label>
            View Mode:
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as any)}>
              <option value="single">Single</option>
              <option value="split">Split</option>
              <option value="overlay">Overlay</option>
            </select>
          </label>

          {(viewMode === "split" || viewMode === "overlay") && (
            <label>
              Compare layer:
              <select value={selectedOverlayId} onChange={(e) => setSelectedOverlayId(e.target.value)}>
                <option value="">(none)</option>
                {(TREK_TEMPLATES[selectedBody] || []).map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </label>
          )}

          {viewMode === "overlay" && (
            <label>
              Opacity:
              <input type="range" min={0} max={1} step={0.05} value={overlayOpacity} onChange={(e) => setOverlayOpacity(Number(e.target.value))}/>
            </label>
          )}

          {selectedBody === "moon" && <button onClick={loadMoonGazetteer}>Load Moon Gazetteer</button>}
          {selectedBody === "mars" && <button onClick={() => queryMarsCraterDB()}>Load Mars Craters</button>}

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

        <div style={{ width: "100%", height: "640px", position: "relative" }}>
          {isClient ? (
            <>
              <div ref={viewerRef} style={{ width: viewMode === "split" ? "50%" : "100%", height: "100%", position: "absolute", left: 0, top: 0 }} />
              {(viewMode === "split" || viewMode === "overlay") && (
                <div ref={compareViewerRef} style={{ width: viewMode === "split" ? "50%" : "100%", height: "100%", position: "absolute", right: 0, top: 0, pointerEvents: "auto" }} />
              )}
            </>
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", color: "white" }}>
              Loading viewer...
            </div>
          )}
        </div>
      </div>

      <aside style={{ width: 360, borderLeft: "1px solid #eee", padding: 8, overflow: "auto" }}>
        <h3>Features / Search</h3>
        <input type="text" placeholder="Filter features..." value={searchText} onChange={(e) => setSearchText(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        {filteredFeatures.length === 0 ? (
          <div style={{ color: "#888" }}>{features.length === 0 ? "No features loaded for this body." : "No features match your search."}</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {filteredFeatures.map((f, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <button style={{ width: "100%", textAlign: "left" }} onClick={() => panToLonLat(f.lon, f.lat, 6)}>
                  <strong>{f.name}</strong>
                  <div style={{ fontSize: 12 }}>{f.lat.toFixed(4)}, {f.lon.toFixed(4)} {f.diamkm ? `• ${f.diamkm} km` : ""}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
