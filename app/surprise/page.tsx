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
    
    // Create smooth transition effect
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
      z-index: 9999;
      opacity: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.3s ease-in-out;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      text-align: center;
      color: white;
    `;

    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top: 3px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    `;

    const text = document.createElement('p');
    text.textContent = `Searching for "${query}"...`;
    text.style.cssText = `
      font-size: 1.2rem;
      margin: 0;
      opacity: 0.8;
    `;

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    content.appendChild(spinner);
    content.appendChild(text);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Trigger fade in
    setTimeout(() => {
      overlay.style.opacity = '1';
    }, 10);

    // Navigate after animation
    setTimeout(() => {
      router.push(`/explorer?search=${encodeURIComponent(query)}`);
    }, 800);
  };

  const handleExploreClick = () => {
    // Navigate to explore page
    router.push("/explore");
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

      {/* PhotoSphere Gallery - behind everything */}
      <div className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
        <PhotoSphereGallery showFooter={false} />
      </div>

      {/* Explore More button */}
      <button
        onClick={handleExploreClick}
        className="absolute top-8 right-8 z-30 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/10 hover:border-white/20 backdrop-blur-sm"
      >
        <span>Explore More</span>
      </button>

      {/* Search bar centered in middle of page - above photosphere */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 w-full max-w-2xl px-4">
        <GlassSearchBar
          onSearch={handleSearch}
          value={searchQuery}
          placeholder={"Search planetary features, locations, coordinates..."}
        />
      </div>

      {/* Footer - fixed at bottom with proper z-index */}
      <footer className="absolute bottom-0 left-0 right-0 z-30 py-6 px-4 text-center backdrop-blur-sm">
        <p className="text-white/70 text-sm">
          Made with love by Slack Overflow
        </p>
      </footer>
    </div>
  );
}
