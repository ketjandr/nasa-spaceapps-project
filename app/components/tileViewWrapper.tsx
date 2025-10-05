"use client";

import dynamic from 'next/dynamic';

const TileViewer = dynamic(() => import('./tileViewer3'), { ssr: false });

interface TileViewerWrapperProps {
  searchQuery?: string;
  selectedBody?: string | null;
}

export default function TileViewerWrapper({ searchQuery, selectedBody }: TileViewerWrapperProps) {
  console.log('[TileViewerWrapper] Rendering with searchQuery:', searchQuery, 'selectedBody:', selectedBody);
  return <TileViewer externalSearchQuery={searchQuery} externalSelectedBody={selectedBody} />;
}
