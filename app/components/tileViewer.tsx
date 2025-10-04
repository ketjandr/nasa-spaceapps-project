"use client";

import React, { useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";

const TileViewer = () => {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && viewerRef.current) {
      const viewer = OpenSeadragon({
        element: viewerRef.current,
        prefixUrl: "https://cdn.jsdelivr.net/npm/openseadragon@latest/build/openseadragon/images/",
        tileSources: {
          type: "image",
          url: "https://openseadragon.github.io/example-images/grand-canyon-landscape-overlooking.jpg",
        },
      });

      return () => {
        viewer.destroy();
      };
    }
  }, [isClient]);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <div ref={viewerRef} style={{ width: "100%", height: "500px" }} />;
};

export default TileViewer;