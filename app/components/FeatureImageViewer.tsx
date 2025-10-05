"use client";

import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Calendar } from 'lucide-react';

interface FeatureImage {
  source: string;
  title: string;
  description: string;
  date: string;
  preview_url: string;
  full_url: string;
  nasa_id?: string;
  zoom_level?: number;
  lat?: number;
  lon?: number;
}

interface ImageData {
  feature_name: string;
  target_body: string;
  location: { lat: number; lon: number };
  total_images: number;
  images: FeatureImage[];
  sources: string[];
}

interface FeatureImageViewerProps {
  featureId: number;
  featureName: string;
  targetBody: string;
  latitude: number;
  longitude: number;
  onClose: () => void;
  backendUrl?: string;
}

export default function FeatureImageViewer({
  featureId,
  featureName,
  targetBody,
  latitude,
  longitude,
  onClose,
  backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
}: FeatureImageViewerProps) {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showTimeline, setShowTimeline] = useState(true);

  useEffect(() => {
    fetchImages();
  }, [featureId]);

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${backendUrl}/features/${featureId}/images`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }
      
      const data = await response.json();
      setImageData(data);
      
      if (data.images.length === 0) {
        setError('No images found for this feature');
      }
    } catch (err) {
      console.error('Error fetching images:', err);
      setError('Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const currentImage = imageData?.images[currentImageIndex];

  const nextImage = () => {
    if (imageData && currentImageIndex < imageData.images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
      setZoom(1);
    }
  };

  const prevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
      setZoom(1);
    }
  };

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.25, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.25, 0.5));

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      <div className="relative w-full h-full max-w-7xl max-h-screen p-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 text-white">
          <div>
            <h2 className="text-2xl font-bold">{featureName}</h2>
            <p className="text-sm text-white/70">
              {targetBody} • {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition"
            title="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Main Image Area */}
        <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-xl">Loading images...</div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-red-400 text-xl">{error}</div>
            </div>
          )}

          {!loading && !error && currentImage && (
            <>
              {/* Image Display */}
              <div className="w-full h-full flex items-center justify-center overflow-auto">
                <img
                  src={currentImage.full_url}
                  alt={currentImage.title}
                  className="max-w-full max-h-full object-contain transition-transform duration-200"
                  style={{ transform: `scale(${zoom})` }}
                  onError={(e) => {
                    // Fallback to preview if full image fails
                    const img = e.target as HTMLImageElement;
                    if (img.src !== currentImage.preview_url) {
                      img.src = currentImage.preview_url;
                    }
                  }}
                />
              </div>

              {/* Navigation Controls */}
              {imageData && imageData.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    disabled={currentImageIndex === 0}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft size={32} />
                  </button>
                  <button
                    onClick={nextImage}
                    disabled={currentImageIndex === imageData.images.length - 1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight size={32} />
                  </button>
                </>
              )}

              {/* Zoom Controls */}
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button
                  onClick={handleZoomOut}
                  className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition"
                  title="Zoom out"
                >
                  <ZoomOut size={20} />
                </button>
                <div className="px-3 py-2 bg-black/50 text-white rounded-lg text-sm">
                  {Math.round(zoom * 100)}%
                </div>
                <button
                  onClick={handleZoomIn}
                  className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition"
                  title="Zoom in"
                >
                  <ZoomIn size={20} />
                </button>
              </div>

              {/* Image Info */}
              <div className="absolute bottom-4 left-4 bg-black/70 text-white p-3 rounded-lg max-w-md">
                <div className="font-semibold">{currentImage.title}</div>
                <div className="text-xs text-white/70 mt-1">{currentImage.source}</div>
                {currentImage.date && (
                  <div className="text-xs text-white/70 mt-1 flex items-center gap-1">
                    <Calendar size={12} />
                    {currentImage.date}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Timeline */}
        {showTimeline && imageData && imageData.images.length > 1 && (
          <div className="mt-4 bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">
                Timeline ({imageData.total_images} images)
              </h3>
              <div className="text-white/60 text-sm">
                {imageData.sources.join(', ')}
              </div>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2">
              {imageData.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentImageIndex(idx);
                    setZoom(1);
                  }}
                  className={`
                    relative flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden border-2 transition
                    ${idx === currentImageIndex 
                      ? 'border-blue-500 ring-2 ring-blue-500/50' 
                      : 'border-white/20 hover:border-white/40'
                    }
                  `}
                >
                  <img
                    src={img.preview_url}
                    alt={img.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
                    {img.zoom_level ? `Zoom ${img.zoom_level}` : img.date}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer Controls */}
        <div className="mt-4 flex justify-between items-center text-white/60 text-sm">
          <div>
            {imageData && `Image ${currentImageIndex + 1} of ${imageData.images.length}`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition"
            >
              {showTimeline ? 'Hide' : 'Show'} Timeline
            </button>
            {currentImage && (
              <a
                href={currentImage.full_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition flex items-center gap-1"
              >
                <Download size={16} />
                Download
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
