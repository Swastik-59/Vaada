"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface HeroSceneProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function HeroScene({ className, style }: HeroSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // WebGL support check
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
      if (!gl) {
        setWebglSupported(false);
        return;
      }
    } catch {
      setWebglSupported(false);
      return;
    }

    // Motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let isVisible = true;
    let animationFrameId: number;

    // 1. Scene, Camera & Tone
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07080a, 0.04);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 520;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 16.5);

    // 2. Renderer with High Dynamic Range Tone Mapping
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 3. Lighting Architecture (Cinematic Warm Gold & Emerald Lighting)
    const ambientLight = new THREE.AmbientLight(0x0a101d, 1.6);
    scene.add(ambientLight);

    const goldCoreLight = new THREE.PointLight(0xe09f3e, 3.2, 22);
    goldCoreLight.position.set(0, 0, 0);
    scene.add(goldCoreLight);

    const emeraldRimLight = new THREE.PointLight(0x22c997, 2.2, 24);
    emeraldRimLight.position.set(5, 4, 6);
    scene.add(emeraldRimLight);

    const cyanCounterLight = new THREE.PointLight(0x38bdf8, 1.8, 24);
    cyanCounterLight.position.set(-6, -3, 4);
    scene.add(cyanCounterLight);

    // 4. Main Scene Root Graph
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    // ── ASTROLABE GIMBAL RINGS ──────────────────────────────────────
    const ringsGroup = new THREE.Group();
    masterGroup.add(ringsGroup);

    const createGimbalRing = (radius: number, tubeRadius: number, colorHex: number, opacity: number) => {
      const ringGeo = new THREE.TorusGeometry(radius, tubeRadius, 16, 100);
      const ringMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.35,
        roughness: 0.25,
        metalness: 0.85,
        transparent: true,
        opacity: opacity,
      });
      return new THREE.Mesh(ringGeo, ringMat);
    };

    // Outer Primary Ring (Corporate RTGS Rail)
    const outerRing = createGimbalRing(6.2, 0.024, 0xe09f3e, 0.85);
    ringsGroup.add(outerRing);

    // Middle Interlocking Ring (UPI Autopay Rail - Tilted)
    const midRing = createGimbalRing(5.1, 0.022, 0x22c997, 0.75);
    midRing.rotation.x = Math.PI / 3.2;
    midRing.rotation.y = Math.PI / 5;
    ringsGroup.add(midRing);

    // Inner Regulatory Ring (Section 43B(h) MSME Clock)
    const innerRing = createGimbalRing(4.0, 0.018, 0x38bdf8, 0.7);
    innerRing.rotation.x = -Math.PI / 4;
    innerRing.rotation.z = Math.PI / 6;
    ringsGroup.add(innerRing);

    // Radial Tick Notches on Outer Ring (Precision Coordinate Marks)
    const tickMarksGroup = new THREE.Group();
    ringsGroup.add(tickMarksGroup);
    const tickMat = new THREE.LineBasicMaterial({
      color: 0xe09f3e,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const tickGeo = new THREE.BufferGeometry();
    const tickPoints: THREE.Vector3[] = [];
    const tickCount = 48;
    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2;
      const r1 = 6.08;
      const r2 = i % 4 === 0 ? 6.36 : 6.24;
      tickPoints.push(
        new THREE.Vector3(Math.cos(angle) * r1, Math.sin(angle) * r1, 0),
        new THREE.Vector3(Math.cos(angle) * r2, Math.sin(angle) * r2, 0)
      );
    }
    tickGeo.setFromPoints(tickPoints);
    const tickLines = new THREE.LineSegments(tickGeo, tickMat);
    tickMarksGroup.add(tickLines);

    // ── THE QUANTUM LEDGER CORE (POLYHEDRAL VAULT) ─────────────────
    const coreGroup = new THREE.Group();
    masterGroup.add(coreGroup);

    // Outer Wireframe Stellate Icosahedron
    const coreOuterGeo = new THREE.IcosahedronGeometry(1.25, 1);
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: 0xe09f3e,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const coreOuterMesh = new THREE.Mesh(coreOuterGeo, wireframeMat);
    coreGroup.add(coreOuterMesh);

    // Inner Glowing Crystalline Octahedron
    const coreInnerGeo = new THREE.OctahedronGeometry(0.85, 0);
    const coreInnerMat = new THREE.MeshStandardMaterial({
      color: 0x22c997,
      emissive: 0x22c997,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.85,
    });
    const coreInnerMesh = new THREE.Mesh(coreInnerGeo, coreInnerMat);
    coreGroup.add(coreInnerMesh);

    // ── HIGH-SPEED SETTLEMENT PARTICLE RAILS ───────────────────────
    const createRailParticles = (count: number, colorHex: number, radiusX: number, radiusY: number, tiltZ: number) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const phase = new Float32Array(count);
      const speeds = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        phase[i] = (i / count) * Math.PI * 2;
        speeds[i] = 0.007 + Math.random() * 0.012;
        const x = Math.cos(phase[i]) * radiusX;
        const y = Math.sin(phase[i]) * radiusY;
        const z = Math.sin(phase[i] * 2) * 0.8;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
      }

      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

      // Circular glowing particle texture
      const pCanvas = document.createElement("canvas");
      pCanvas.width = 32;
      pCanvas.height = 32;
      const pCtx = pCanvas.getContext("2d");
      if (pCtx) {
        const radGrad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
        radGrad.addColorStop(0, "rgba(255, 255, 255, 1)");
        radGrad.addColorStop(0.25, `rgba(${colorHex >> 16}, ${(colorHex >> 8) & 255}, ${colorHex & 255}, 0.9)`);
        radGrad.addColorStop(0.7, `rgba(${colorHex >> 16}, ${(colorHex >> 8) & 255}, ${colorHex & 255}, 0.2)`);
        radGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        pCtx.fillStyle = radGrad;
        pCtx.fillRect(0, 0, 32, 32);
      }
      const pTexture = new THREE.CanvasTexture(pCanvas);

      const mat = new THREE.PointsMaterial({
        size: 0.26,
        map: pTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const points = new THREE.Points(geo, mat);
      points.rotation.z = tiltZ;
      return { points, geo, phase, speeds, radiusX, radiusY };
    };

    const railGold = createRailParticles(100, 0xe09f3e, 6.2, 4.5, 0.35);
    masterGroup.add(railGold.points);

    const railEmerald = createRailParticles(90, 0x22c997, 5.1, 5.1, -0.6);
    masterGroup.add(railEmerald.points);

    const railCyan = createRailParticles(80, 0x38bdf8, 4.0, 3.2, 1.1);
    masterGroup.add(railCyan.points);

    // ── AMBIENT PARTICLES ──────────────────────────────────────────
    const starCount = 240;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 26;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.07,
      color: 0x8a97af,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // ── SMOOTH POINTER PARALLAX & PHYSICS ──────────────────────────
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const onPointerMove = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      mouseX = (e.clientX - halfW) / halfW;
      mouseY = (e.clientY - halfH) / halfH;
      targetRotationY = mouseX * 0.35;
      targetRotationX = mouseY * 0.22;
    };
    window.addEventListener("mousemove", onPointerMove, { passive: true });

    // Handle Resize
    const onResize = () => {
      if (!container) return;
      const newW = container.clientWidth || window.innerWidth;
      const newH = container.clientHeight || 520;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener("resize", onResize);

    // Intersection Observer to pause when off-screen
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(container);

    // ── ANIMATION LOOP ─────────────────────────────────────────────
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      if (prefersReducedMotion) {
        renderer.render(scene, camera);
        return;
      }

      // Smooth camera dampening with cursor physics
      masterGroup.rotation.y += (targetRotationY - masterGroup.rotation.y) * 0.045;
      masterGroup.rotation.x += (targetRotationX - masterGroup.rotation.x) * 0.045;

      // Differential Planetary Ring Rotation
      outerRing.rotation.z += delta * 0.1;
      midRing.rotation.y += delta * 0.14;
      midRing.rotation.x += delta * 0.06;
      innerRing.rotation.z -= delta * 0.18;
      innerRing.rotation.y += delta * 0.12;
      tickMarksGroup.rotation.z += delta * 0.1;

      // Core Geometric Rotation & Pulse
      coreOuterMesh.rotation.y -= delta * 0.35;
      coreOuterMesh.rotation.x += delta * 0.2;
      coreInnerMesh.rotation.y += delta * 0.45;
      coreInnerMesh.rotation.z -= delta * 0.28;

      const coreBreath = 1 + Math.sin(elapsed * 2.2) * 0.06;
      coreOuterMesh.scale.set(coreBreath, coreBreath, coreBreath);
      coreInnerMesh.scale.set(1 / coreBreath, 1 / coreBreath, 1 / coreBreath);

      // Particle Rails Propagation
      const updateRail = (rail: ReturnType<typeof createRailParticles>, speedMultiplier: number) => {
        const positions = rail.geo.attributes.position.array as Float32Array;
        const count = rail.phase.length;
        for (let i = 0; i < count; i++) {
          rail.phase[i] += rail.speeds[i] * speedMultiplier;
          const angle = rail.phase[i];
          positions[i * 3] = Math.cos(angle) * rail.radiusX;
          positions[i * 3 + 1] = Math.sin(angle) * rail.radiusY;
          positions[i * 3 + 2] = Math.sin(angle * 2) * 0.8;
        }
        rail.geo.attributes.position.needsUpdate = true;
      };

      updateRail(railGold, 1.0);
      updateRail(railEmerald, 1.12);
      updateRail(railCyan, 0.9);

      // Ambient Stellar Rotation
      starPoints.rotation.y = elapsed * 0.012;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("resize", onResize);

      // Clean disposal
      renderer.dispose();
      outerRing.geometry.dispose();
      (outerRing.material as THREE.Material).dispose();
      midRing.geometry.dispose();
      (midRing.material as THREE.Material).dispose();
      innerRing.geometry.dispose();
      (innerRing.material as THREE.Material).dispose();
      tickGeo.dispose();
      tickMat.dispose();
      coreOuterGeo.dispose();
      wireframeMat.dispose();
      coreInnerGeo.dispose();
      coreInnerMat.dispose();
      railGold.geo.dispose();
      (railGold.points.material as THREE.Material).dispose();
      railEmerald.geo.dispose();
      (railEmerald.points.material as THREE.Material).dispose();
      railCyan.geo.dispose();
      (railCyan.points.material as THREE.Material).dispose();
      starGeo.dispose();
      starMat.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "480px",
        overflow: "hidden",
        ...style,
      }}
    >
      {webglSupported ? (
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
          }}
          aria-label="Interactive 3D representation of Vaada's financial recovery rails"
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(ellipse at center, rgba(196, 148, 58, 0.08) 0%, rgba(7, 8, 10, 0.95) 75%)",
          }}
          aria-label="Vaada financial recovery rails graphic"
        >
          <svg width="400" height="400" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.6 }}>
            <circle cx="200" cy="200" r="160" stroke="#c4943a" strokeWidth="1" strokeDasharray="4 8" />
            <circle cx="200" cy="200" r="110" stroke="#22c55e" strokeWidth="1" strokeDasharray="2 4" />
            <circle cx="200" cy="200" r="60" stroke="#38bdf8" strokeWidth="1" />
            <line x1="200" y1="30" x2="200" y2="370" stroke="rgba(255,255,255,0.05)" />
            <line x1="30" y1="200" x2="370" y2="200" stroke="rgba(255,255,255,0.05)" />
          </svg>
        </div>
      )}
    </div>
  );
}
