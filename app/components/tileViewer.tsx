"use client";

import React, { useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";

type ViewerTileSource = {
  width: number;
  height: number;
  tile_size: number;
  min_level: number;
  max_level: number;
  url_template: string;
};

type ViewerConfigResponse = {
  layer_id: string;
  title: string | null;
  abstract: string | null;
  time: string | null;
  format: string;
  tile_source: ViewerTileSource;
};

const DEFAULT_LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor";
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

const TileViewer = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerInstance = useRef<OpenSeadragon.Viewer | null>(null);

  const [config, setConfig] = useState<ViewerConfigResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!backendUrl) {
      setError("NEXT_PUBLIC_BACKEND_URL is not set");
      setStatus("error");
      return;
    }

    const controller = new AbortController();

    async function fetchConfig() {
      setStatus("loading");
      setError(null);

      try {
        const params = new URLSearchParams({
          projection: "epsg3857",
        });
        const response = await fetch(
          `${backendUrl}/viewer/layers/${DEFAULT_LAYER}?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const data = (await response.json()) as ViewerConfigResponse;
        setConfig(data);
        setStatus("ready");
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
        setStatus("error");
        setError((err as Error).message ?? "Failed to load layer configuration");
      }
    }

    fetchConfig();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!config || !containerRef.current) {
      return;
    }

    viewerInstance.current?.destroy();

    const { tile_source: source } = config;

    const tileSource: OpenSeadragon.TileSourceOptions = {
      width: source.width,
      height: source.height,
      tileSize: source.tile_size,
      minLevel: source.min_level,
      maxLevel: source.max_level,
      crossOriginPolicy: "Anonymous",
      getTileUrl(level, x, y) {
        return source.url_template
          .replace("{z}", String(level))
          .replace("{x}", String(x))
          .replace("{y}", String(y));
      },
    };

    viewerInstance.current = OpenSeadragon({
      element: containerRef.current,
      prefixUrl:
        "https://cdn.jsdelivr.net/npm/openseadragon@5.0.1/build/openseadragon/images/",
      showNavigator: true,
      navigatorPosition: "BOTTOM_RIGHT",
      tileSources: [tileSource],
    });

    return () => {
      viewerInstance.current?.destroy();
      viewerInstance.current = null;
    };
  }, [config]);

  return (
    <div className="w-full">
      <div className="mb-4 text-center text-sm text-white/70">
        {status === "loading" && "Loading NASA layer…"}
        {status === "ready" && config?.title}
        {status === "error" && error}
      </div>
      <div
        ref={containerRef}
        style={{ height: "500px", width: "100%" }}
        className="rounded-lg border border-white/10 bg-black"
      />
    </div>
  );
};

export default TileViewer;
