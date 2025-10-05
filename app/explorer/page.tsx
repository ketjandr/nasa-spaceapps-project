"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import GlassSearchBar from "../components/search_bar";
import Image from "next/image";
import { useInstantSearch } from "../utils/localSearch";
import dynamic from "next/dynamic";

// Dynamically import TileViewer to avoid SSR issues
const TileViewer3 = dynamic(() => import("../components/tileViewer3"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black/80">
      <p className="text-white">Loading tile viewer...</p>
    </div>
  )
});

interface PlanetaryBody {
  id: string;
  name: string;
  color: string;
  description: string;
  features: number;
}

interface FeaturePin {
  id: string;
  name: string;
  body: string;
  lat: number;
  lon: number;
  category: string;
  image?: string;
  imageUrl?: string; // For tile viewer URL
}

export default function ExplorerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBody, setSelectedBody] = useState<string>("Moon");
  const [selectedFeature, setSelectedFeature] = useState<FeaturePin | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'satellite' | 'tiles'>('satellite');
  const [featureImages, setFeatureImages] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const mapRef = useRef<HTMLDivElement>(null);

  // Get search results using instant search
  const searchResults = useInstantSearch(searchQuery, 50);

  // Fetch feature images from backend
  const fetchFeatureImage = async (featureName: string, body: string, lat: number, lon: number): Promise<string | null> => {
    const cacheKey = `${featureName}-${body}`;
    
    // Check if already loaded or loading
    if (featureImages[cacheKey]) {
      return featureImages[cacheKey];
    }
    
    if (loadingImages.has(cacheKey)) {
      return null; // Still loading
    }
    
    // Mark as loading
    setLoadingImages(prev => new Set(prev).add(cacheKey));
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const response = await fetch(
        `${backendUrl}/images/search?feature_name=${encodeURIComponent(featureName)}&target_body=${encodeURIComponent(body)}&lat=${lat}&lon=${lon}`
      );
      
      if (response.ok) {
        const data = await response.json();
        // Get the first image from NASA or Trek tiles
        const firstImage = data.nasa_images?.[0]?.url || 
                          data.trek_tiles?.[0]?.url || 
                          data.mission_images?.[0]?.url ||
                          `https://picsum.photos/400/300?random=${featureName}`;
        
        setFeatureImages(prev => ({...prev, [cacheKey]: firstImage}));
        setLoadingImages(prev => {
          const newSet = new Set(prev);
          newSet.delete(cacheKey);
          return newSet;
        });
        
        return firstImage;
      }
    } catch (error) {
      console.error(`Failed to fetch image for ${featureName}:`, error);
    }
    
    // Fallback to placeholder
    const fallback = `https://picsum.photos/400/300?random=${featureName}`;
    setFeatureImages(prev => ({...prev, [cacheKey]: fallback}));
    setLoadingImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(cacheKey);
      return newSet;
    });
    
    return fallback;
  };

  // Planetary bodies data
  const planetaryBodies: PlanetaryBody[] = [
    {
      id: "Moon",
      name: "Moon",
      color: "#C0C0C0",
      description: "Earth's natural satellite with diverse geological features",
      features: 1205
    },
    {
      id: "Mars",
      name: "Mars",
      color: "#CD5C5C",
      description: "The Red Planet with ancient river valleys and massive volcanoes",
      features: 892
    },
    {
      id: "Mercury",
      name: "Mercury", 
      color: "#8C7853",
      description: "The closest planet to the Sun with heavily cratered surface",
      features: 447
    }
  ];

  useEffect(() => {
    const query = searchParams.get('search');
    if (query) {
      setSearchQuery(query);
    }
  }, [searchParams]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    router.push(`/explorer?search=${encodeURIComponent(query)}`);
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  // Convert search results to feature pins
  const featurePins: FeaturePin[] = searchResults.map((result, index) => {
    const cacheKey = `${result.name}-${result.body}`;
    const lat = result.coordinates?.lat || (Math.random() - 0.5) * 180;
    const lon = result.coordinates?.lon || (Math.random() - 0.5) * 360;
    
    // Trigger image fetch if not already cached
    if (!featureImages[cacheKey] && !loadingImages.has(cacheKey)) {
      fetchFeatureImage(result.name, result.body, lat, lon);
    }
    
    return {
      id: `${result.id}-${index}`,
      name: result.name,
      body: result.body,
      lat,
      lon,
      category: result.category,
      image: featureImages[cacheKey] || `https://picsum.photos/400/300?random=${index}` // Fallback while loading
    };
  }).filter((pin) => pin.body === selectedBody);

  return (
    <div className="min-h-screen bg-black">
      {/* Top Navigation Bar */}
      <nav className="relative z-50 bg-black/90 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Logo and Back Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToHome}
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm">Back to Explorer</span>
            </button>
            <div className="w-px h-6 bg-white/20"></div>
            <h1 className="text-xl font-semibold text-white">Planetary Surface Explorer</h1>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md mx-8">
            <GlassSearchBar 
              onSearch={handleSearch}
              placeholder="Search features on surface..."
              value={searchQuery}
            />
          </div>

          {/* View Controls */}
          <div className="flex items-center gap-4">
            <div className="flex bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setViewMode('satellite')}
                className={`px-3 py-1 rounded text-sm transition-all ${
                  viewMode === 'satellite' 
                    ? 'bg-blue-500 text-white' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Satellite
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1 rounded text-sm transition-all ${
                  viewMode === 'map' 
                    ? 'bg-blue-500 text-white' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Terrain
              </button>
              <button
                onClick={() => setViewMode('tiles')}
                className={`px-3 py-1 rounded text-sm transition-all ${
                  viewMode === 'tiles' 
                    ? 'bg-blue-500 text-white' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Tile Viewer
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Body Selection */}
        <div className="w-80 bg-black/80 backdrop-blur-xl border-r border-white/10 flex flex-col">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Planetary Bodies</h2>
            <div className="space-y-3">
              {planetaryBodies.map((body) => (
                <button
                  key={body.id}
                  onClick={() => setSelectedBody(body.id)}
                  className={`w-full p-4 rounded-lg border transition-all text-left ${
                    selectedBody === body.id
                      ? 'bg-blue-500/20 border-blue-400/40 text-white'
                      : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-4 h-4 rounded-full mt-1"
                      style={{ backgroundColor: body.color }}
                    />
                    <div className="flex-1">
                      <h3 className="font-medium">{body.name}</h3>
                      <p className="text-sm text-white/60 mt-1">{body.description}</p>
                      <p className="text-xs text-white/40 mt-2">{body.features} features mapped</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Feature List */}
          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="text-md font-medium text-white mb-4">
              Features on {selectedBody} 
              {searchQuery && ` (${featurePins.length} found)`}
            </h3>
            <div className="space-y-2">
              {featurePins.slice(0, 20).map((pin) => (
                <button
                  key={pin.id}
                  onClick={() => setSelectedFeature(pin)}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    selectedFeature?.id === pin.id
                      ? 'bg-blue-500/20 border border-blue-400/40'
                      : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <h4 className="text-white text-sm font-medium truncate">{pin.name}</h4>
                  <p className="text-white/60 text-xs">{pin.category}</p>
                  <p className="text-white/40 text-xs">
                    {pin.lat.toFixed(2)}°, {pin.lon.toFixed(2)}°
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Map Area */}
        <div className="flex-1 relative">
          {viewMode === 'tiles' ? (
            /* Tile Viewer Mode - Full NASA TREK tile maps */
            <div className="w-full h-full">
              <TileViewer3 />
            </div>
          ) : (
            /* Simple Map Mode */
            <div ref={mapRef} className="w-full h-full relative overflow-hidden">
              {/* Map Background */}
              <div className={`absolute inset-0 ${
                viewMode === 'satellite' 
                  ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black'
                  : 'bg-gradient-to-br from-amber-900 via-orange-900 to-red-900'
              }`}>
              {/* Surface Texture Overlay */}
              <div className="absolute inset-0 opacity-30">
                <div className="w-full h-full bg-repeat" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M20 20c0-11.046-8.954-20-20-20s-20 8.954-20 20 8.954 20 20 20 20-8.954 20-20z'/%3E%3C/g%3E%3C/svg%3E")`,
                  backgroundSize: '40px 40px'
                }} />
              </div>
              
              {/* Feature Pins */}
              {featurePins.map((pin) => {
                const x = ((pin.lon + 180) / 360) * 100;
                const y = ((90 - pin.lat) / 180) * 100;
                
                return (
                  <button
                    key={pin.id}
                    onClick={() => setSelectedFeature(pin)}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 group"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`
                    }}
                  >
                    <div className={`w-3 h-3 rounded-full border-2 border-white shadow-lg transition-all ${
                      selectedFeature?.id === pin.id
                        ? 'bg-blue-400 scale-150'
                        : 'bg-red-400 group-hover:scale-125'
                    }`} />
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      {pin.name}
                    </div>
                  </button>
                );
              })}

              {/* Grid Lines */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Latitude lines */}
                {Array.from({ length: 9 }, (_, i) => (
                  <div
                    key={`lat-${i}`}
                    className="absolute w-full border-t border-white/10"
                    style={{ top: `${(i * 100) / 8}%` }}
                  />
                ))}
                {/* Longitude lines */}
                {Array.from({ length: 13 }, (_, i) => (
                  <div
                    key={`lon-${i}`}
                    className="absolute h-full border-l border-white/10"
                    style={{ left: `${(i * 100) / 12}%` }}
                  />
                ))}
              </div>

              {/* Coordinate Display */}
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur text-white px-3 py-2 rounded-lg text-sm">
                <div className="flex items-center gap-4">
                  <span>Body: <strong>{selectedBody}</strong></span>
                  <span>View: <strong>{viewMode}</strong></span>
                  <span>Features: <strong>{featurePins.length}</strong></span>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Right Sidebar - Feature Details */}
        {selectedFeature && (
          <div className="w-96 bg-black/80 backdrop-blur-xl border-l border-white/10 flex flex-col">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">{selectedFeature.name}</h2>
                <button
                  onClick={() => setSelectedFeature(null)}
                  className="text-white/60 hover:text-white/80 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-white/60">Category:</span>
                  <span className="text-white ml-2">{selectedFeature.category}</span>
                </div>
                <div>
                  <span className="text-white/60">Location:</span>
                  <span className="text-white ml-2">
                    {selectedFeature.lat.toFixed(4)}°, {selectedFeature.lon.toFixed(4)}°
                  </span>
                </div>
                <div>
                  <span className="text-white/60">Body:</span>
                  <span className="text-white ml-2">{selectedFeature.body}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6">
              {/* Feature Image */}
              <div className="aspect-video rounded-lg overflow-hidden mb-4 bg-white/5">
                <img
                  src={selectedFeature.image}
                  alt={selectedFeature.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Feature Description */}
              <div className="space-y-4">
                <h3 className="text-md font-medium text-white">About this Feature</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  {selectedFeature.name} is a {selectedFeature.category.toLowerCase()} located on {selectedFeature.body}. 
                  This feature represents one of the many geological formations mapped by NASA's planetary exploration missions.
                </p>
                
                <div className="pt-4 border-t border-white/10">
                  <button className="w-full py-2 px-4 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 text-blue-300 rounded-lg transition-all">
                    View High-Resolution Images
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
