import { AspectRatio, Separator, Toolbar } from 'radix-ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Check, Hand, RotateCcw, RotateCw } from 'lucide-react';
import {
  Axis3D,
  Spatial3DStageNumber,
  Voxel,
  getSpatial3DStage,
  rotateVoxels,
  voxelsMatch,
} from '../game/memorySpatial';
import { cosmicSound } from '../game/sound';
import {
  applyRoomEnvironment,
  colorFromOklch,
  createCosmicRenderer,
  createCrystalGlowTexture,
  detectSoftwareWebGL,
  disposeThreeHierarchy,
  isWebGLAvailable,
  startPacedThreeLoop,
} from '../game/threeUtils';
import { AgeGroup } from '../game/types';

// Reusable module-scope helpers for animation interpolation
const _identityQuat = new THREE.Quaternion();
const _axisVec = new THREE.Vector3();

function computeCenteredPositions(voxels: Voxel[]) {
  if (voxels.length === 0) return [];
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const v of voxels) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  return voxels.map((v) => ({
    ...v,
    px: v.x - cx,
    py: v.y - cy,
    pz: v.z - cz,
  }));
}

function getOklchVoxelPalette(accent: Voxel['accent'], matched: boolean) {
  if (matched) {
    return {
      shell: colorFromOklch(0.66, 0.24, 152),
      core: colorFromOklch(0.97, 0.14, 152),
      edge: colorFromOklch(0.99, 0.06, 155),
    };
  }
  if (accent === 'mint') {
    return {
      shell: colorFromOklch(0.62, 0.20, 168),
      core: colorFromOklch(0.92, 0.14, 165),
      edge: colorFromOklch(0.96, 0.06, 166),
    };
  }
  if (accent === 'amber') {
    return {
      shell: colorFromOklch(0.68, 0.21, 82),
      core: colorFromOklch(0.97, 0.14, 88),
      edge: colorFromOklch(0.99, 0.05, 86),
    };
  }
  if (accent === 'violet') {
    return {
      shell: colorFromOklch(0.55, 0.28, 336),
      core: colorFromOklch(0.90, 0.20, 332),
      edge: colorFromOklch(0.98, 0.08, 335),
    };
  }
  return {
    shell: colorFromOklch(0.60, 0.22, 198),
    core: colorFromOklch(0.96, 0.12, 196),
    edge: colorFromOklch(0.99, 0.04, 198),
  };
}

function populateCrystalGroup(
  parent: THREE.Group,
  voxels: Voxel[],
  matched: boolean
) {
  while (parent.children.length > 0) {
    const child = parent.children[0];
    parent.remove(child);
    disposeThreeHierarchy(child);
  }

  const centered = computeCenteredPositions(voxels);
  const outerGeo = new THREE.BoxGeometry(0.86, 0.86, 0.86);
  const coreGeo = new THREE.OctahedronGeometry(0.32, 0);
  const edgesGeo = new THREE.EdgesGeometry(outerGeo, 1);

  for (const v of centered) {
    const pal = getOklchVoxelPalette(v.accent, matched);
    const voxelUnit = new THREE.Group();
    voxelUnit.position.set(v.px, v.py, v.pz);

    // High-contrast jewel PBR crystal shell so lit vs shadow faces pop sharply
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: pal.shell,
      emissive: pal.shell,
      emissiveIntensity: matched ? 0.28 : 0.12,
      roughness: 0.04,
      metalness: 0.24,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      iridescence: 1.0,
      iridescenceIOR: 1.6,
      ior: 1.8,
      specularIntensity: 1.0,
      flatShading: true,
    });
    const shell = new THREE.Mesh(outerGeo, shellMat);
    voxelUnit.add(shell);

    // Inner bright starlight diamond core
    const coreMat = new THREE.MeshBasicMaterial({ color: pal.core });
    const core = new THREE.Mesh(coreGeo, coreMat);
    voxelUnit.add(core);

    // Razor-sharp luminous chamfer edge frame
    const lineMat = new THREE.LineBasicMaterial({
      color: pal.edge,
      transparent: true,
      opacity: 0.96,
    });
    const edges = new THREE.LineSegments(edgesGeo, lineMat);
    voxelUnit.add(edges);

    parent.add(voxelUnit);
  }
}

export function Spatial3DBoard({
  age,
  stageNumber = 7,
  resetSignal,
  onWin,
}: {
  age: AgeGroup;
  stageNumber?: Spatial3DStageNumber;
  resetSignal: number;
  onWin: () => void;
}) {
  const spec = useMemo(() => getSpatial3DStage(age, stageNumber), [age, stageNumber]);
  const [voxels, setVoxels] = useState<Voxel[]>(() => spec.initial);
  const [won, setWon] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const targetGroupRef = useRef<THREE.Group | null>(null);
  const currentGroupRef = useRef<THREE.Group | null>(null);
  const animQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const swipeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const wonRef = useRef(false);
  wonRef.current = won;

  useEffect(() => {
    setVoxels(spec.initial);
    setWon(false);
    animQuatRef.current.identity();
  }, [spec, resetSignal]);

  // Mount Three.js Dual-Crystal Stage with RoomEnvironment reflections & deep space fog
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    if (!isWebGLAvailable()) {
      setWebglFailed(true);
      return;
    }
    const isSoftwareGl = detectSoftwareWebGL();

    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let disposeEnv: (() => void) | null = null;
    let glowTex: THREE.CanvasTexture | null = null;
    let ro: ResizeObserver | null = null;
    let stopLoop: (() => void) | null = null;
    let onContextLost: ((e: Event) => void) | null = null;

    try {
      renderer = createCosmicRenderer(canvas, isSoftwareGl, true);

      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x030616, 0.042);
      disposeEnv = applyRoomEnvironment(renderer, scene);
      glowTex = createCrystalGlowTexture();

    const camera = new THREE.PerspectiveCamera(40, 16 / 10, 0.1, 100);
    camera.position.set(5.35, 4.05, 6.15);
    camera.lookAt(0, -0.22, 0);

    const syncSize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer?.setSize(w, h, false);
    };
    syncSize();

    // High-contrast crystalline lighting rig
    const hemi = new THREE.HemisphereLight(
      colorFromOklch(0.88, 0.10, 200),
      colorFromOklch(0.16, 0.12, 295),
      0.55
    );
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.7);
    keyLight.position.set(4.5, 8.5, 5.5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(colorFromOklch(0.76, 0.25, 336), 1.85);
    rimLight.position.set(-5, -2, -5);
    scene.add(rimLight);

    const leftBeacon = new THREE.PointLight(colorFromOklch(0.84, 0.19, 158), 8, 18, 1.4);
    leftBeacon.position.set(-2.6, 1.7, 2.6);
    scene.add(leftBeacon);

    const rightBeacon = new THREE.PointLight(colorFromOklch(0.84, 0.16, 198), 8, 18, 1.4);
    rightBeacon.position.set(2.6, 1.7, -2.6);
    scene.add(rightBeacon);

    // Sculpted Hexagonal Obsidian Crystal Pedestals + Radiant Aura Sprites
    const buildPedestal = (x: number, z: number, glowColor: THREE.Color) => {
      const ped = new THREE.Group();
      ped.position.set(x, -1.78, z);

      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(1.74, 1.98, 0.22, 8),
        new THREE.MeshStandardMaterial({
          color: colorFromOklch(0.14, 0.06, 280),
          roughness: 0.14,
          metalness: 0.90,
          flatShading: true,
        })
      );
      ped.add(disc);

      const haloRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.86, 0.036, 6, 8),
        new THREE.MeshStandardMaterial({
          color: glowColor,
          emissive: glowColor,
          emissiveIntensity: 1.35,
          roughness: 0.1,
          metalness: 0.5,
          flatShading: true,
        })
      );
      haloRing.rotation.x = Math.PI / 2;
      haloRing.rotation.z = Math.PI / 8;
      haloRing.position.y = 0.08;
      ped.add(haloRing);

      const auraSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: glowColor,
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      auraSprite.position.set(0, 1.85, 0);
      auraSprite.scale.setScalar(4.6);
      ped.add(auraSprite);

      safeScene.add(ped);
      return { ped, auraSprite, haloRing };
    };

    const safeScene = scene;
    const targetPedestal = buildPedestal(-2.45, 2.45, colorFromOklch(0.84, 0.19, 158));
    buildPedestal(2.45, -2.45, colorFromOklch(0.85, 0.16, 196));

    const targetGroup = new THREE.Group();
    targetGroup.position.set(-2.45, 0.18, 2.45);
    safeScene.add(targetGroup);
    targetGroupRef.current = targetGroup;

    const currentGroup = new THREE.Group();
    currentGroup.position.set(2.45, 0.18, -2.45);
    safeScene.add(currentGroup);
    currentGroupRef.current = currentGroup;

    ro = new ResizeObserver(syncSize);
    ro.observe(container);

    onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFailed(true);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    stopLoop = startPacedThreeLoop(renderer, safeScene, camera, isSoftwareGl, (dt, elapsed) => {
      const bob = Math.sin(elapsed * 2.1) * 0.08;
      const targetGlowPulse = 0.5 + 0.5 * Math.sin(elapsed * 2.8);
      targetGroup.position.y = 0.18 + bob;
      currentGroup.position.y = 0.18 + bob;

      leftBeacon.intensity = 7.5 + targetGlowPulse * 4.5;
      rightBeacon.intensity = 7 + (1 - targetGlowPulse) * 2.5;
      targetPedestal.auraSprite.scale.setScalar(4.4 + targetGlowPulse * 0.65);
      (targetPedestal.auraSprite.material as THREE.SpriteMaterial).opacity =
        0.58 + targetGlowPulse * 0.28;
      targetPedestal.haloRing.rotation.z += dt * 0.45;

      animQuatRef.current.slerp(_identityQuat, Math.min(1, dt * 16));
      currentGroup.quaternion.copy(animQuatRef.current);

      if (wonRef.current) {
        targetGroup.rotation.y += dt * 1.4;
      }
    }, () => setWebglFailed(true));
    } catch {
      safeCleanup();
      setWebglFailed(true);
      return;
    }

    function safeCleanup() {
      stopLoop?.();
      ro?.disconnect();
      if (onContextLost) canvas?.removeEventListener('webglcontextlost', onContextLost);
      glowTex?.dispose();
      disposeEnv?.();
      if (scene) disposeThreeHierarchy(scene);
      renderer?.dispose();
    }

    return () => {
      safeCleanup();
    };
  }, []);

  useEffect(() => {
    const targetGroup = targetGroupRef.current;
    const currentGroup = currentGroupRef.current;
    if (!targetGroup || !currentGroup) return;

    populateCrystalGroup(targetGroup, spec.target, won);
    populateCrystalGroup(currentGroup, voxels, won);
  }, [spec, voxels, won]);

  const handleRotate = (axis: Axis3D, dir: 1 | -1) => {
    if (won) return;
    const next = rotateVoxels(voxels, axis, dir);

    if (axis === 'x') _axisVec.set(1, 0, 0);
    else if (axis === 'y') _axisVec.set(0, 1, 0);
    else _axisVec.set(0, 0, 1);

    animQuatRef.current.setFromAxisAngle(_axisVec, (-dir * Math.PI) / 2);

    setVoxels(next);
    cosmicSound.playClick();

    if (voxelsMatch(next, spec.target)) {
      setWon(true);
      cosmicSound.playVictory();
      setTimeout(() => onWin(), 580);
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (won) return;
    swipeOriginRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const origin = swipeOriginRef.current;
    if (!origin || won) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    const threshold = 42;
    if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy)) {
      swipeOriginRef.current = { x: e.clientX, y: e.clientY };
      handleRotate('y', dx > 0 ? 1 : -1);
    } else if (Math.abs(dy) >= threshold && Math.abs(dy) > Math.abs(dx)) {
      swipeOriginRef.current = { x: e.clientX, y: e.clientY };
      handleRotate('x', dy > 0 ? 1 : -1);
    }
  };

  const handleCanvasPointerUp = () => {
    swipeOriginRef.current = null;
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-between gap-3 py-2">
      {/* Three.js 3D Dual-Crystal Stage inside Radix AspectRatio */}
      <div className="flex-1 w-full flex items-center justify-center min-h-0">
        <div className="w-[min(100%,820px,calc((100dvh-195px)*1.6))]">
          <AspectRatio.Root ratio={16 / 10}>
            <div
              ref={containerRef}
              className={`relative w-full h-full rounded-2xl overflow-hidden border cosmo-panel transition-colors ${
                won
                  ? 'border-[#2DF59A] shadow-[0_0_46px_oklch(0.84_0.19_158_/_0.48)]'
                  : 'border-[#B378FF]/45'
              }`}
            >
              {/* Left Target Check Emblem */}
              <div
                className="absolute top-3.5 left-3.5 z-10 w-10 h-10 rounded-xl bg-[#0A2426] border border-[#2DF59A] flex items-center justify-center text-[#2DF59A] shadow-[0_0_24px_oklch(0.84_0.19_158_/_0.65)] pointer-events-none animate-float-alive"
                data-testid="spatial-target"
              >
                <span
                  className="absolute -inset-1 rounded-xl border border-[#2DF59A]/60 animate-beacon-ring"
                  aria-hidden="true"
                />
                <Check className="w-5 h-5 stroke-[2.4]" />
              </div>

              {/* Right Swipe Gesture Affordance */}
              <div
                className="absolute top-3.5 right-3.5 z-10 w-10 h-10 rounded-xl bg-[#0C1233] border border-[#22EBFF]/65 flex items-center justify-center text-[#22EBFF] pointer-events-none"
                aria-hidden="true"
              >
                <Hand className="w-5 h-5" />
              </div>

              <div
                className="absolute top-6 bottom-6 left-1/2 w-px bg-gradient-to-b from-transparent via-[#22EBFF]/55 to-transparent pointer-events-none z-10"
                aria-hidden="true"
              />

              {!webglFailed ? (
                <canvas
                  ref={canvasRef}
                  data-testid="spatial-3d-canvas"
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  className="w-full h-full block touch-none cursor-grab active:cursor-grabbing"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#22EBFF] tabular-nums font-bold">
                  3D
                </div>
              )}
            </div>
          </AspectRatio.Root>
        </div>
      </div>

      {/* Sharp Crystalline 3-Axis OKLCH Controls inside Radix Toolbar */}
      <Toolbar.Root
        aria-label="3D Orbital Controls"
        className="flex flex-wrap items-center justify-center gap-2.5 p-2 rounded-2xl cosmo-panel border border-[#B378FF]/40"
      >
        {/* X Axis (Electric Aqua) */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[#070B22] border border-[#22EBFF]/50">
          <Toolbar.Button
            type="button"
            onClick={() => handleRotate('x', -1)}
            disabled={won}
            aria-label="Rotate X negative"
            className="w-10 h-10 rounded-lg bg-[#0D1840] hover:bg-[#22EBFF]/20 border border-[#22EBFF]/30 text-[#22EBFF] flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors cosmo-btn-3d"
          >
            <RotateCcw className="w-4.5 h-4.5" />
          </Toolbar.Button>
          <span className="w-6 flex items-center justify-center text-[#22EBFF]" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <polygon points="12,4 16,12 12,20 8,12" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.8" />
            </svg>
          </span>
          <Toolbar.Button
            type="button"
            onClick={() => handleRotate('x', 1)}
            disabled={won}
            aria-label="Rotate X positive"
            className="w-10 h-10 rounded-lg bg-[#0D1840] hover:bg-[#22EBFF]/20 border border-[#22EBFF]/30 text-[#22EBFF] flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors cosmo-btn-3d"
          >
            <RotateCw className="w-4.5 h-4.5" />
          </Toolbar.Button>
        </div>

        <Separator.Root orientation="vertical" className="hidden sm:block w-px h-8 bg-indigo-400/25" />

        {/* Y Axis (Solar Gold) */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[#070B22] border border-[#FFD23F]/50">
          <Toolbar.Button
            type="button"
            onClick={() => handleRotate('y', -1)}
            disabled={won}
            aria-label="Rotate Y negative"
            className="w-10 h-10 rounded-lg bg-[#1A1538] hover:bg-[#FFD23F]/20 border border-[#FFD23F]/30 text-[#FFD23F] flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors cosmo-btn-3d"
          >
            <RotateCcw className="w-4.5 h-4.5" />
          </Toolbar.Button>
          <span className="w-6 flex items-center justify-center text-[#FFD23F]" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <polygon points="4,12 12,8.5 20,12 12,15.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.8" />
            </svg>
          </span>
          <Toolbar.Button
            type="button"
            onClick={() => handleRotate('y', 1)}
            disabled={won}
            aria-label="Rotate Y positive"
            className="w-10 h-10 rounded-lg bg-[#1A1538] hover:bg-[#FFD23F]/20 border border-[#FFD23F]/30 text-[#FFD23F] flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors cosmo-btn-3d"
          >
            <RotateCw className="w-4.5 h-4.5" />
          </Toolbar.Button>
        </div>

        <Separator.Root orientation="vertical" className="hidden sm:block w-px h-8 bg-indigo-400/25" />

        {/* Z Axis (Berry Magenta) */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[#070B22] border border-[#FF4EC6]/50">
          <Toolbar.Button
            type="button"
            onClick={() => handleRotate('z', -1)}
            disabled={won}
            aria-label="Rotate Z negative"
            className="w-10 h-10 rounded-lg bg-[#220E36] hover:bg-[#FF4EC6]/20 border border-[#FF4EC6]/30 text-[#FF4EC6] flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors cosmo-btn-3d"
          >
            <RotateCcw className="w-4.5 h-4.5" />
          </Toolbar.Button>
          <span className="w-6 flex items-center justify-center text-[#FF4EC6]" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <polygon points="12,4 20,12 12,20 4,12" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.8" />
              <polygon points="12,8.5 15.5,12 12,15.5 8.5,12" fill="currentColor" />
            </svg>
          </span>
          <Toolbar.Button
            type="button"
            onClick={() => handleRotate('z', 1)}
            disabled={won}
            aria-label="Rotate Z positive"
            className="w-10 h-10 rounded-lg bg-[#220E36] hover:bg-[#FF4EC6]/20 border border-[#FF4EC6]/30 text-[#FF4EC6] flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors cosmo-btn-3d"
          >
            <RotateCw className="w-4.5 h-4.5" />
          </Toolbar.Button>
        </div>
      </Toolbar.Root>
    </div>
  );
}
