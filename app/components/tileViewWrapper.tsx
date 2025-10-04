"use client";

import dynamic from 'next/dynamic';

const TileViewer = dynamic(() => import('./tileViewer3'), { ssr: false });

interface TileViewerWrapperProps {
  searchQuery?: string;
}

export default function TileViewerWrapper({ searchQuery }: TileViewerWrapperProps) {
  return <TileViewer externalSearchQuery={searchQuery} />;
}
