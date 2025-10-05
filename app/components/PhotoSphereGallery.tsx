"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import JSZip from "jszip";
import * as toGeoJSON from "@mapbox/togeojson";

type DatasetListItem = {
  id: string;
  title: string;
  body?: string | null;
};

type ViewerConfigResponse = {
  id: string;
  title: string;
  tile_url_template: string;
  min_zoom: number;
  max_zoom: number;
  tile_size: number;
  projection?: string | null;
  attribution?: string | null;
  body?: string | null;
};

type ImageData = {
  image: string;
  title: string;
  keywords: string[];
  color: string;
  body?: string;
  coordinates?: { lat: number; lon: number };
  featured?: boolean;
  category?: string;
};

const DEFAULT_IMAGE_DATA: ImageData[] = [
  { image: 'https://picsum.photos/256/256?random=1', title: 'Moonlit Plains', keywords: ['fallback', 'moon'], color: '#FFD700' },
  { image: 'https://picsum.photos/256/256?random=2', title: 'Crater Valley', keywords: ['fallback', 'mars'], color: '#FF6B6B' },
  { image: 'https://picsum.photos/256/256?random=3', title: 'Mercury Ridge', keywords: ['fallback', 'mercury'], color: '#4ECDC4' },
  { image: 'https://picsum.photos/256/256?random=4', title: 'Ceres Dawn', keywords: ['fallback', 'ceres'], color: '#95E1D3' }
];

interface PhotoSphereGalleryProps {
  showFooter?: boolean;
  searchQuery?: string;
}

interface DiscoveryCategory {
  id: string;
  name: string;
  body: string;
  count: number;
  color: string;
  featured: ImageData[];
}

export default function PhotoSphereGallery({ showFooter = false, searchQuery = "" }: PhotoSphereGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [navHintText, setNavHintText] = useState('Made with love by Slack Overflow');
  const [isNavHintVisible, setIsNavHintVisible] = useState(false);
  const [imageData, setImageData] = useState<ImageData[]>(DEFAULT_IMAGE_DATA);
  const [filteredImageData, setFilteredImageData] = useState<ImageData[]>(DEFAULT_IMAGE_DATA);
  
  // Discovery panel state
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [discoveryCategories, setDiscoveryCategories] = useState<DiscoveryCategory[]>([]);
  const [featuredContent, setFeaturedContent] = useState<ImageData[]>([]);
  const [currentFilter, setCurrentFilter] = useState<string>('all');
  const [aiRecommendations, setAiRecommendations] = useState<ImageData[]>([]);
  const [currentInsights, setCurrentInsights] = useState<string>('');
  
  // Interactive discovery state
  const [hoveredFeature, setHoveredFeature] = useState<ImageData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [relatedFeatures, setRelatedFeatures] = useState<ImageData[]>([]);
  const [featureConnections, setFeatureConnections] = useState<Map<string, string[]>>(new Map());
  const [showConnections, setShowConnections] = useState(false);
  const [clusteredFeatures, setClusteredFeatures] = useState<Map<string, ImageData[]>>(new Map());

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing planetary explorer...');
  const hasLoadedOnce = useRef(false); // Track if we've loaded once
  
  const sceneRef = useRef<{
    animationId: number | null;
  } | null>(null);

  // Filter data based on search query
  useEffect(() => {
    if (!searchQuery || searchQuery.trim() === '') {
      setFilteredImageData(imageData);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = imageData.filter(item => {
      return (
        item.title?.toLowerCase().includes(query) ||
        item.keywords?.some(keyword => keyword.toLowerCase().includes(query)) ||
        item.body?.toLowerCase().includes(query)
      );
    });

    console.log(`[SEARCH] Filtered ${imageData.length} items to ${filtered.length} for query: "${searchQuery}"`);
    setFilteredImageData(filtered.length > 0 ? filtered : imageData.slice(0, 10)); // Show first 10 if no matches
  }, [searchQuery, imageData]);

  // Analyze feature relationships and build connections
  const analyzeFeatureRelationships = (data: ImageData[]) => {
    const connections = new Map<string, string[]>();
    const clusters = new Map<string, ImageData[]>();
    
    data.forEach((feature, index) => {
      const relatedIds: string[] = [];
      const featureId = `${feature.title}-${index}`;
      
      // Find features with similar keywords
      const keywordMatches = data.filter((other, otherIndex) => {
        if (otherIndex === index) return false;
        const sharedKeywords = feature.keywords?.filter(k => 
          other.keywords?.includes(k)
        ) || [];
        return sharedKeywords.length >= 2; // At least 2 shared keywords
      });
      
      // Find features from same body
      const sameBodyFeatures = data.filter((other, otherIndex) => 
        otherIndex !== index && other.body === feature.body
      );
      
      // Find features in similar categories
      const categoryMatches = data.filter((other, otherIndex) => {
        if (otherIndex === index) return false;
        const featureType = feature.keywords?.[0] || 'unknown';
        const otherType = other.keywords?.[0] || 'unknown';
        return featureType.toLowerCase() === otherType.toLowerCase();
      });
      
      // Combine all related features
      const allRelated = [...keywordMatches, ...sameBodyFeatures.slice(0, 3), ...categoryMatches.slice(0, 2)];
      const uniqueRelated = Array.from(new Set(allRelated.map(f => `${f.title}-${data.indexOf(f)}`)));
      
      connections.set(featureId, uniqueRelated.slice(0, 5)); // Max 5 connections
      
      // Create clusters by category
      const category = feature.keywords?.[0] || 'Other';
      if (!clusters.has(category)) {
        clusters.set(category, []);
      }
      clusters.get(category)!.push(feature);
    });
    
    setFeatureConnections(connections);
    setClusteredFeatures(clusters);
  };

  // Load AI-powered recommendations
  const loadAIRecommendations = async (data: ImageData[]) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      
      // Extract user interests from current data
      const interests = Array.from(new Set(data.flatMap(item => item.keywords || [])))
        .slice(0, 5); // Top 5 interests
      
      const response = await fetch(`${backendUrl}/search/discover/recommendations?${interests.map(i => `interests=${encodeURIComponent(i)}`).join('&')}&limit=6`);
      
      if (response.ok) {
        const result = await response.json();
        
        // Convert recommendations to ImageData format
        const aiRecs: ImageData[] = result.recommendations.map((rec: any, index: number) => ({
          image: `https://picsum.photos/256/256?random=${Date.now() + index}`, // Placeholder
          title: rec.name || `Discovery ${index + 1}`,
          keywords: rec.keywords || [],
          color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3'][index % 4],
          body: rec.body,
          coordinates: rec.coordinates,
          featured: true
        }));
        
        setAiRecommendations(aiRecs);
      }
    } catch (error) {
      console.log('AI recommendations not available:', error);
    }
  };

  // Get AI insights for a feature
  const loadFeatureInsights = async (featureName: string) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const response = await fetch(`${backendUrl}/search/discover/insights/${encodeURIComponent(featureName)}`);
      
      if (response.ok) {
        const result = await response.json();
        setCurrentInsights(result.insights || '');
      }
    } catch (error) {
      console.log('AI insights not available:', error);
    }
  };

  // Build discovery categories from image data
  const buildDiscoveryCategories = (data: ImageData[]) => {
    const bodyGroups = data.reduce((acc, item) => {
      const body = item.body || 'unknown';
      if (!acc[body]) acc[body] = [];
      acc[body].push(item);
      return acc;
    }, {} as Record<string, ImageData[]>);

    const categories: DiscoveryCategory[] = Object.entries(bodyGroups).map(([body, items]) => ({
      id: body,
      name: body.charAt(0).toUpperCase() + body.slice(1),
      body,
      count: items.length,
      color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3'][Math.floor(Math.random() * 4)],
      featured: items.slice(0, 6) // Top 6 as featured
    }));

    setDiscoveryCategories(categories);
    
    // Set some featured content (mix from all bodies)
    const featured = data
      .filter((_, index) => index % 4 === 0) // Every 4th item
      .slice(0, 8);
    setFeaturedContent(featured);
    
    // Get AI recommendations
    loadAIRecommendations(data);
  };

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    if (!backendUrl) {
      return;
    }

    let cancelled = false;
    const palette = ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8D8EA', '#FFE66D', '#C7CEEA'];

    const fillTemplate = (template: string, z: number, x: number, y: number) =>
      template
        .replace(/{z}/g, String(z))
        .replace(/{x}/g, String(x))
        .replace(/{y}/g, String(y))
        .replace(/{col}/g, String(x))
        .replace(/{row}/g, String(y));

    const randomInt = (min: number, max: number) => {
      if (min === max) return min;
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    async function loadTiles() {
      try {
        const listRes = await fetch(`${backendUrl}/viewer/layers`);
        if (!listRes.ok) {
          throw new Error('Failed to load layer list');
        }

        const layers = (await listRes.json()) as DatasetListItem[];
        if (!layers.length) return;

        // fetch full configs
        const configs = (
          await Promise.all(
            layers.map(async (layer) => {
              try {
                const res = await fetch(`${backendUrl}/viewer/layers/${layer.id}`);
                if (!res.ok) return null;
                const config = (await res.json()) as ViewerConfigResponse;
                return { layer, config };
              } catch (error) {
                console.error('Config fetch failed', error);
                return null;
              }
            })
          )
        ).filter(Boolean) as Array<{ layer: DatasetListItem; config: ViewerConfigResponse }>;

        if (!configs.length) {
          setImageData(DEFAULT_IMAGE_DATA.slice(0, 50));
          return;
        }

        // --- helpers ---
        const kmzProxy = (url: string) => `${backendUrl}/proxy/kmz?url=${encodeURIComponent(url)}`;

        async function fetchGazetteerKMZ(kmzUrl: string) {
          try {
            const r = await fetch(kmzProxy(kmzUrl));
            if (!r.ok) return [];
            const buf = await r.arrayBuffer();
            const zip = await JSZip.loadAsync(buf);
            const kmlName = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith('.kml'));
            if (!kmlName) return [];
            const kmlText = await zip.files[kmlName].async('text');
            const kmlDoc = new DOMParser().parseFromString(kmlText, 'application/xml');
            const gj = (toGeoJSON as any).kml(kmlDoc);
            const pts: Array<{ name: string; lat: number; lon: number }> = [];
            for (const f of gj.features || []) {
              if (f.geometry?.type !== 'Point') continue;
              const [lon, lat] = f.geometry.coordinates || [];
              if (typeof lat !== 'number' || typeof lon !== 'number') continue;
              pts.push({
                name: f.properties?.name || f.properties?.Name || 'unnamed',
                lat,
                lon,
              });
            }
            return pts;
          } catch (e) {
            console.warn('KMZ parse failed', e);
            return [];
          }
        }

        function lonLatToTileXY(lon: number, lat: number, z: number) {
          const cols = Math.max(1, Math.pow(2, z + 1));
          const rows = Math.max(1, Math.pow(2, z));
          let x = Math.floor(((lon + 180) / 360) * cols);
          let y = Math.floor(((90 - lat) / 180) * rows);
          x = ((x % cols) + cols) % cols;
          y = Math.min(Math.max(y, 0), rows - 1);
          return { x, y };
        }

        const palette = ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8D8EA', '#FFE66D', '#C7CEEA'];
        const TILE_COUNT = 50;

        // Index configs by body for easier matching
        const cfgByBody = new Map<string, { layer: DatasetListItem; config: ViewerConfigResponse }[]>();
        for (const item of configs) {
          const key = (item.config.body || item.layer.body || 'unknown').toLowerCase();
          const arr = cfgByBody.get(key) || [];
          arr.push(item);
          cfgByBody.set(key, arr);
        }

        // Load feature sets from multiple bodies for diverse content
        const [moonFeatures, marsFeatures, mercuryFeatures] = await Promise.all([
          fetchGazetteerKMZ('https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz'),
          fetchGazetteerKMZ('https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.kmz'),
          fetchGazetteerKMZ('https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MERCURY_nomenclature_center_pts.kmz'),
        ]);

        // Build images from features using the corresponding body layer configs
        const generated: ImageData[] = [];
        const used = new Set<string>();

        // Equal distribution per body
        const TILES_PER_BODY = Math.floor(TILE_COUNT / 3); // ~16-17 per body

        function pushFromFeatures(bodyKey: string, feats: Array<{ name: string; lat: number; lon: number }>, maxCount: number) {
          const entries = cfgByBody.get(bodyKey);
          if (!entries || !entries.length || !feats.length) return;

          // Prefer a single representative layer for consistency (first one)
          const { layer, config } = entries[0];

          // choose a crisp zoom (max-1) within bounds
          const z = Math.max(config.min_zoom, Math.min(config.max_zoom, config.max_zoom - 1));

          // Shuffle features to get variety
          const shuffledFeats = [...feats].sort(() => Math.random() - 0.5);
          let count = 0;

          // Prioritize named features as-is (already have names), no randoms
          for (const f of shuffledFeats) {
            if (count >= maxCount) break;
            
            const { x, y } = lonLatToTileXY(f.lon, f.lat, z);
            const key = `${config.id ?? layer.id}:${z}:${x}:${y}`;
            if (used.has(key)) continue;
            used.add(key);

            const url = fillTemplate(config.tile_url_template, z, x, y);
            generated.push({
              image: url,
              title: `${f.name} — ${layer.title}`,
              keywords: [bodyKey, layer.title, f.name, 'feature'],
              color: palette[generated.length % palette.length],
              body: bodyKey, // Add body info for discovery
              coordinates: { lat: f.lat, lon: f.lon },
            });
            count++;
          }
        }

        // Load equal amounts from each body
        pushFromFeatures('moon', moonFeatures, TILES_PER_BODY);
        pushFromFeatures('mars', marsFeatures, TILES_PER_BODY);
        pushFromFeatures('mercury', mercuryFeatures, TILES_PER_BODY);

        // If still short, optionally backfill with any remaining layers/tiles at random (keeps demo robust)
        if (generated.length < TILE_COUNT) {
          for (let i = 0; i < 500 && generated.length < TILE_COUNT; i++) {
            const pick = configs[Math.floor(Math.random() * configs.length)];
            const { layer, config } = pick;
            const z = Math.max(config.min_zoom, Math.min(config.max_zoom, config.max_zoom - 1));
            const cols = Math.max(1, Math.pow(2, z + 1));
            const rows = Math.max(1, Math.pow(2, z));
            const x = Math.floor(Math.random() * cols);
            const y = Math.floor(Math.random() * rows);
            const key = `${config.id ?? layer.id}:${z}:${x}:${y}`;
            if (used.has(key)) continue;
            used.add(key);

            const url = fillTemplate(config.tile_url_template, z, x, y);
            generated.push({
              image: url,
              title: `${layer.title} (z${z})`,
              keywords: [layer.body ?? layer.id, layer.title],
              color: palette[generated.length % palette.length],
            });
          }
        }

        if (!cancelled && generated.length) {
          const finalData = generated.slice(0, TILE_COUNT);
          setImageData(finalData);
          
          // Build discovery categories from loaded data
          buildDiscoveryCategories(finalData);
          
          // Analyze feature relationships for interactive discovery
          analyzeFeatureRelationships(finalData);
        }
      } catch (error) {
        console.error('Falling back to default imagery', error);
        if (!cancelled) {
          setImageData(DEFAULT_IMAGE_DATA.slice(0, 50));
        }
      }
    }

    loadTiles();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !filteredImageData || filteredImageData.length === 0) return;

    // Reset loading state when data changes (only if first time)
    if (!hasLoadedOnce.current) {
      setIsLoading(true);
      setLoadingProgress(0);
      setLoadingMessage('Initializing planetary explorer...');
    }

    const container = containerRef.current;
    const RADIUS = 15;
    const tiles = filteredImageData.slice(0, 50);
    const COUNT = tiles.length;

    // Scene setup
    const scene = new THREE.Scene();
    // Transparent background to show the starfield
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 40;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true // Enable transparency
    });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const ambient = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambient);

    const sprites: THREE.Sprite[] = [];
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let vel = 0;
    let velY = 0;
    let isFocused = false;

    // Scattered sphere distribution
    function scatteredSpherePoints(N: number) {
      const points: THREE.Vector3[] = [];
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      
      for (let i = 0; i < N; i++) {
        const offset = (Math.random() - 0.5) * 0.3;
        const y = 1 - (i / (N - 1)) * 2 + offset;
        const radiusAtY = Math.sqrt(1 - y * y);
        const theta = i * goldenAngle + (Math.random() - 0.5) * 0.5;
        const x = Math.cos(theta) * radiusAtY;
        const z = Math.sin(theta) * radiusAtY;
        points.push(new THREE.Vector3(x, y, z));
      }
      return points;
    }

    const positions = scatteredSpherePoints(COUNT);
    const textureLoader = new THREE.TextureLoader();

    // Loading progress tracking - count actual loaded textures
    let loadedImages = 0;
    let totalImages = COUNT;
    let actuallyLoadedTextures = 0; // Track textures that have finished loading
    
    const updateLoadingProgress = () => {
      const progress = (actuallyLoadedTextures / totalImages) * 100;
      setLoadingProgress(progress);
      
      if (progress < 30) {
        setLoadingMessage('Loading planetary features...');
      } else if (progress < 60) {
        setLoadingMessage('Rendering 3D sphere...');
      } else if (progress < 90) {
        setLoadingMessage('Finalizing experience...');
      } else {
        setLoadingMessage('Almost ready!');
      }
      
      if (actuallyLoadedTextures >= totalImages) {
        setTimeout(() => {
          setIsLoading(false);
          hasLoadedOnce.current = true; // Mark as loaded once
        }, 500); // Small delay for smooth transition
      }
    };

    // Create sprites with images
    for (let i = 0; i < COUNT; i++) {
      const data = tiles[i % tiles.length];
      
      textureLoader.load(
        data.image,
        (texture) => {
          const mat = new THREE.SpriteMaterial({ map: texture });
          const sprite = new THREE.Sprite(mat);
          
          const sizeVariation = 2.5 + Math.random() * 1;
          sprite.scale.set(sizeVariation, sizeVariation, 1);
          
          const p = positions[i].clone().multiplyScalar(RADIUS);
          sprite.position.copy(p);
          
          sprite.userData = { 
            index: i, 
            title: data.title,
            keywords: data.keywords,
            color: data.color,
            originalScale: sizeVariation
          };
          
          group.add(sprite);
          sprites.push(sprite);
          
          // Update loading progress - texture actually loaded
          actuallyLoadedTextures++;
          updateLoadingProgress();
        },
        undefined,
        () => {
          // Fallback if image fails
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 256, 256);
            ctx.fillStyle = data.color;
            ctx.fillRect(0, 0, 256, 60);
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(data.title, 128, 140);
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, 256, 256);
          }
          
          const texture = new THREE.CanvasTexture(canvas);
          const mat = new THREE.SpriteMaterial({ map: texture });
          const sprite = new THREE.Sprite(mat);
          
          const sizeVariation = 2.5 + Math.random() * 1;
          sprite.scale.set(sizeVariation, sizeVariation, 1);
          
          const p = positions[i].clone().multiplyScalar(RADIUS);
          sprite.position.copy(p);
          
          sprite.userData = { 
            index: i, 
            title: data.title,
            keywords: data.keywords,
            color: data.color,
            originalScale: sizeVariation
          };
          
          group.add(sprite);
          sprites.push(sprite);
          
          // Update loading progress even for fallback images - texture loaded
          actuallyLoadedTextures++;
          updateLoadingProgress();
        }
      );
    }

    // Focus on image function
    function focusOnImage(sprite: THREE.Sprite) {
      isFocused = true;
      setNavHintText('Single-click to go back');

      sprites.forEach(s => {
        if (s !== sprite) {
          s.material.opacity = 0.15;
          s.material.transparent = true;
        } else {
          s.material.opacity = 1;
          s.scale.set(5, 5, 1);
        }
      });

      const target = new THREE.Vector3();
      sprite.getWorldPosition(target);
      
      const start = camera.position.clone();
      const direction = target.clone().normalize();
      const end = target.clone().add(direction.multiplyScalar(8));

      let t = 0;
      function zoomAnim() {
        if (t < 1) {
          t += 0.02;
          camera.position.lerpVectors(start, end, t);
          camera.lookAt(target);
          requestAnimationFrame(zoomAnim);
        }
      }
      zoomAnim();
    }

    // Reset focus function
    function resetFocus() {
      isFocused = false;
      setNavHintText('Made with love by Slack Overflow');

      sprites.forEach(s => {
        s.material.opacity = 1;
        s.material.transparent = false;
        const originalScale = s.userData.originalScale || 3;
        s.scale.set(originalScale, originalScale, 1);
      });

      const start = camera.position.clone();
      const end = new THREE.Vector3(0, 0, 22);

      let t = 0;
      function resetAnim() {
        if (t < 1) {
          t += 0.02;
          camera.position.lerpVectors(start, end, t);
          camera.lookAt(0, 0, 0);
          requestAnimationFrame(resetAnim);
        }
      }
      resetAnim();
    }

    // Hover state tracking
    let hoveredSprite: THREE.Sprite | null = null;
    let baseRotationSpeed = 0.002;
    let currentRotationSpeed = baseRotationSpeed;

    // Mouse interaction handlers
    const handlePointerDown = (e: PointerEvent) => {
      if (isFocused) return;
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging && !isFocused) {
        // Check for hover interactions when not dragging
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(group.children, true);
        
        // Handle hover effects
        if (intersects.length > 0) {
          const newHovered = intersects[0].object as THREE.Sprite;
          if (newHovered !== hoveredSprite) {
            // Reset previous hovered sprite
            if (hoveredSprite) {
              const originalScale = hoveredSprite.userData.originalScale || 3;
              hoveredSprite.scale.set(originalScale, originalScale, 1);
              hoveredSprite.material.opacity = 1;
            }
            
            // Set new hovered sprite
            hoveredSprite = newHovered;
            if (hoveredSprite) {
              const originalScale = hoveredSprite.userData.originalScale || 3;
              hoveredSprite.scale.set(originalScale * 1.2, originalScale * 1.2, 1);
              hoveredSprite.material.opacity = 0.8;
              // Slow down rotation when hovering
              currentRotationSpeed = baseRotationSpeed * 0.3;
              
              // Show interactive tooltip
              const spriteData = tiles[hoveredSprite.userData.index % tiles.length];
              setHoveredFeature(spriteData);
              setTooltipPosition({ x: e.clientX, y: e.clientY });
              
              // Find related features
              const featureId = `${spriteData.title}-${hoveredSprite.userData.index}`;
              const connections = featureConnections.get(featureId) || [];
              const related = connections.map(connId => {
                const [title] = connId.split('-');
                return tiles.find(t => t.title === title);
              }).filter(Boolean) as ImageData[];
              setRelatedFeatures(related.slice(0, 3)); // Show top 3 related
              
              // Load AI insights for this feature
              loadFeatureInsights(spriteData.title);
            }
          }
        } else {
          // No hover, reset effects
          if (hoveredSprite) {
            const originalScale = hoveredSprite.userData.originalScale || 3;
            hoveredSprite.scale.set(originalScale, originalScale, 1);
            hoveredSprite.material.opacity = 1;
            hoveredSprite = null;
            currentRotationSpeed = baseRotationSpeed;
            
            // Hide tooltip
            setHoveredFeature(null);
            setTooltipPosition(null);
            setRelatedFeatures([]);
          }
        }
        return;
      }
      
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;
      
      // Rotate horizontally
      group.rotation.y += dx * 0.005;
      vel = dx * 0.002;
      
      // Rotate vertically with constraints to prevent flipping
      group.rotation.x += dy * 0.005;
      group.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, group.rotation.x));
      velY = dy * 0.002;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // Zoom in/out with mouse wheel
      const zoomSpeed = 0.1;
      const delta = e.deltaY > 0 ? zoomSpeed : -zoomSpeed;
      
      camera.position.z += delta;
      
      // Constrain zoom limits
      camera.position.z = Math.max(10, Math.min(50, camera.position.z));
    };

    const handleClick = (ev: MouseEvent) => {
      if (isFocused) {
        resetFocus();
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(group.children, true);
      if (intersects.length > 0) {
        const picked = intersects[0].object as THREE.Sprite;
        if (picked.userData && picked.userData.title) {
          // Open tile viewer with the selected image
          const imageUrl = (imageData[picked.userData.index] || {}).image;
          if (imageUrl) {
            // Create a modal or navigate to tile viewer
            // For now, let's create a simple modal
            openTileViewer(picked.userData.title, imageUrl);
          }
        }
      }
    };

    // Function to open tile viewer (simplified modal implementation)
    const openTileViewer = (title: string, imageUrl: string) => {
      // Create modal overlay
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(10px);
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 20px;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, 0.2);
      `;

      const image = document.createElement('img');
      image.src = imageUrl;
      image.style.cssText = `
        max-width: 100%;
        max-height: 70vh;
        border-radius: 10px;
        margin-bottom: 15px;
      `;

      const titleElement = document.createElement('h3');
      titleElement.textContent = title;
      titleElement.style.cssText = `
        color: white;
        margin: 0 0 15px 0;
        font-size: 1.5rem;
      `;

      const closeButton = document.createElement('button');
      closeButton.textContent = 'Close';
      closeButton.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 10px 20px;
        border-radius: 25px;
        cursor: pointer;
        font-size: 1rem;
      `;

      closeButton.onclick = () => document.body.removeChild(modal);
      modal.onclick = (e) => {
        if (e.target === modal) document.body.removeChild(modal);
      };

      content.appendChild(titleElement);
      content.appendChild(image);
      content.appendChild(closeButton);
      modal.appendChild(content);
      document.body.appendChild(modal);
    };

    const handleDoubleClick = (ev: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(group.children, true);
      if (intersects.length > 0) {
        const picked = intersects[0].object as THREE.Sprite;
        if (picked.userData && picked.userData.title) {
          focusOnImage(picked);
        }
      }
    };

    // Add event listeners
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('dblclick', handleDoubleClick);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });

    // Animation loop
    function animate() {
      const id = requestAnimationFrame(animate);
      if (sceneRef.current) {
        sceneRef.current.animationId = id;
      }

      if (!isDragging && !isFocused) {
        group.rotation.y += currentRotationSpeed + (vel * 0.01);
        vel *= 0.95;
        
        // Apply vertical velocity decay
        group.rotation.x += velY * 0.01;
        group.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, group.rotation.x));
        velY *= 0.95;
      }
      
      renderer.render(scene, camera);
    }
    animate();

    // Store references
    sceneRef.current = {
      animationId: null
    };

    // Set camera to final position immediately - no animation
    camera.position.z = 22;
    camera.lookAt(0, 0, 0);
    
    // Show hint immediately
    setTimeout(() => {
      setIsNavHintVisible(true);
    }, 1000);

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('dblclick', handleDoubleClick);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      
      if (sceneRef.current?.animationId) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
      renderer.dispose();
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [filteredImageData]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 z-50 flex items-center justify-center">
          <div className="text-center text-white max-w-md mx-auto px-6">
            {/* Logo/Title */}
            <div className="mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Planetary Explorer
              </h2>
              <p className="text-sm text-white/60 mt-2">NASA Space Apps Challenge</p>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="w-full bg-white/10 rounded-full h-2 backdrop-blur">
                <div 
                  className="bg-gradient-to-r from-blue-400 to-purple-500 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-white/60 mt-2">
                <span>{Math.round(loadingProgress)}%</span>
                <span>Loading Assets</span>
              </div>
            </div>

            {/* Loading Message */}
            <p className="text-sm text-white/80 mb-8">{loadingMessage}</p>

            {/* Loading Animation */}
            <div className="flex justify-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"></div>
            </div>

            {/* Features Preview */}
            <div className="mt-8 text-xs text-white/50">
              <p>+ Interactive 3D exploration</p>
              <p>+ Instant search & discovery</p>
              <p>+ AI-powered insights</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Discovery Toggle Button */}
      <button
        onClick={() => setShowDiscovery(!showDiscovery)}
        className="absolute top-8 left-8 z-40 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-xl text-white rounded-full border border-white/20 hover:border-white/40 transition-all"
      >
        <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full"></div>
        <span className="text-sm font-medium">Discover</span>
      </button>

      {/* Discovery Panel */}
      <div className={`
        absolute top-0 left-0 h-full w-96 bg-black/80 backdrop-blur-xl border-r border-white/10 z-30
        transform transition-transform duration-300 ease-out
        ${showDiscovery ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 h-full overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Discover NASA Datasets</h2>
            <button
              onClick={() => setShowDiscovery(false)}
              className="text-white/60 hover:text-white/80 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* AI Recommendations */}
          {aiRecommendations.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full animate-pulse"></div>
                <h3 className="text-lg font-semibold text-white">AI Recommended</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {aiRecommendations.slice(0, 4).map((item, index) => (
                  <div
                    key={`ai-${index}`}
                    className="relative group cursor-pointer rounded-lg overflow-hidden bg-gradient-to-br from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 transition-all border border-blue-400/20"
                    onClick={async () => {
                      await loadFeatureInsights(item.title);
                      setShowDiscovery(false);
                    }}
                  >
                    <div className="aspect-square bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                      <div className="p-3 text-white">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-blue-300 capitalize">{item.body}</p>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 bg-gradient-to-r from-blue-400 to-purple-500 text-white text-xs px-2 py-1 rounded-full opacity-90">
                      AI
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Featured Section */}
          {featuredContent.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Featured Discoveries</h3>
              <div className="grid grid-cols-2 gap-3">
                {featuredContent.slice(0, 4).map((item, index) => (
                  <div
                    key={index}
                    className="relative group cursor-pointer rounded-lg overflow-hidden bg-gray-800/50 hover:bg-gray-700/50 transition-all"
                    onClick={async () => {
                      await loadFeatureInsights(item.title);
                      setShowDiscovery(false);
                    }}
                  >
                    <div className="aspect-square bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                      <div className="p-3 text-white">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-white/70 capitalize">{item.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Explore by Location</h3>
            <div className="space-y-3">
              {discoveryCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 hover:bg-gray-700/50 cursor-pointer transition-all border border-white/5 hover:border-white/20"
                  onClick={() => {
                    setCurrentFilter(category.body);
                    // TODO: Filter sphere to show only this body
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    ></div>
                    <div>
                      <p className="text-white font-medium">{category.name}</p>
                      <p className="text-white/60 text-sm">{category.count} features</p>
                    </div>
                  </div>
                  <div className="text-white/40">→</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights */}
          {currentInsights && (
            <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-blue-400/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full"></div>
                <h4 className="text-white font-medium">AI Insights</h4>
              </div>
              <p className="text-sm text-white/80 leading-relaxed">{currentInsights}</p>
            </div>
          )}

          {/* Smart Navigation */}
          {relatedFeatures.length > 0 && (
            <div className="mb-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-4 border border-purple-400/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full"></div>
                <h4 className="text-white font-medium">Smart Navigation</h4>
              </div>
              <p className="text-xs text-white/60 mb-3">
                Based on your current exploration, here are related features:
              </p>
              <div className="grid grid-cols-3 gap-2">
                {relatedFeatures.map((feature, idx) => (
                  <div key={idx} className="group cursor-pointer">
                    <div className="aspect-square rounded-lg overflow-hidden mb-1">
                      <img 
                        src={feature.image} 
                        alt={feature.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                    </div>
                    <p className="text-xs text-white/70 truncate group-hover:text-white transition-colors">
                      {feature.title}
                    </p>
                    <p className="text-xs text-purple-300">{feature.body}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowConnections(true)}
                className="w-full mt-3 py-2 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors border border-purple-400/20"
              >
                View Full Network
              </button>
            </div>
          )}

          {/* Feature Clusters Quick Access */}
          {clusteredFeatures.size > 0 && (
            <div className="mb-6 bg-gradient-to-r from-green-500/10 to-teal-500/10 rounded-lg p-4 border border-green-400/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-teal-500 rounded-full"></div>
                <h4 className="text-white font-medium">Feature Clusters</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Array.from(clusteredFeatures.entries()).slice(0, 4).map(([category, features]) => (
                  <div 
                    key={category}
                    className="p-2 bg-white/5 rounded border border-white/10 hover:border-green-400/30 cursor-pointer transition-all group"
                    onClick={() => {
                      // TODO: Navigate to cluster
                      console.log('Navigate to cluster:', category);
                    }}
                  >
                    <div className="text-xs font-medium text-white group-hover:text-green-300 truncate">
                      {category}
                    </div>
                    <div className="text-xs text-white/60">{features.length} features</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowConnections(true)}
                className="w-full mt-3 py-2 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors border border-green-400/20"
              >
                Explore All Clusters
              </button>
            </div>
          )}

          {/* Quick Stats */}
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-white/10">
            <h4 className="text-white font-medium mb-2">Dataset Overview</h4>
            <div className="space-y-1 text-sm text-white/70">
              <p>Total Features: {imageData.length}</p>
              <p>Bodies: {discoveryCategories.length}</p>
              <p>Resolution: Gigapixel Scale</p>
              <p>AI-Powered: Discovery & Insights</p>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Feature Tooltip */}
      {hoveredFeature && tooltipPosition && (
        <div 
          className="fixed z-50 bg-black/90 backdrop-blur-xl text-white p-4 rounded-lg border border-white/20 max-w-sm shadow-2xl"
          style={{
            left: tooltipPosition.x + 15,
            top: tooltipPosition.y - 10,
            transform: tooltipPosition.x > window.innerWidth - 300 ? 'translateX(-100%)' : 'none'
          }}
        >
          {/* Feature Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
              <img 
                src={hoveredFeature.image} 
                alt={hoveredFeature.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{hoveredFeature.title}</h3>
              <p className="text-xs text-white/60">{hoveredFeature.body}</p>
              {hoveredFeature.keywords && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {hoveredFeature.keywords.slice(0, 2).map((keyword, idx) => (
                    <span key={idx} className="text-xs px-2 py-0.5 bg-white/10 rounded-full">
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI Insights */}
          {currentInsights && (
            <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs">
              <div className="flex items-center gap-1 mb-1">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                <span className="text-blue-300 font-medium">AI Insight</span>
              </div>
              <p className="text-white/80 leading-relaxed">{currentInsights}</p>
            </div>
          )}

          {/* Related Features */}
          {relatedFeatures.length > 0 && (
            <div className="border-t border-white/10 pt-3">
              <h4 className="text-xs font-medium text-white/60 mb-2">Related Features</h4>
              <div className="flex gap-2">
                {relatedFeatures.map((related, idx) => (
                  <div key={idx} className="flex-1 min-w-0">
                    <div className="w-8 h-8 rounded overflow-hidden mb-1">
                      <img 
                        src={related.image} 
                        alt={related.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-white/70 truncate">{related.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Actions */}
          <div className="flex gap-2 mt-3 pt-2 border-t border-white/10">
            <button 
              className="flex-1 text-xs py-1.5 px-2 bg-white/10 hover:bg-white/20 rounded transition-colors"
              onClick={() => {
                setShowConnections(true);
                // TODO: Highlight connected features in 3D space
              }}
            >
              Show Connections
            </button>
            <button 
              className="flex-1 text-xs py-1.5 px-2 bg-blue-500/20 hover:bg-blue-500/30 rounded transition-colors"
              onClick={() => {
                // TODO: Navigate to feature cluster
                console.log('Navigate to cluster for:', hoveredFeature.keywords?.[0]);
              }}
            >
              Explore Similar
            </button>
          </div>
        </div>
      )}

      {/* Feature Connections Overlay */}
      {showConnections && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-8">
          <div className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Feature Network & Clusters</h2>
              <button
                onClick={() => setShowConnections(false)}
                className="text-white/60 hover:text-white/80 transition-colors text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Cluster Visualization */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {Array.from(clusteredFeatures.entries()).map(([category, features]) => (
                <div key={category} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500"></div>
                    {category}
                    <span className="text-sm text-white/60">({features.length})</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {features.slice(0, 6).map((feature, idx) => (
                      <div key={idx} className="aspect-square rounded overflow-hidden">
                        <img 
                          src={feature.image} 
                          alt={feature.title}
                          className="w-full h-full object-cover hover:scale-110 transition-transform cursor-pointer"
                          title={feature.title}
                        />
                      </div>
                    ))}
                  </div>
                  {features.length > 6 && (
                    <p className="text-xs text-white/60 mt-2">
                      +{features.length - 6} more features in this cluster
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Connection Map Visualization */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h3 className="font-semibold text-white mb-3">Feature Relationships</h3>
              <div className="text-sm text-white/70">
                <p className="mb-2">
                  <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                  Related by keywords and categories
                </p>
                <p className="mb-2">
                  <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  Same planetary body
                </p>
                <p>
                  <span className="inline-block w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                  Similar feature types
                </p>
              </div>
              
              {/* Connection Stats */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{featureConnections.size}</div>
                  <div className="text-xs text-white/60">Connected Features</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{clusteredFeatures.size}</div>
                  <div className="text-xs text-white/60">Feature Clusters</div>
                </div>
              </div>
            </div>

            <div className="flex justify-center mt-6">
              <button
                onClick={() => setShowConnections(false)}
                className="px-6 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors"
              >
                Close Network View
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Navigation hint - only show if showFooter is true */}
      {showFooter && (
        <div 
          className={`
            fixed bottom-10 left-1/2 -translate-x-1/2
            text-white-400 text-sm z-10
            transition-opacity duration-500
            ${isNavHintVisible ? 'opacity-100' : 'opacity-0'}
          `}
        >
          {navHintText}
        </div>
      )}
    </div>
  );
}
