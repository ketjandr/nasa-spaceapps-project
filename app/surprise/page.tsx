"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import GlassSearchBar from "../components/search_bar";

// Dynamically import PhotoSphereGallery to avoid SSR issues with Three.js
const PhotoSphereGallery = dynamic(
  () => import("../components/PhotoSphereGallery"),
  { ssr: false }
);

export default function SurprisePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    // Get the search query from URL params
    const query = searchParams.get("search");
    if (query) {
      setSearchQuery(query);
    }
  }, [searchParams]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Update URL with new search query
    router.push(`/explorer?search=${encodeURIComponent(query)}`);
  };

  /*************  ✨ Windsurf Command ⭐  *************/
  /**
   * Navigates back to the home page
   */
  /*******  5e16d341-4f0a-4861-8fbe-418d8bc841bd  *******/
  const handleBackToHome = () => {
    router.push("/");
  };

  // Create animated starfield background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Create stars
    const stars: {
      x: number;
      y: number;
      radius: number;
      opacity: number;
      speed: number;
    }[] = [];
    const numStars = 200;

    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5,
        opacity: Math.random(),
        speed: Math.random() * 0.05,
      });
    }

    // Animation loop
    function animate() {
      if (!ctx || !canvas) return;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw stars with twinkling effect
      stars.forEach((star) => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();

        // Twinkling effect
        star.opacity += star.speed;
        if (star.opacity > 1 || star.opacity < 0.2) {
          star.speed = -star.speed;
        }
      });

      requestAnimationFrame(animate);
    }

    animate();

    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden">
      {/* Animated starfield background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: 0 }}
      />

      {/* Back button */}
      <button
        onClick={handleBackToHome}
        className="absolute top-8 left-8 z-20 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/10 hover:border-white/20 backdrop-blur-sm"
      >
        <ArrowLeft size={20} />
        <span>Back to Home</span>
      </button>

      {/* Search bar centered in middle of page */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-full max-w-2xl px-4">
        <GlassSearchBar
          onSearch={handleSearch}
          value={searchQuery}
          placeholder={"Search planetary features, locations, coordinates..."}
        />
      </div>

      {/* PhotoSphere Gallery */}
      <div className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
        <PhotoSphereGallery />
      </div>
    </div>
  );
}
