"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import GlassSearchBar from '../components/search_bar';
import TileViewerWrapper from '../components/tileViewWrapper';

function ExplorerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [navigationParams, setNavigationParams] = useState<{
    body?: string;
    lat?: number;
    lon?: number;
    zoom?: number;
  }>({});

  useEffect(() => {
    // Get the search query from URL params
    const query = searchParams.get('search');
    if (query) {
      setSearchQuery(query);
    }

    // Get navigation parameters from PhotoSphereGallery
    const body = searchParams.get('body');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const zoom = searchParams.get('zoom');

    setNavigationParams({
      body: body || undefined,
      lat: lat ? parseFloat(lat) : undefined,
      lon: lon ? parseFloat(lon) : undefined,
      zoom: zoom ? parseInt(zoom) : undefined,
    });
  }, [searchParams]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Update URL with new search query
    router.push(`/explorer?search=${encodeURIComponent(query)}`);
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black">
      {/* Header with Search Bar */}
      <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-8 py-4">
          <div className="flex items-center gap-4">
            {/* Logo - click to go home */}
            <button
              onClick={handleBackToHome}
              className="flex items-center hover:opacity-80 transition-opacity"
              title="Back to home"
            >
              <Image 
                src="/logo_transparent.png" 
                alt="Logo" 
                width={100}
                height={48}
                className="h-12 w-auto"
                priority
              />
            </button>

            {/* Search bar in header */}
            <div className="flex-1">
              <GlassSearchBar 
                onSearch={handleSearch}
                value={searchQuery}
                placeholder={"Search planetary features, locations, coordinates..."}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Tile Viewer */}
      <main className="relative py-8 px-4 sm:px-8">
        <div className="max-w-[1800px] mx-auto">
          {/* Title and description */}
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Planetary Explorer
            </h1>
            <p className="text-white/60 text-sm sm:text-base">
              {searchQuery 
                ? (
                  <>
                    Showing results for: <span className="text-white/90 font-semibold">&quot;{searchQuery}&quot;</span>
                  </>
                )
                : "Select a celestial body and explore detailed planetary maps"}
            </p>
          </div>
          
          {/* Tile viewer */}
          <div className="bg-gray-900/50 rounded-xl p-4 sm:p-6 backdrop-blur-sm border border-white/10 shadow-2xl">
            <TileViewerWrapper 
              searchQuery={searchQuery} 
              initialBody={navigationParams.body}
              initialLat={navigationParams.lat}
              initialLon={navigationParams.lon}
              initialZoom={navigationParams.zoom}
            />
          </div>

          {/* Help section */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <h3 className="text-white font-semibold mb-2 text-sm">🔍 Search</h3>
              <p className="text-white/60 text-xs">
                Type feature names or use coordinates to find locations
              </p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <h3 className="text-white font-semibold mb-2 text-sm">📍 Mark</h3>
              <p className="text-white/60 text-xs">
                Click on features to place markers and view details
              </p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <h3 className="text-white font-semibold mb-2 text-sm">🗺️ Navigate</h3>
              <p className="text-white/60 text-xs">
                Pan, zoom, and explore gigapixel planetary imagery
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative py-6 px-4 text-center border-t border-white/10 mt-8">
        <p className="text-white/40 text-sm">
          Made with ❤️ by Slack Overflow
        </p>
      </footer>
    </div>
  );
}

export default function ExplorerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading explorer...</div>
      </div>
    }>
      <ExplorerContent />
    </Suspense>
  );
}
