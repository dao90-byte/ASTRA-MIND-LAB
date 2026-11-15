import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  applyRoomEnvironment,
  colorFromOklch,
  createCosmicRenderer,
  createCrystalGlowTexture,
  createCrystalPrismGeometry,
  createStarFlareTexture,
  detectSoftwareWebGL,
  disposeThreeHierarchy,
  startPacedThreeLoop,
} from '../game/threeUtils';
import { AgeGroup } from '../game/types';

// Reusable module-scope math objects (zero GC churn inside render loop)
const _dummy = new THREE.Object3D();
const _baseVec = new THREE.Vector3();

function buildShardMesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  edgeColor: THREE.Color,
  edgeOpacity = 0.92
): THREE.Group {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(geo, mat);
  g.add(mesh);

  // Threshold of 1 deg reveals every crisp faceted ridge across prism shaft & pyramidal tips
  const edges = new THREE.EdgesGeometry(geo, 1);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: edgeOpacity,
    })
  );
  g.add(line);
  return g;
}

export function ThreeBackdrop({
  showHero,
  selectedAge = 7,
}: {
  showHero: boolean;
  selectedAge?: AgeGroup;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const showHeroRef = useRef(showHero);
  const selectedAgeRef = useRef<AgeGroup>(selectedAge);
  const [webglFailed, setWebglFailed] = useState(false);

  showHeroRef.current = showHero;
  selectedAgeRef.current = selectedAge;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = createCosmicRenderer(canvas, isSoftwareGl, true);
    } catch {
      setWebglFailed(true);
      return;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030616, 0.034);
    const disposeEnv = applyRoomEnvironment(renderer, scene);
    const glowTex = createCrystalGlowTexture();
    const flareTex = createStarFlareTexture();

    const camera = new THREE.PerspectiveCamera(
      44,
      Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight),
      0.1,
      120
    );
    camera.position.set(0, 0.25, 13.8);
    camera.lookAt(0, 0, 0);

    renderer.setSize(window.innerWidth, window.innerHeight, false);

    // High-contrast 4-point cosmic crystal lighting rig (dramatic light-to-shadow facet contrast)
    const hemi = new THREE.HemisphereLight(
      colorFromOklch(0.84, 0.14, 200),
      colorFromOklch(0.14, 0.12, 285),
      0.55
    );
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(-5.5, 7.5, 6.5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(colorFromOklch(0.76, 0.26, 336), 2.1);
    rimLight.position.set(6, -3.5, -5);
    scene.add(rimLight);

    const aquaLight = new THREE.PointLight(colorFromOklch(0.85, 0.20, 198), 14, 30, 1.3);
    aquaLight.position.set(-5.5, 2.2, 4.5);
    scene.add(aquaLight);

    const magentaLight = new THREE.PointLight(colorFromOklch(0.74, 0.26, 334), 12, 30, 1.3);
    magentaLight.position.set(5.5, -1.8, 4.2);
    scene.add(magentaLight);

    // 1. Multi-Depth Radiant Crystal Starfield + Sharp 4-Point Diffraction Starflares
    const starCount = 340;
    const starGeo = new THREE.OctahedronGeometry(0.056, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const starMesh = new THREE.InstancedMesh(starGeo, starMat, starCount);
    starMesh.frustumCulled = false;

    const starPalette = [
      colorFromOklch(0.90, 0.18, 196),
      colorFromOklch(0.92, 0.18, 84),
      colorFromOklch(0.80, 0.25, 334),
      colorFromOklch(0.82, 0.22, 292),
      colorFromOklch(0.90, 0.19, 158),
      colorFromOklch(0.98, 0.02, 220),
    ];

    const starPositions: Array<{ x: number; y: number; z: number; s: number; phase: number }> = [];
    for (let i = 0; i < starCount; i++) {
      const k = i + 29;
      const r1 = ((k * 9301 + 49297) % 233280) / 233280;
      const r2 = ((k * 7919 + 104729) % 233280) / 233280;
      const r3 = ((k * 3571 + 17389) % 233280) / 233280;
      const x = (r1 - 0.5) * 44;
      const y = (r2 - 0.5) * 27;
      const z = -1.8 - r3 * 22;
      const s = 0.35 + (i % 6) * 0.2;
      starPositions.push({ x, y, z, s, phase: r1 * Math.PI * 2 });

      _dummy.position.set(x, y, z);
      _dummy.rotation.set(r1 * Math.PI, r2 * Math.PI, r3 * Math.PI);
      _dummy.scale.set(s * 0.65, s * 1.35, s * 0.65);
      _dummy.updateMatrix();
      starMesh.setMatrixAt(i, _dummy.matrix);
      starMesh.setColorAt(i, starPalette[i % starPalette.length]);
    }
    starMesh.instanceMatrix.needsUpdate = true;
    if (starMesh.instanceColor) starMesh.instanceColor.needsUpdate = true;
    scene.add(starMesh);

    // 18 Razor-Sharp 4-Point Diffraction Starflares for cosmic sparkle & Z-depth
    const flareSprites: Array<{ sprite: THREE.Sprite; baseScale: number; phase: number }> = [];
    for (let i = 0; i < 18; i++) {
      const sp = starPositions[i * 15];
      const fMat = new THREE.SpriteMaterial({
        map: flareTex,
        color: starPalette[i % starPalette.length],
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const flare = new THREE.Sprite(fMat);
      flare.position.set(sp.x * 0.85, sp.y * 0.85, -3.5 - (i % 5) * 2.8);
      const baseScale = 0.55 + (i % 3) * 0.24;
      flare.scale.setScalar(baseScale);
      scene.add(flare);
      flareSprites.push({ sprite: flare, baseScale, phase: sp.phase });
    }

    // 2. Multi-Depth Floating Jewel-Grade Cosmic Crystal Clusters (zero cartoon spheres)
    const driftGroup = new THREE.Group();
    const clusterSpecs = [
      { pos: [-8.2, 3.6, -4.6], scale: 1.05, col: colorFromOklch(0.56, 0.28, 334), edge: colorFromOklch(0.95, 0.14, 330) },
      { pos: [8.3, 3.1, -6.4], scale: 0.96, col: colorFromOklch(0.62, 0.21, 196), edge: colorFromOklch(0.97, 0.08, 196) },
      { pos: [-7.1, -3.5, -5.8], scale: 0.90, col: colorFromOklch(0.68, 0.21, 84), edge: colorFromOklch(0.98, 0.08, 86) },
      { pos: [7.6, -3.3, -4.2], scale: 1.02, col: colorFromOklch(0.54, 0.25, 294), edge: colorFromOklch(0.93, 0.12, 294) },
      { pos: [-11.5, -0.2, -12.5], scale: 1.45, col: colorFromOklch(0.60, 0.22, 158), edge: colorFromOklch(0.96, 0.10, 158) },
      { pos: [11.8, 0.6, -13.8], scale: 1.5, col: colorFromOklch(0.55, 0.27, 338), edge: colorFromOklch(0.96, 0.12, 338) },
    ];

    const sharedDriftGeo = createCrystalPrismGeometry(0.28, 0.72, 0.42, 6);
    const sharedSpikeGeo = createCrystalPrismGeometry(0.15, 0.52, 0.30, 5);
    const driftClusters: THREE.Group[] = [];

    for (let idx = 0; idx < clusterSpecs.length; idx++) {
      const cs = clusterSpecs[idx];
      const cluster = new THREE.Group();

      // Low diffuse emissive + high specular clearcoat creates razor-sharp jewel facet contrast
      const mat = new THREE.MeshPhysicalMaterial({
        color: cs.col,
        emissive: cs.col,
        emissiveIntensity: 0.14,
        roughness: 0.05,
        metalness: 0.24,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        iridescence: 1.0,
        iridescenceIOR: 1.6,
        ior: 1.75,
        specularIntensity: 1.0,
        flatShading: true,
      });

      const primary = buildShardMesh(sharedDriftGeo, mat, cs.edge, 0.9);
      cluster.add(primary);

      const spikeA = buildShardMesh(sharedSpikeGeo, mat, cs.edge, 0.85);
      spikeA.position.set(0.22, -0.08, 0.08);
      spikeA.rotation.set(0.32, 0.4, -0.68);
      cluster.add(spikeA);

      const spikeB = buildShardMesh(sharedSpikeGeo, mat, cs.edge, 0.85);
      spikeB.position.set(-0.2, -0.12, -0.1);
      spikeB.rotation.set(-0.42, -0.2, 0.72);
      cluster.add(spikeB);

      // Additive radial aura halo behind crystal cluster
      const clusterHalo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: cs.edge,
          transparent: true,
          opacity: 0.48,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      clusterHalo.scale.setScalar(2.1);
      cluster.add(clusterHalo);

      cluster.position.set(cs.pos[0], cs.pos[1], cs.pos[2]);
      cluster.scale.setScalar(cs.scale);
      cluster.rotation.set(idx * 0.4, idx * 0.9, idx * 0.25);
      driftGroup.add(cluster);
      driftClusters.push(cluster);
    }
    scene.add(driftGroup);

    // 3. Title Screen Hero: Radiant Jewel-Faceted Astral Crystal Monolith & Prismatic Gimbal
    const heroGroup = new THREE.Group();
    heroGroup.position.set(0, 1.48, 0.7);
    scene.add(heroGroup);

    const aquaJewel = colorFromOklch(0.60, 0.22, 198);
    const aquaEmissive = colorFromOklch(0.34, 0.16, 206);
    const aquaEdge = colorFromOklch(0.96, 0.08, 196);

    const goldJewel = colorFromOklch(0.68, 0.21, 82);
    const goldEmissive = colorFromOklch(0.38, 0.16, 70);
    const goldEdge = colorFromOklch(0.98, 0.07, 86);

    const magentaJewel = colorFromOklch(0.55, 0.28, 336);
    const violetJewel = colorFromOklch(0.54, 0.25, 294);
    const mintJewel = colorFromOklch(0.64, 0.22, 158);

    // Additive radiant crystal nebula aura behind Hero Monolith
    const heroAuraMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: aquaJewel,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const heroAuraSprite = new THREE.Sprite(heroAuraMat);
    heroAuraSprite.position.set(0, 0, -0.8);
    heroAuraSprite.scale.setScalar(5.8);
    heroGroup.add(heroAuraSprite);

    const heroCrystalGroup = new THREE.Group();
    heroGroup.add(heroCrystalGroup);

    // Part 1: Main Double-Terminated Hexagonal Quartz Crystal Spire (deep contrast jewel shading)
    const heroCrystalMat = new THREE.MeshPhysicalMaterial({
      color: aquaJewel,
      emissive: aquaEmissive,
      emissiveIntensity: 0.14,
      roughness: 0.04,
      metalness: 0.22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      iridescence: 1.0,
      iridescenceIOR: 1.65,
      ior: 1.8,
      specularIntensity: 1.0,
      flatShading: true,
    });
    const coreCrystalGeo = createCrystalPrismGeometry(0.68, 1.46, 0.96, 6);
    const coreEdgeMat = new THREE.LineBasicMaterial({
      color: aquaEdge,
      transparent: true,
      opacity: 0.96,
    });
    const coreShard = new THREE.Mesh(coreCrystalGeo, heroCrystalMat);
    const coreEdges = new THREE.LineSegments(new THREE.EdgesGeometry(coreCrystalGeo, 1), coreEdgeMat);
    heroCrystalGroup.add(coreShard, coreEdges);

    // Part 2: Glowing Inner Starlight Octahedron Nucleus
    const innerCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const innerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), innerCoreMat);
    innerCore.scale.set(0.85, 1.6, 0.85);
    heroCrystalGroup.add(innerCore);

    // Part 3: Sleek Octagonal Basal Obsidian-Gold Crown (tucked cleanly at lower root, unobstructed center)
    const crownGeo = new THREE.CylinderGeometry(0.86, 0.56, 0.22, 8);
    const crownMat = new THREE.MeshStandardMaterial({
      color: colorFromOklch(0.18, 0.08, 280),
      roughness: 0.14,
      metalness: 0.92,
      flatShading: true,
    });
    const crownMesh = buildShardMesh(crownGeo, crownMat, colorFromOklch(0.85, 0.16, 198), 0.72);
    crownMesh.position.set(0, -1.04, 0);
    heroCrystalGroup.add(crownMesh);

    // Parts 4-7: Four Asymmetric Secondary Crystal Shards emerging from lower crystalline base
    const subShardGeo = createCrystalPrismGeometry(0.24, 0.88, 0.52, 6);
    const subSpecs = [
      { pos: [0.62, -0.34, 0.30], rot: [0.22, 0.3, -0.58], scale: 0.92, col: magentaJewel, edge: colorFromOklch(0.96, 0.12, 336) },
      { pos: [-0.60, -0.26, -0.28], rot: [-0.25, -0.4, 0.62], scale: 0.88, col: violetJewel, edge: colorFromOklch(0.94, 0.12, 294) },
      { pos: [0.24, -0.42, -0.56], rot: [-0.55, 0.2, -0.22], scale: 0.78, col: mintJewel, edge: colorFromOklch(0.96, 0.10, 158) },
      { pos: [-0.28, -0.20, 0.52], rot: [0.54, -0.25, 0.28], scale: 0.72, col: aquaJewel, edge: aquaEdge },
    ];
    for (const ss of subSpecs) {
      const sMat = new THREE.MeshPhysicalMaterial({
        color: ss.col,
        emissive: ss.col,
        emissiveIntensity: 0.12,
        roughness: 0.05,
        metalness: 0.24,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        iridescence: 1.0,
        ior: 1.75,
        specularIntensity: 1.0,
        flatShading: true,
      });
      const sub = buildShardMesh(subShardGeo, sMat, ss.edge, 0.94);
      sub.position.set(ss.pos[0], ss.pos[1], ss.pos[2]);
      sub.rotation.set(ss.rot[0], ss.rot[1], ss.rot[2]);
      sub.scale.setScalar(ss.scale);
      heroCrystalGroup.add(sub);
    }

    // Parts 8-10: Twin Ultra-Crisp Prismatic Orbitals + Diamond Shard Satellites
    const orbitShardGeo = createCrystalPrismGeometry(0.13, 0.34, 0.24, 4);

    const ringAquaPivot = new THREE.Group();
    ringAquaPivot.rotation.set(0.54, 0.22, -0.28);
    heroGroup.add(ringAquaPivot);

    const ringAqua = new THREE.Mesh(
      new THREE.TorusGeometry(2.26, 0.015, 6, 72),
      new THREE.MeshStandardMaterial({
        color: aquaEdge,
        emissive: aquaJewel,
        emissiveIntensity: 0.95,
        roughness: 0.12,
        metalness: 0.7,
      })
    );
    ringAqua.rotation.x = Math.PI / 2;
    ringAquaPivot.add(ringAqua);

    const aquaCrystalSat = buildShardMesh(
      orbitShardGeo,
      new THREE.MeshPhysicalMaterial({
        color: mintJewel,
        emissive: mintJewel,
        emissiveIntensity: 0.22,
        roughness: 0.05,
        clearcoat: 1.0,
        flatShading: true,
      }),
      aquaEdge,
      0.95
    );
    aquaCrystalSat.position.set(2.26, 0, 0);
    ringAquaPivot.add(aquaCrystalSat);

    const ringVioletPivot = new THREE.Group();
    ringVioletPivot.rotation.set(-0.62, 0.38, 0.48);
    heroGroup.add(ringVioletPivot);

    const ringViolet = new THREE.Mesh(
      new THREE.TorusGeometry(1.80, 0.014, 6, 72),
      new THREE.MeshStandardMaterial({
        color: colorFromOklch(0.90, 0.16, 336),
        emissive: magentaJewel,
        emissiveIntensity: 0.95,
        roughness: 0.12,
        metalness: 0.7,
      })
    );
    ringViolet.rotation.x = Math.PI / 2;
    ringVioletPivot.add(ringViolet);

    const magentaCrystalSat = buildShardMesh(
      orbitShardGeo,
      new THREE.MeshPhysicalMaterial({
        color: magentaJewel,
        emissive: magentaJewel,
        emissiveIntensity: 0.22,
        roughness: 0.05,
        clearcoat: 1.0,
        flatShading: true,
      }),
      colorFromOklch(0.96, 0.08, 336),
      0.95
    );
    magentaCrystalSat.position.set(-1.80, 0, 0);
    ringVioletPivot.add(magentaCrystalSat);

    // Part 11: Age-9 Sovereign Gold Octagonal Orbit Halo & Apex Bipyramid Shard
    const ringGoldPivot = new THREE.Group();
    ringGoldPivot.rotation.set(0.32, -0.5, 0.24);
    heroGroup.add(ringGoldPivot);

    const ringGold = new THREE.Mesh(
      new THREE.TorusGeometry(2.76, 0.020, 6, 8),
      new THREE.MeshStandardMaterial({
        color: goldEdge,
        emissive: goldJewel,
        emissiveIntensity: 1.05,
        roughness: 0.10,
        metalness: 0.8,
        flatShading: true,
      })
    );
    ringGold.rotation.x = Math.PI / 2;
    ringGoldPivot.add(ringGold);

    const goldCrystalSat = buildShardMesh(
      orbitShardGeo,
      new THREE.MeshPhysicalMaterial({
        color: goldJewel,
        emissive: goldJewel,
        emissiveIntensity: 0.26,
        roughness: 0.05,
        clearcoat: 1.0,
        flatShading: true,
      }),
      goldEdge,
      0.96
    );
    goldCrystalSat.position.set(0, 0, 2.76);
    goldCrystalSat.scale.setScalar(1.25);
    ringGoldPivot.add(goldCrystalSat);

    let pointerX = 0;
    let pointerY = 0;
    const onPointerMove = (e: PointerEvent) => {
      pointerX = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      pointerY = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const onResize = () => {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer?.setSize(w, h, false);
    };
    window.addEventListener('resize', onResize);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFailed(true);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    let heroScale = showHeroRef.current ? 1 : 0;
    let goldRingScale = selectedAgeRef.current === 9 ? 1 : 0.001;
    heroGroup.visible = showHeroRef.current;

    const stopLoop = startPacedThreeLoop(renderer, scene, camera, isSoftwareGl, (dt, elapsed) => {
      const isAge9 = selectedAgeRef.current === 9;
      const activeHero = showHeroRef.current;

      if (!reducedMotion) {
        starMesh.rotation.y = elapsed * 0.014;
        starMesh.rotation.x = Math.sin(elapsed * 0.08) * 0.035;

        for (let i = 0; i < 48; i++) {
          const sp = starPositions[i];
          const tw = sp.s * (0.82 + 0.38 * Math.sin(elapsed * 2.5 + sp.phase));
          _dummy.position.set(sp.x, sp.y, sp.z);
          _dummy.rotation.set(elapsed * 0.45 + sp.phase, elapsed * 0.65, 0);
          _dummy.scale.set(tw * 0.65, tw * 1.35, tw * 0.65);
          _dummy.updateMatrix();
          starMesh.setMatrixAt(i, _dummy.matrix);
        }
        starMesh.instanceMatrix.needsUpdate = true;

        for (const fs of flareSprites) {
          const pulse = 0.78 + 0.34 * Math.sin(elapsed * 2.2 + fs.phase);
          fs.sprite.scale.setScalar(fs.baseScale * pulse);
        }

        for (let i = 0; i < driftClusters.length; i++) {
          const dc = driftClusters[i];
          dc.rotation.y += dt * (0.24 + (i % 3) * 0.08);
          dc.rotation.x += dt * 0.15;
          dc.position.y = clusterSpecs[i].pos[1] + Math.sin(elapsed * 0.85 + i * 1.6) * 0.28;
        }

        if (activeHero) {
          const spd = isAge9 ? 1.28 : 1.0;
          heroGroup.position.y = 1.48 + Math.sin(elapsed * 1.65) * 0.10;
          heroCrystalGroup.rotation.y += dt * 0.44 * spd;
          heroCrystalGroup.rotation.z = Math.sin(elapsed * 0.85) * 0.07;
          innerCore.rotation.y -= dt * 1.2;

          const auraPulse = 5.6 + Math.sin(elapsed * 2.4) * 0.35;
          heroAuraSprite.scale.setScalar(auraPulse);

          ringAquaPivot.rotation.y += dt * 0.62 * spd;
          aquaCrystalSat.rotation.y += dt * 1.5;
          ringVioletPivot.rotation.y -= dt * 0.82 * spd;
          magentaCrystalSat.rotation.y -= dt * 1.5;

          ringGoldPivot.rotation.y += dt * 0.5;
          goldCrystalSat.rotation.y += dt * 1.6;
        }
      }

      // Smooth crystalline hue transition for Age 7 (Prism Aqua) vs Age 9 (Solar Gold Crystal)
      heroCrystalMat.color.lerp(isAge9 ? goldJewel : aquaJewel, Math.min(1, dt * 6));
      heroCrystalMat.emissive.lerp(isAge9 ? goldEmissive : aquaEmissive, Math.min(1, dt * 6));
      coreEdgeMat.color.lerp(isAge9 ? goldEdge : aquaEdge, Math.min(1, dt * 6));
      heroAuraMat.color.lerp(isAge9 ? goldJewel : aquaJewel, Math.min(1, dt * 6));

      if (!activeHero) {
        heroScale = 0;
        heroGroup.visible = false;
      } else {
        heroGroup.visible = true;
        heroScale += (1 - heroScale) * Math.min(1, dt * 9);
        heroGroup.scale.setScalar(heroScale);

        const targetGold = isAge9 ? 1 : 0.001;
        goldRingScale += (targetGold - goldRingScale) * Math.min(1, dt * 8);
        ringGoldPivot.visible = goldRingScale > 0.03;
        ringGoldPivot.scale.setScalar(goldRingScale);
      }

      // Crisp 3D spatial parallax across all Z-layers
      _baseVec.set(pointerX * 0.95, 0.25 - pointerY * 0.52, 13.8);
      camera.position.lerp(_baseVec, Math.min(1, dt * 4.5));
      camera.lookAt(0, 0, 0);
    });

    return () => {
      stopLoop();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      glowTex.dispose();
      flareTex.dispose();
      disposeEnv();
      disposeThreeHierarchy(scene);
      renderer?.dispose();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
      style={{
        background:
          'radial-gradient(ellipse 68% 58% at 16% 18%, oklch(0.42 0.22 332 / 0.28) 0%, transparent 56%), radial-gradient(ellipse 62% 56% at 84% 20%, oklch(0.46 0.18 198 / 0.26) 0%, transparent 56%), radial-gradient(ellipse 75% 60% at 50% 88%, oklch(0.36 0.20 292 / 0.30) 0%, transparent 62%), linear-gradient(180deg, oklch(0.075 0.048 278) 0%, oklch(0.045 0.038 282) 100%)',
      }}
    >
      {!webglFailed && (
        <canvas
          ref={canvasRef}
          data-testid="three-backdrop-canvas"
          className="w-full h-full block"
        />
      )}
    </div>
  );
}
