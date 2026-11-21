import { AspectRatio, Separator, ToggleGroup, Toolbar } from 'radix-ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleDot,
  Magnet,
  Minus,
  Play,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
  Wind,
} from 'lucide-react';
import {
  ORB_RADIUS,
  OrbState,
  PlacedTool,
  SANDBOX_H,
  SANDBOX_W,
  SandboxStageNumber,
  SandboxToolKind,
  createInitialOrb,
  getSandboxStage,
  stepSandboxPhysics,
} from '../game/emergentSandbox';
import { cosmicSound } from '../game/sound';
import { AgeGroup } from '../game/types';

const SANDBOX_TOOL_ORDER: SandboxToolKind[] = [
  'plank',
  'bumper',
  'wind',
  'attractor',
  'repulsor',
];

function ToolIcon({ kind, className = 'w-5 h-5' }: { kind: SandboxToolKind; className?: string }) {
  switch (kind) {
    case 'plank':
      return <Minus className={className} />;
    case 'bumper':
      return <CircleDot className={className} />;
    case 'wind':
      return <Wind className={className} />;
    case 'attractor':
      return <Magnet className={className} />;
    case 'repulsor':
      return <Magnet className={`${className} rotate-180`} />;
  }
}

export function SandboxBoard({
  age,
  stageNumber,
  resetSignal,
  onWin,
}: {
  age: AgeGroup;
  stageNumber: SandboxStageNumber;
  resetSignal: number;
  onWin: () => void;
}) {
  const spec = useMemo(() => getSandboxStage(age, stageNumber), [age, stageNumber]);

  const [tools, setTools] = useState<PlacedTool[]>([]);
  const [activeToolKind, setActiveToolKind] = useState<SandboxToolKind>(() => {
    return SANDBOX_TOOL_ORDER.find((k) => (spec.toolbox[k] ?? 0) > 0) ?? 'plank';
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orbRef = useRef<OrbState>(createInitialOrb(spec));
  const toolsRef = useRef<PlacedTool[]>(tools);
  const isRunningRef = useRef(isRunning);
  const selectedIdRef = useRef(selectedId);
  const draggingIdRef = useRef<string | null>(null);
  const wonTriggeredRef = useRef(false);

  toolsRef.current = tools;
  isRunningRef.current = isRunning;
  selectedIdRef.current = selectedId;

  useEffect(() => {
    setTools([]);
    setSelectedId(null);
    setIsRunning(false);
    orbRef.current = createInitialOrb(spec);
    wonTriggeredRef.current = false;
    const first = SANDBOX_TOOL_ORDER.find((k) => (spec.toolbox[k] ?? 0) > 0) ?? 'plank';
    setActiveToolKind(first);
  }, [spec, resetSignal]);

  const remainingToolbox = useMemo(() => {
    const counts: Record<SandboxToolKind, number> = {
      plank: spec.toolbox.plank ?? 0,
      bumper: spec.toolbox.bumper ?? 0,
      attractor: spec.toolbox.attractor ?? 0,
      repulsor: spec.toolbox.repulsor ?? 0,
      wind: spec.toolbox.wind ?? 0,
    };
    for (const t of tools) {
      counts[t.kind] = Math.max(0, counts[t.kind] - 1);
    }
    return counts;
  }, [tools, spec.toolbox]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;

    const renderScene = (now: number) => {
      const t = now * 0.001;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.floor(SANDBOX_W * dpr);
      const targetH = Math.floor(SANDBOX_H * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Deep Obsidian Cosmic Optics Arena
      const bgGrad = ctx.createRadialGradient(
        SANDBOX_W * 0.5,
        SANDBOX_H * 0.45,
        40,
        SANDBOX_W * 0.5,
        SANDBOX_H * 0.5,
        SANDBOX_W * 0.72
      );
      bgGrad.addColorStop(0, '#0D133B');
      bgGrad.addColorStop(0.65, '#070A24');
      bgGrad.addColorStop(1, '#040615');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, SANDBOX_W, SANDBOX_H);

      ctx.strokeStyle = 'rgba(130, 155, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let gx = 40; gx < SANDBOX_W; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, SANDBOX_H);
        ctx.stroke();
      }
      for (let gy = 40; gy < SANDBOX_H; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(SANDBOX_W, gy);
        ctx.stroke();
      }

      if (spec.gravityY !== 0) {
        const isUp = spec.gravityY < 0;
        ctx.strokeStyle = isUp ? 'rgba(255, 78, 198, 0.25)' : 'rgba(34, 235, 255, 0.2)';
        ctx.lineWidth = 1.8;
        for (let x = 140; x <= 680; x += 180) {
          const yOff = (t * 26) % 40;
          const cy = isUp ? SANDBOX_H - 26 - yOff : 26 + yOff;
          ctx.beginPath();
          ctx.moveTo(x - 6, cy);
          ctx.lineTo(x, isUp ? cy - 6 : cy + 6);
          ctx.lineTo(x + 6, cy);
          ctx.stroke();
        }
      }

      // Render Paired Quantum Crystal Wormhole Bridges (IN -> OUT)
      if (spec.wormholes) {
        for (const wh of spec.wormholes) {
          ctx.save();
          // Outer bridge glow + dashed energy conduit
          ctx.strokeStyle = 'rgba(179, 120, 255, 0.22)';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(wh.inX, wh.inY);
          ctx.lineTo(wh.outX, wh.outY);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(215, 165, 255, 0.72)';
          ctx.lineWidth = 2.6;
          ctx.setLineDash([8, 6]);
          ctx.lineDashOffset = -t * 28;
          ctx.beginPath();
          ctx.moveTo(wh.inX, wh.inY);
          ctx.lineTo(wh.outX, wh.outY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Flowing light spark along Wormhole bridge (IN -> OUT)
          const pulsePhase = (t * 0.7) % 1;
          const px = wh.inX + (wh.outX - wh.inX) * pulsePhase;
          const py = wh.inY + (wh.outY - wh.inY) * pulsePhase;
          const sparkGrad = ctx.createRadialGradient(px, py, 1, px, py, 14);
          sparkGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
          sparkGrad.addColorStop(0.4, 'rgba(199, 146, 255, 0.75)');
          sparkGrad.addColorStop(1, 'rgba(199, 146, 255, 0)');
          ctx.fillStyle = sparkGrad;
          ctx.beginPath();
          ctx.arc(px, py, 14, 0, Math.PI * 2);
          ctx.fill();

          // Midpoint directional arrow showing IN -> OUT bridge direction
          const mx = (wh.inX + wh.outX) / 2;
          const my = (wh.inY + wh.outY) / 2;
          const ang = Math.atan2(wh.outY - wh.inY, wh.outX - wh.inX);
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(ang);
          ctx.fillStyle = '#E5BDFF';
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(-6, -7);
          ctx.lineTo(-3, 0);
          ctx.lineTo(-6, 7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          const drawWormholeNode = (wx: number, wy: number, col: string, dir: number) => {
            ctx.save();
            ctx.translate(wx, wy);
            ctx.rotate(t * 1.4 * dir);
            ctx.fillStyle = 'rgba(18, 22, 68, 0.88)';
            ctx.strokeStyle = col;
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            for (let s = 0; s < 8; s++) {
              const a = (s * Math.PI) / 4;
              const px = Math.cos(a) * wh.r;
              const py = Math.sin(a) * wh.r;
              if (s === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(0, -9);
            ctx.lineTo(9, 0);
            ctx.lineTo(0, 9);
            ctx.lineTo(-9, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          };

          drawWormholeNode(wh.inX, wh.inY, '#FF4EC6', 1);
          drawWormholeNode(wh.outX, wh.outY, '#B378FF', -1);
          ctx.restore();
        }
      }

      for (const tool of toolsRef.current) {
        const isSel = tool.id === selectedIdRef.current;
        ctx.save();
        ctx.translate(tool.x, tool.y);

        if (isSel) {
          ctx.strokeStyle = 'rgba(255, 210, 63, 0.7)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.arc(0, 0, 38, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (tool.kind === 'attractor' || tool.kind === 'repulsor') {
          const isAttr = tool.kind === 'attractor';
          const col = isAttr ? '#22EBFF' : '#FF4EC6';
          const maxR = isAttr ? 215 : 205;
          ctx.strokeStyle = isAttr ? 'rgba(34,235,255,0.22)' : 'rgba(255,78,198,0.22)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.arc(0, 0, maxR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          const ringR = isAttr ? 54 - ((t * 28) % 36) : 18 + ((t * 28) % 36);
          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.65;
          ctx.beginPath();
          ctx.arc(0, 0, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;

          ctx.fillStyle = '#0A0F2E';
          ctx.strokeStyle = isSel ? '#FFD23F' : col;
          ctx.lineWidth = isSel ? 2.6 : 2;
          ctx.beginPath();
          for (let s = 0; s < 6; s++) {
            const ang = (s * Math.PI) / 3;
            const px = Math.cos(ang) * 20;
            const py = Math.sin(ang) * 20;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(0, -8);
          ctx.lineTo(8, 0);
          ctx.lineTo(0, 8);
          ctx.lineTo(-8, 0);
          ctx.closePath();
          ctx.fill();
        } else if (tool.kind === 'wind') {
          ctx.rotate((tool.angleDeg * Math.PI) / 180);
          ctx.fillStyle = 'rgba(45, 245, 154, 0.08)';
          ctx.strokeStyle = isSel ? '#FFD23F' : 'rgba(45, 245, 154, 0.58)';
          ctx.lineWidth = isSel ? 2.2 : 1.5;
          ctx.beginPath();
          ctx.moveTo(-4, -56);
          ctx.lineTo(176, -56);
          ctx.lineTo(190, -40);
          ctx.lineTo(190, 40);
          ctx.lineTo(176, 56);
          ctx.lineTo(-4, 56);
          ctx.lineTo(-16, 42);
          ctx.lineTo(-16, -42);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = '#2DF59A';
          ctx.lineWidth = 2.2;
          for (let i = 0; i < 4; i++) {
            const x = ((t * 100 + i * 45) % 175) + 5;
            ctx.beginPath();
            ctx.moveTo(x - 8, -14);
            ctx.lineTo(x + 5, 0);
            ctx.lineTo(x - 8, 14);
            ctx.stroke();
          }

          ctx.fillStyle = '#0A0F2E';
          ctx.strokeStyle = '#2DF59A';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let s = 0; s < 6; s++) {
            const ang = (s * Math.PI) / 3;
            const px = Math.cos(ang) * 15;
            const py = Math.sin(ang) * 15;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (tool.kind === 'bumper') {
          ctx.fillStyle = 'rgba(255, 210, 63, 0.22)';
          ctx.strokeStyle = isSel ? '#FFFFFF' : '#FFD23F';
          ctx.lineWidth = isSel ? 3 : 2.2;
          ctx.beginPath();
          for (let s = 0; s < 8; s++) {
            const ang = (s * Math.PI) / 4;
            const px = Math.cos(ang) * 26;
            const py = Math.sin(ang) * 26;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFD23F';
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(10, 0);
          ctx.lineTo(0, 10);
          ctx.lineTo(-10, 0);
          ctx.closePath();
          ctx.fill();
        } else if (tool.kind === 'plank') {
          ctx.rotate((tool.angleDeg * Math.PI) / 180);
          ctx.fillStyle = '#18C8E0';
          ctx.strokeStyle = isSel ? '#FFD23F' : '#BAFBFF';
          ctx.lineWidth = isSel ? 2.4 : 1.7;
          ctx.beginPath();
          ctx.moveTo(-62, -7);
          ctx.lineTo(62, -7);
          ctx.lineTo(70, 0);
          ctx.lineTo(62, 7);
          ctx.lineTo(-62, 7);
          ctx.lineTo(-70, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-58, 0);
          ctx.lineTo(58, 0);
          ctx.stroke();
        }

        ctx.restore();
      }

      // Faceted Obsidian Cosmic Crystal Obstacles (replacing cartoon cratered asteroids)
      for (const ast of spec.asteroids) {
        ctx.save();
        ctx.translate(ast.x, ast.y);

        // Outer crystalline hexagon facet
        ctx.fillStyle = '#141B4D';
        ctx.strokeStyle = '#8492E8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const ang = (s * Math.PI) / 3 - Math.PI / 6;
          const rad = ast.r * (s % 2 === 0 ? 1.02 : 0.94);
          const px = Math.cos(ang) * rad;
          const py = Math.sin(ang) * rad;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Lit top-left crystal cleavage plane
        ctx.fillStyle = 'rgba(130, 152, 255, 0.28)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(-Math.PI / 6) * ast.r, Math.sin(-Math.PI / 6) * ast.r);
        ctx.lineTo(Math.cos(-Math.PI / 2) * ast.r, Math.sin(-Math.PI / 2) * ast.r);
        ctx.lineTo(Math.cos((-5 * Math.PI) / 6) * ast.r, Math.sin((-5 * Math.PI) / 6) * ast.r);
        ctx.closePath();
        ctx.fill();

        // Inner crystal lattice facets
        ctx.strokeStyle = 'rgba(185, 200, 255, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const ang = (s * Math.PI) / 3 - Math.PI / 6;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * ast.r * 0.96, Math.sin(ang) * ast.r * 0.96);
        }
        ctx.stroke();

        ctx.restore();
      }

      // Unmistakable Luminous Goal Target Beacon (Volumetric Radial Light + Emerald Star-Target + Corner Brackets)
      const p = spec.portal;
      const goalPulse = 1 + Math.sin(t * 3.2) * 0.08;
      ctx.save();
      ctx.translate(p.x, p.y);

      // Volumetric radial light bloom illuminating surrounding arena
      const goalGlow = ctx.createRadialGradient(0, 0, 4, 0, 0, p.r * 2.75 * goalPulse);
      goalGlow.addColorStop(0, 'rgba(180, 255, 224, 0.52)');
      goalGlow.addColorStop(0.35, 'rgba(45, 245, 154, 0.36)');
      goalGlow.addColorStop(0.7, 'rgba(45, 245, 154, 0.12)');
      goalGlow.addColorStop(1, 'rgba(45, 245, 154, 0)');
      ctx.fillStyle = goalGlow;
      ctx.beginPath();
      ctx.arc(0, 0, p.r * 2.75 * goalPulse, 0, Math.PI * 2);
      ctx.fill();

      // Rotating soft light rays behind the Goal beacon
      ctx.save();
      ctx.rotate(t * 0.45);
      for (let ray = 0; ray < 6; ray++) {
        ctx.rotate(Math.PI / 3);
        ctx.fillStyle = 'rgba(45, 245, 154, 0.12)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-9, -p.r * 1.9);
        ctx.lineTo(9, -p.r * 1.9);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Expanding beacon shockwave ring
      const wavePhase = (t * 0.65) % 1;
      ctx.strokeStyle = `rgba(45, 245, 154, ${(1 - wavePhase) * 0.65})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, p.r + wavePhase * 28, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(45, 245, 154, 0.38)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, (p.r + 9) * goalPulse, 0, Math.PI * 2);
      ctx.stroke();

      // 4 inward corner target brackets
      const br = p.r + 12;
      ctx.strokeStyle = '#6BFFBF';
      ctx.lineWidth = 2.8;
      for (let q = 0; q < 4; q++) {
        ctx.save();
        ctx.rotate((q * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(-br, -br + 9);
        ctx.lineTo(-br, -br);
        ctx.lineTo(-br + 9, -br);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.rotate(t * 0.9);
      ctx.strokeStyle = '#2DF59A';
      ctx.lineWidth = 2.8;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(45, 245, 154, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, p.r - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Orbiting light motes circling the Goal Star
      for (let m = 0; m < 3; m++) {
        const ma = t * 2.1 + (m * Math.PI * 2) / 3;
        const mx = Math.cos(ma) * (p.r + 4);
        const my = Math.sin(ma) * (p.r + 4);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(mx, my, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Central 4-point Goal Star
      ctx.fillStyle = '#2DF59A';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        const rad = i % 2 === 0 ? p.r * 0.56 : p.r * 0.23;
        const sx = Math.cos(a) * rad;
        const sy = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Unmistakable Start Launch Pad (Radiant Cyan Halo + Launcher + Play Chevron)
      const l = spec.launcher;
      const launchAngle = Math.atan2(l.vy, l.vx);
      ctx.save();
      ctx.translate(l.x, l.y);

      const startGlow = ctx.createRadialGradient(0, 0, 4, 0, 0, 48);
      startGlow.addColorStop(0, 'rgba(34, 235, 255, 0.34)');
      startGlow.addColorStop(1, 'rgba(34, 235, 255, 0)');
      ctx.fillStyle = startGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(34, 235, 255, 0.42)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 28 + Math.sin(t * 3) * 2.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(launchAngle);
      ctx.fillStyle = '#0B163F';
      ctx.strokeStyle = '#22EBFF';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-18, -14);
      ctx.lineTo(18, -9);
      ctx.lineTo(28, 0);
      ctx.lineTo(18, 9);
      ctx.lineTo(-18, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner bright Play / Forward arrow inside the start launcher
      ctx.fillStyle = '#22EBFF';
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(8, 0);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();

      // Short nozzle direction chevron (without revealing ball path!)
      ctx.strokeStyle = 'rgba(34, 235, 255, 0.85)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(33, -6);
      ctx.lineTo(40, 0);
      ctx.lineTo(33, 6);
      ctx.stroke();
      ctx.restore();

      const orb = orbRef.current;

      // Spinning faceted crystal energy core (zero flat cartoon circles)
      ctx.save();
      ctx.translate(orb.x, orb.y);
      ctx.rotate(t * 2.2);

      ctx.fillStyle = orb.won ? 'rgba(45, 245, 154, 0.28)' : 'rgba(34, 235, 255, 0.28)';
      ctx.beginPath();
      for (let s = 0; s < 8; s++) {
        const ang = (s * Math.PI) / 4;
        const rad = s % 2 === 0 ? ORB_RADIUS + 8 : ORB_RADIUS + 2;
        const px = Math.cos(ang) * rad;
        const py = Math.sin(ang) * rad;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = orb.won ? '#2DF59A' : '#22EBFF';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let s = 0; s < 6; s++) {
        const ang = (s * Math.PI) / 3;
        const px = Math.cos(ang) * (ORB_RADIUS + 1);
        const py = Math.sin(ang) * (ORB_RADIUS + 1);
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const tickLoop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const clampedDt = Math.min(rawDt, 0.05);

      if (isRunningRef.current && !orbRef.current.won && !orbRef.current.outOfBounds) {
        accumulator += clampedDt;
        const fixedStep = 1 / 60;
        while (accumulator >= fixedStep) {
          orbRef.current = stepSandboxPhysics(spec, orbRef.current, toolsRef.current, fixedStep);
          accumulator -= fixedStep;
          if (orbRef.current.won) {
            if (!wonTriggeredRef.current) {
              wonTriggeredRef.current = true;
              cosmicSound.playVictory();
              setTimeout(() => onWin(), 450);
            }
            break;
          }
          if (orbRef.current.outOfBounds) {
            cosmicSound.playSoftError();
            setIsRunning(false);
            break;
          }
        }
      }

      renderScene(now);
      rafId = requestAnimationFrame(tickLoop);
    };

    rafId = requestAnimationFrame(tickLoop);
    return () => cancelAnimationFrame(rafId);
  }, [spec, onWin]);

  const toLogicalCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * SANDBOX_W,
      y: ((clientY - rect.top) / rect.height) * SANDBOX_H,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isRunning) return;
    const { x, y } = toLogicalCoords(e.clientX, e.clientY);

    const hit = [...tools].reverse().find((t) => Math.hypot(t.x - x, t.y - y) <= 36);
    if (hit) {
      setSelectedId(hit.id);
      draggingIdRef.current = hit.id;
      e.currentTarget.setPointerCapture(e.pointerId);
      cosmicSound.playClick();
      return;
    }

    if (
      Math.hypot(x - spec.launcher.x, y - spec.launcher.y) < 48 ||
      Math.hypot(x - spec.portal.x, y - spec.portal.y) < 48 ||
      spec.asteroids.some((a) => Math.hypot(x - a.x, y - a.y) < a.r + 22) ||
      Boolean(
        spec.wormholes?.some(
          (w) =>
            Math.hypot(x - w.inX, y - w.inY) < w.r + 18 ||
            Math.hypot(x - w.outX, y - w.outY) < w.r + 18
        )
      )
    ) {
      return;
    }

    if (remainingToolbox[activeToolKind] > 0) {
      const id = `${activeToolKind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newTool: PlacedTool = {
        id,
        kind: activeToolKind,
        x: Math.max(40, Math.min(SANDBOX_W - 40, x)),
        y: Math.max(40, Math.min(SANDBOX_H - 40, y)),
        angleDeg: activeToolKind === 'wind' ? -20 : 0,
      };
      setTools((prev) => [...prev, newTool]);
      setSelectedId(id);
      draggingIdRef.current = id;
      e.currentTarget.setPointerCapture(e.pointerId);
      cosmicSound.playPlace();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const dragId = draggingIdRef.current;
    if (!dragId || isRunning) return;
    const { x, y } = toLogicalCoords(e.clientX, e.clientY);
    setTools((prev) =>
      prev.map((t) =>
        t.id === dragId
          ? {
              ...t,
              x: Math.max(36, Math.min(SANDBOX_W - 36, x)),
              y: Math.max(36, Math.min(SANDBOX_H - 36, y)),
            }
          : t
      )
    );
  };

  const handlePointerUp = () => {
    draggingIdRef.current = null;
  };

  const selectedTool = tools.find((t) => t.id === selectedId);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!selectedTool || isRunning) return;
    if (selectedTool.kind !== 'plank' && selectedTool.kind !== 'wind') return;
    const delta = e.deltaY > 0 ? 10 : -10;
    setTools((prev) =>
      prev.map((t) => (t.id === selectedTool.id ? { ...t, angleDeg: t.angleDeg + delta } : t))
    );
  };

  const handleRunToggle = () => {
    if (isRunning) {
      setIsRunning(false);
      orbRef.current = createInitialOrb(spec);
      wonTriggeredRef.current = false;
    } else {
      orbRef.current = createInitialOrb(spec);
      wonTriggeredRef.current = false;
      setIsRunning(true);
      cosmicSound.playPulse();
    }
  };

  const rotateSelected = (deltaDeg: number) => {
    if (!selectedId || isRunning) return;
    cosmicSound.playClick();
    setTools((prev) =>
      prev.map((t) => (t.id === selectedId ? { ...t, angleDeg: t.angleDeg + deltaDeg } : t))
    );
  };

  const deleteSelected = () => {
    if (!selectedId || isRunning) return;
    cosmicSound.playClick();
    setTools((prev) => prev.filter((t) => t.id !== selectedId));
    setSelectedId(null);
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-between gap-3 py-2">
      {/* Main Physics Viewport */}
      <div className="flex-1 w-full flex items-center justify-center min-h-0">
        <div className="w-[min(100%,820px,calc((100dvh-195px)*1.6))]">
          <AspectRatio.Root ratio={SANDBOX_W / SANDBOX_H}>
            <div className="relative w-full h-full rounded-2xl overflow-hidden border border-[#2DF59A]/50 cosmo-panel">
              <canvas
                ref={canvasRef}
                data-testid="sandbox-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onWheel={handleWheel}
                className="w-full h-full block touch-none cursor-crosshair"
              />
            </div>
          </AspectRatio.Root>
        </div>
      </div>

      {/* Sharp Crystalline Physics Sandbox Dock */}
      <Toolbar.Root
        aria-label="Physics Sandbox Dock"
        className="flex flex-wrap items-center justify-center gap-2 p-2 rounded-2xl cosmo-panel border border-[#2DF59A]/35"
      >
        <ToggleGroup.Root
          type="single"
          disabled={isRunning}
          value={activeToolKind}
          onValueChange={(val) => {
            if (!val) return;
            cosmicSound.playClick();
            setActiveToolKind(val as SandboxToolKind);
          }}
          aria-label="Sandbox Materials"
          className="flex items-center gap-2"
        >
          {SANDBOX_TOOL_ORDER.filter((k) => (spec.toolbox[k] ?? 0) > 0).map((kind) => {
            const left = remainingToolbox[kind];
            return (
              <ToggleGroup.Item
                key={kind}
                value={kind}
                disabled={isRunning}
                aria-label={`Select ${kind} tool (${left} left)`}
                className="relative w-12 h-12 rounded-xl border flex items-center justify-center transition-all cursor-pointer disabled:opacity-45 cosmo-tile bg-[#080B26] border-indigo-300/30 text-indigo-100 hover:border-[#2DF59A]/75 data-[state=on]:bg-[#0D3030] data-[state=on]:border-[#2DF59A] data-[state=on]:text-[#2DF59A] data-[state=on]:shadow-[0_0_24px_oklch(0.86_0.19_158_/_0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DF59A]"
              >
                <ToolIcon kind={kind} className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-md bg-[#0E1542] border border-[#2DF59A]/70 text-[11px] font-extrabold tabular-nums text-[#2DF59A] flex items-center justify-center">
                  {left}
                </span>
              </ToggleGroup.Item>
            );
          })}
        </ToggleGroup.Root>

        {selectedTool && (
          <>
            <Separator.Root orientation="vertical" className="w-px h-8 bg-indigo-300/25" />
            <div className="flex items-center gap-1.5">
              {(selectedTool.kind === 'plank' || selectedTool.kind === 'wind') && (
                <>
                  <Toolbar.Button
                    type="button"
                    disabled={isRunning}
                    onClick={() => rotateSelected(-15)}
                    aria-label="Rotate tool counter-clockwise"
                    className="w-10 h-11 rounded-xl bg-[#0C1236] border border-[#FFD23F]/60 hover:border-[#FFD23F] text-[#FFD23F] flex items-center justify-center cursor-pointer disabled:opacity-40 cosmo-btn-3d transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Toolbar.Button>
                  <Toolbar.Button
                    type="button"
                    disabled={isRunning}
                    onClick={() => rotateSelected(15)}
                    aria-label="Rotate tool clockwise"
                    className="w-10 h-11 rounded-xl bg-[#0C1236] border border-[#FFD23F]/60 hover:border-[#FFD23F] text-[#FFD23F] flex items-center justify-center cursor-pointer disabled:opacity-40 cosmo-btn-3d transition-colors"
                  >
                    <RotateCw className="w-4 h-4" />
                  </Toolbar.Button>
                </>
              )}
              <Toolbar.Button
                type="button"
                disabled={isRunning}
                onClick={deleteSelected}
                aria-label="Delete selected tool"
                className="w-10 h-11 rounded-xl bg-[#42102E] border border-[#FF4EC6]/70 hover:border-[#FF4EC6] text-[#FF4EC6] flex items-center justify-center cursor-pointer disabled:opacity-40 cosmo-btn-3d transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </Toolbar.Button>
            </div>
          </>
        )}

        <Separator.Root orientation="vertical" className="w-px h-8 bg-indigo-300/25" />

        <Toolbar.Button
          type="button"
          onClick={handleRunToggle}
          aria-label={isRunning ? 'Stop physics' : 'Launch orb'}
          className={`h-12 px-6 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
            isRunning
              ? 'bg-gradient-to-r from-[#FFD23F] to-[#FF8A3D] text-[#050819] shadow-[0_0_28px_oklch(0.89_0.17_84_/_0.48)]'
              : 'bg-gradient-to-r from-[#2DF59A] to-[#22EBFF] text-[#050819] shadow-[0_0_30px_oklch(0.86_0.19_158_/_0.5)]'
          }`}
        >
          {isRunning ? <Square className="w-5.5 h-5.5 fill-current" /> : <Play className="w-5.5 h-5.5 fill-current" />}
        </Toolbar.Button>
      </Toolbar.Root>
    </div>
  );
}
