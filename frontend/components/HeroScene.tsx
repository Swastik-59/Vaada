"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function HeroScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect WebGL support
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
      if (!gl) return;
    } catch {
      return;
    }

    let isVisible = true;
    let animationFrameId: number;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07080a, 0.045);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 600;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 14);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Clear previous children
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 3. Financial Network Nodes (Institutions / Rails / Clocks)
    const nodeCount = 36;
    const nodePositions: THREE.Vector3[] = [];
    const group = new THREE.Group();
    scene.add(group);

    // Golden / Copper amber and emerald materials
    const amberMaterial = new THREE.MeshBasicMaterial({
      color: 0xe09f3e,
      wireframe: false,
    });
    const emeraldMaterial = new THREE.MeshBasicMaterial({
      color: 0x22c997,
      wireframe: false,
    });
    const slateMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a5568,
      wireframe: false,
    });

    const sphereGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const largeSphereGeo = new THREE.SphereGeometry(0.22, 16, 16);

    for (let i = 0; i < nodeCount; i++) {
      // Distribute nodes in a toroidal/elliptical cloud
      const theta = (i / nodeCount) * Math.PI * 2;
      const radius = 4.2 + (Math.sin(i * 3.5) * 1.5);
      const x = Math.cos(theta) * radius;
      const y = (Math.sin(theta * 2.2) * 1.8) + (Math.cos(i * 1.7) * 0.8);
      const z = (Math.sin(theta) * radius * 0.7) - 2;

      const pos = new THREE.Vector3(x, y, z);
      nodePositions.push(pos);

      // Major hub nodes
      const isMajor = i % 5 === 0;
      const mesh = new THREE.Mesh(
        isMajor ? largeSphereGeo : sphereGeo,
        isMajor ? (i % 2 === 0 ? amberMaterial : emeraldMaterial) : slateMaterial
      );
      mesh.position.copy(pos);
      group.add(mesh);
    }

    // 4. Rail Interconnections (Lines)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xe09f3e,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
    });

    const linePoints: THREE.Vector3[] = [];
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dist = nodePositions[i].distanceTo(nodePositions[j]);
        if (dist < 2.8) {
          linePoints.push(nodePositions[i]);
          linePoints.push(nodePositions[j]);
        }
      }
    }

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const networkLines = new THREE.LineSegments(lineGeometry, lineMaterial);
    group.add(networkLines);

    // 5. Floating Remittance Particle Swarm (Transactions in Flight)
    const particleCount = 180;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePosArray = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      particlePosArray[idx] = (Math.random() - 0.5) * 14;
      particlePosArray[idx + 1] = (Math.random() - 0.5) * 7;
      particlePosArray[idx + 2] = (Math.random() - 0.5) * 8;
      particleSpeeds[i] = 0.005 + Math.random() * 0.015;
    }

    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePosArray, 3));

    // Particle texture
    const pCanvas = document.createElement("canvas");
    pCanvas.width = 16;
    pCanvas.height = 16;
    const pCtx = pCanvas.getContext("2d");
    if (pCtx) {
      const grad = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, "rgba(224, 159, 62, 1)");
      grad.addColorStop(0.5, "rgba(224, 159, 62, 0.4)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 16, 16);
    }
    const particleTexture = new THREE.CanvasTexture(pCanvas);

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.18,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    group.add(particles);

    // 6. Subtle Mouse Interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const onMouseMove = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      mouseX = (e.clientX - halfW) / halfW;
      mouseY = (e.clientY - halfH) / halfH;
      targetRotationY = mouseX * 0.35;
      targetRotationX = mouseY * 0.2;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // 7. Handle Resize
    const onResize = () => {
      if (!container) return;
      const newW = container.clientWidth || window.innerWidth;
      const newH = container.clientHeight || 600;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener("resize", onResize);

    // 8. Intersection Observer to pause when scrolled out of view
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(container);

    // 9. Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth group rotation with mouse dampening
      group.rotation.y += (targetRotationY - group.rotation.y) * 0.04;
      group.rotation.x += (targetRotationX - group.rotation.x) * 0.04;
      group.rotation.y += delta * 0.05; // continuous idle orbit

      // Gentle floating oscillation
      group.position.y = Math.sin(elapsed * 0.8) * 0.15;

      // Animate particles along flow
      const positions = particleGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;
        positions[idx] += particleSpeeds[i];
        if (positions[idx] > 7) {
          positions[idx] = -7;
        }
      }
      particleGeometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      lineGeometry.dispose();
      sphereGeo.dispose();
      largeSphereGeo.dispose();
      particleGeometry.dispose();
      amberMaterial.dispose();
      emeraldMaterial.dispose();
      slateMaterial.dispose();
      lineMaterial.dispose();
      particleMaterial.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
        opacity: 0.85,
        overflow: "hidden",
      }}
      aria-hidden="true"
    />
  );
}
