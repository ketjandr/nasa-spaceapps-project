"use client";

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const TileViewer = dynamic(() => import('./tileViewer3'), { ssr: false });

interface TileViewerWrapperProps {
  searchQuery?: string;
}

export default function TileViewerWrapper({ searchQuery }: TileViewerWrapperProps) {
  const router = useRouter();

  const handleSearchChange = (newSearch: string) => {
    // Update the URL to sync with the top search bar
    const url = new URL(window.location.href);
    if (newSearch.trim()) {
      url.searchParams.set('search', newSearch);
    } else {
      url.searchParams.delete('search');
    }
    router.replace(url.pathname + url.search, { scroll: false });
  };

  return (
    <TileViewer 
      externalSearchQuery={searchQuery}
      onSearchChange={handleSearchChange}
    />
  );
}
