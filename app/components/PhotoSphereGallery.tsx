"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Image data with keywords
const imageData = [
  { image: 'https://picsum.photos/256/256?random=1', title: 'Ear (a)', keywords: ['earbuds', 'audio', 'music', 'ear'], color: '#FFD700' },
  { image: 'https://picsum.photos/256/256?random=2', title: 'Product Showcase', keywords: ['product', 'design', 'showcase', 'items'], color: '#FF6B6B' },
  { image: 'https://picsum.photos/256/256?random=3', title: 'Fashion Photo', keywords: ['fashion', 'style', 'photo', 'model'], color: '#4ECDC4' },
  { image: 'https://picsum.photos/256/256?random=4', title: 'NOTHING Device', keywords: ['nothing', 'tech', 'device', 'phone'], color: '#95E1D3' },
  { image: 'https://picsum.photos/256/256?random=5', title: 'Tech Layout', keywords: ['tech', 'layout', 'modern', 'design'], color: '#F38181' },
  { image: 'https://picsum.photos/256/256?random=6', title: 'User Profile', keywords: ['profile', 'user', 'social', 'person'], color: '#AA96DA' },
  { image: 'https://picsum.photos/256/256?random=7', title: 'Audio Interface', keywords: ['audio', 'interface', 'music', 'sound'], color: '#FCBAD3' },
  { image: 'https://picsum.photos/256/256?random=8', title: 'Product Grid', keywords: ['product', 'grid', 'catalog', 'items'], color: '#A8D8EA' },
  { image: 'https://picsum.photos/256/256?random=9', title: 'Lifestyle Shot', keywords: ['lifestyle', 'casual', 'photo'], color: '#FFE66D' },
  { image: 'https://picsum.photos/256/256?random=10', title: 'Minimal Design', keywords: ['minimal', 'clean', 'simple', 'design'], color: '#C7CEEA' }
];

export default function PhotoSphereGallery() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [navHintText, setNavHintText] = useState('Made with ❤️ by Slack Overflow');
  const [isNavHintVisible, setIsNavHintVisible] = useState(false);
  
  const sceneRef = useRef<{
    animationId: number | null;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const RADIUS = 15;
    const COUNT = 50;

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
    let vel = 0;
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

    // Create sprites with images
    for (let i = 0; i < COUNT; i++) {
      const data = imageData[i % imageData.length];
      
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
      setNavHintText('Made with ❤️ by Slack Overflow');

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

    // Mouse interaction handlers
    const handlePointerDown = (e: PointerEvent) => {
      if (isFocused) return;
      isDragging = true;
      prevX = e.clientX;
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      prevX = e.clientX;
      group.rotation.y += dx * 0.005;
      vel = dx * 0.002;
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
          alert(`Viewing: ${picked.userData.title}`);
        }
      }
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

    // Animation loop
    function animate() {
      const id = requestAnimationFrame(animate);
      if (sceneRef.current) {
        sceneRef.current.animationId = id;
      }

      if (!isDragging && !isFocused) {
        group.rotation.y += 0.002 + (vel * 0.01);
        vel *= 0.95;
      }
      
      renderer.render(scene, camera);
    }
    animate();

    // Store references
    sceneRef.current = {
      animationId: null
    };

    // Initial zoom and show hint
    setTimeout(() => {
      setIsNavHintVisible(true);
      
      const start = camera.position.clone();
      const end = new THREE.Vector3(0, 0, 22);

      let t = 0;
      function zoomIntoMiddle() {
        if (t < 1) {
          t += 0.015;
          camera.position.lerpVectors(start, end, t);
          camera.lookAt(0, 0, 0);
          requestAnimationFrame(zoomIntoMiddle);
        }
      }
      zoomIntoMiddle();
    }, 3000);

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
      
      if (sceneRef.current?.animationId) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
      renderer.dispose();
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      
      {/* Navigation hint */}
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
    </div>
  );
}
