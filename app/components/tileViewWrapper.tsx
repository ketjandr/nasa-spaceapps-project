"use client";

import dynamic from 'next/dynamic';

const TileViewer = dynamic(() => import('./tileViewer'), { ssr: false });

export default TileViewer;