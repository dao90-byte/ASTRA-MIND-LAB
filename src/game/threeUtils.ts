import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function isWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createCosmicRenderer(
  canvas: HTMLCanvasElement,
  isSoftwareGl: boolean,
  alpha = true
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isSoftwareGl,
    alpha,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.24;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  return renderer;
}

export function applyRoomEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene
): () => void {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const roomEnv = new RoomEnvironment();
  const envTarget = pmremGenerator.fromScene(roomEnv, 0.035);
  scene.environment = envTarget.texture;

  return () => {
    scene.environment = null;
    envTarget.dispose();
    roomEnv.dispose();
    pmremGenerator.dispose();
  };
}

/**
 * Converts perceptual OKLCH coordinates into a Three.js Color.
 * Ensures vibrant, perceptually uniform cosmic hues across 3D meshes.
 */
export function colorFromOklch(l: number, c: number, hDeg: number): THREE.Color {
  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const lr = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const lg = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const lb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const color = new THREE.Color();
  color.setRGB(clamp01(lr), clamp01(lg), clamp01(lb), THREE.LinearSRGBColorSpace);
  return color;
}

/**
 * Builds a sharp double-terminated hexagonal quartz crystal geometry
 * (prism shaft + upper & lower pyramidal points) with zero rounded cartoon geometry.
 */
export function createCrystalPrismGeometry(
  radius: number,
  shaftHeight: number,
  tipHeight: number,
  sides = 6
): THREE.BufferGeometry {
  const geom = new THREE.CylinderGeometry(radius * 0.86, radius, shaftHeight, sides, 1);
  const topCap = new THREE.ConeGeometry(radius * 0.86, tipHeight, sides, 1);
  topCap.translate(0, shaftHeight / 2 + tipHeight / 2, 0);
  const bottomCap = new THREE.ConeGeometry(radius, tipHeight * 0.78, sides, 1);
  bottomCap.rotateX(Math.PI);
  bottomCap.translate(0, -shaftHeight / 2 - (tipHeight * 0.78) / 2, 0);

  // Merge non-indexed position buffers cleanly into one crisp BufferGeometry
  const parts = [geom.toNonIndexed(), topCap.toNonIndexed(), bottomCap.toNonIndexed()];
  let totalVerts = 0;
  for (const p of parts) {
    totalVerts += p.attributes.position.count;
  }
  const positions = new Float32Array(totalVerts * 3);
  let offset = 0;
  for (const p of parts) {
    const arr = p.attributes.position.array as Float32Array;
    positions.set(arr, offset);
    offset += arr.length;
    p.dispose();
  }
  geom.dispose();
  topCap.dispose();
  bottomCap.dispose();

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.computeVertexNormals();
  return merged;
}

/**
 * Generates a smooth multi-stop radial energy aura texture for additive crystal halos.
 */
export function createCrystalGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    g.addColorStop(0.22, 'rgba(255, 255, 255, 0.55)');
    g.addColorStop(0.52, 'rgba(255, 255, 255, 0.14)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a sharp 4-point crystalline diffraction starflare texture.
 */
export function createStarFlareTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx * 0.42);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.3, 'rgba(255, 255, 255, 0.45)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    const drawSpike = (rx: number, ry: number) => {
      ctx.beginPath();
      ctx.moveTo(cx - rx, cx);
      ctx.lineTo(cx, cx - ry);
      ctx.lineTo(cx + rx, cx);
      ctx.lineTo(cx, cx + ry);
      ctx.closePath();
      ctx.fill();
    };
    drawSpike(cx * 0.96, 3.2);
    drawSpike(3.2, cx * 0.96);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function disposeThreeHierarchy(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const anyObj = obj as THREE.Mesh;
    if (anyObj.geometry) {
      anyObj.geometry.dispose();
    }
    if (anyObj.material) {
      if (Array.isArray(anyObj.material)) {
        for (const m of anyObj.material) m.dispose();
      } else {
        anyObj.material.dispose();
      }
    }
  });
}

export function startPacedThreeLoop(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  isSoftwareGl: boolean,
  onTick: (dt: number, elapsed: number) => void,
  onError?: () => void
): () => void {
  let disposed = false;
  let timerId = 0;
  let rafId = 0;
  let lastNow = performance.now();
  let elapsed = 0;

  const stepFrame = () => {
    if (disposed) return;
    try {
      const now = performance.now();
      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;
      elapsed += dt;
      onTick(dt, elapsed);
      renderer.render(scene, camera);
    } catch {
      disposed = true;
      window.clearTimeout(timerId);
      cancelAnimationFrame(rafId);
      onError?.();
    }
  };

  if (!isSoftwareGl) {
    const loop = () => {
      if (disposed) return;
      stepFrame();
      if (!disposed) rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
    };
  }

  // Software WebGL (SwiftShader) paced loop using fenceSync + 85ms breather
  const renderOnceAndPace = () => {
    if (disposed) return;
    stepFrame();
    if (disposed) return;

    const gl = renderer.getContext() as WebGL2RenderingContext | null;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          timerId = window.setTimeout(poll, 8);
        } else {
          if (sync) gl.deleteSync(sync);
          timerId = window.setTimeout(() => {
            if (!disposed) rafId = requestAnimationFrame(renderOnceAndPace);
          }, 85);
        }
      };
      timerId = window.setTimeout(poll, 8);
    } else {
      timerId = window.setTimeout(() => {
        if (!disposed) rafId = requestAnimationFrame(renderOnceAndPace);
      }, 95);
    }
  };

  rafId = requestAnimationFrame(renderOnceAndPace);

  return () => {
    disposed = true;
    window.clearTimeout(timerId);
    cancelAnimationFrame(rafId);
  };
}
