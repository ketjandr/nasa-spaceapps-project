"use client";

import dynamic from 'next/dynamic';

const TileViewer = dynamic(() => import('./tileViewer3'), { ssr: false });

export default TileViewer;