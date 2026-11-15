import { AgeGroup } from './types';

export const SANDBOX_W = 800;
export const SANDBOX_H = 500;
export const ORB_RADIUS = 14;

export type SandboxToolKind = 'plank' | 'bumper' | 'attractor' | 'repulsor' | 'wind';

export interface PlacedTool {
  id: string;
  kind: SandboxToolKind;
  x: number;
  y: number;
  angleDeg: number; // used for plank and wind
}

export interface AsteroidObstacle {
  x: number;
  y: number;
  r: number;
}

export interface SandboxToolbox {
  plank?: number;
  bumper?: number;
  attractor?: number;
  repulsor?: number;
  wind?: number;
}

export interface SandboxStageSpec {
  id: string;
  age: AgeGroup;
  stageNumber: 4 | 8;
  gravityY: number;
  launcher: { x: number; y: number; vx: number; vy: number };
  portal: { x: number; y: number; r: number };
  asteroids: AsteroidObstacle[];
  toolbox: SandboxToolbox;
}

export interface OrbState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: Array<{ x: number; y: number }>;
  won: boolean;
  outOfBounds: boolean;
  ticks: number;
}

export function createInitialOrb(spec: SandboxStageSpec): OrbState {
  return {
    x: spec.launcher.x,
    y: spec.launcher.y,
    vx: spec.launcher.vx,
    vy: spec.launcher.vy,
    trail: [{ x: spec.launcher.x, y: spec.launcher.y }],
    won: false,
    outOfBounds: false,
    ticks: 0,
  };
}

function clampSpeed(vx: number, vy: number, maxSpeed = 540): [number, number] {
  const spd = Math.hypot(vx, vy);
  if (spd > maxSpeed) {
    const scale = maxSpeed / spd;
    return [vx * scale, vy * scale];
  }
  return [vx, vy];
}

export function stepSandboxPhysics(
  spec: SandboxStageSpec,
  orb: OrbState,
  tools: PlacedTool[],
  dt = 1 / 60
): OrbState {
  if (orb.won || orb.outOfBounds) return orb;

  let { x, y, vx, vy } = orb;

  // 1. Base cosmic gravity
  vy += spec.gravityY * dt;

  // 2. Continuous field forces (attractor, repulsor, wind)
  for (const tool of tools) {
    if (tool.kind === 'attractor' || tool.kind === 'repulsor') {
      const dx = tool.x - x;
      const dy = tool.y - y;
      const dist = Math.hypot(dx, dy);
      const maxR = tool.kind === 'attractor' ? 215 : 205;
      if (dist > 14 && dist < maxR) {
        const nx = dx / dist;
        const ny = dy / dist;
        const falloff = 1 - dist / maxR;
        const mag = (tool.kind === 'attractor' ? 860 : -900) * (0.4 + falloff * 0.9);
        vx += nx * mag * dt;
        vy += ny * mag * dt;
      }
    } else if (tool.kind === 'wind') {
      const rad = (tool.angleDeg * Math.PI) / 180;
      const dirX = Math.cos(rad);
      const dirY = Math.sin(rad);
      const relX = x - tool.x;
      const relY = y - tool.y;
      // Local aligned box: along dir [-20..200], perpendicular [-64..64]
      const along = relX * dirX + relY * dirY;
      const perp = -relX * dirY + relY * dirX;
      if (along >= -20 && along <= 200 && Math.abs(perp) <= 64) {
        vx += dirX * 920 * dt;
        vy += dirY * 920 * dt;
      }
    }
  }

  // Clamp velocity before position integration
  [vx, vy] = clampSpeed(vx, vy);

  // Integrate position
  x += vx * dt;
  y += vy * dt;

  // 3. Asteroid collisions
  for (const ast of spec.asteroids) {
    const dx = x - ast.x;
    const dy = y - ast.y;
    const dist = Math.hypot(dx, dy);
    const minDist = ast.r + ORB_RADIUS;
    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      x = ast.x + nx * minDist;
      y = ast.y + ny * minDist;
      const vn = vx * nx + vy * ny;
      if (vn < 0) {
        vx -= (1 + 0.58) * vn * nx;
        vy -= (1 + 0.58) * vn * ny;
      }
    }
  }

  // 4. Placed tool solid collisions (plank, bumper)
  for (const tool of tools) {
    if (tool.kind === 'bumper') {
      const bumperR = 26;
      const dx = x - tool.x;
      const dy = y - tool.y;
      const dist = Math.hypot(dx, dy);
      const minDist = bumperR + ORB_RADIUS;
      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;
        x = tool.x + nx * minDist;
        y = tool.y + ny * minDist;
        const vn = vx * nx + vy * ny;
        if (vn < 0) {
          vx -= (1 + 1.24) * vn * nx;
          vy -= (1 + 1.24) * vn * ny;
        } else {
          vx += nx * 160;
          vy += ny * 160;
        }
        [vx, vy] = clampSpeed(vx, vy);
      }
    } else if (tool.kind === 'plank') {
      const halfLen = 68;
      const thickness = 8;
      const rad = (tool.angleDeg * Math.PI) / 180;
      const ux = Math.cos(rad);
      const uy = Math.sin(rad);
      const rx = x - tool.x;
      const ry = y - tool.y;
      const proj = Math.max(-halfLen, Math.min(halfLen, rx * ux + ry * uy));
      const closestX = tool.x + ux * proj;
      const closestY = tool.y + uy * proj;
      const dx = x - closestX;
      const dy = y - closestY;
      const dist = Math.hypot(dx, dy);
      const minDist = ORB_RADIUS + thickness;
      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;
        x = closestX + nx * minDist;
        y = closestY + ny * minDist;
        const vn = vx * nx + vy * ny;
        if (vn < 0) {
          vx -= (1 + 0.85) * vn * nx;
          vy -= (1 + 0.85) * vn * ny;
        }
      }
    }
  }

  // 5. Portal win check
  const pDist = Math.hypot(x - spec.portal.x, y - spec.portal.y);
  const won = pDist <= spec.portal.r + ORB_RADIUS * 0.45;

  // 6. Out of bounds check (allow generous top/side arc, stop if far outside)
  const outOfBounds =
    !won && (x < -90 || x > SANDBOX_W + 90 || y > SANDBOX_H + 90 || y < -240);

  const ticks = orb.ticks + 1;
  const trail =
    ticks % 3 === 0 || won
      ? [...orb.trail.slice(-65), { x, y }]
      : orb.trail;

  return { x, y, vx, vy, trail, won, outOfBounds, ticks };
}

export function simulateFullSandboxRun(
  spec: SandboxStageSpec,
  tools: PlacedTool[],
  maxTicks = 720
): OrbState {
  let state = createInitialOrb(spec);
  for (let i = 0; i < maxTicks; i++) {
    state = stepSandboxPhysics(spec, state, tools);
    if (state.won || state.outOfBounds) break;
  }
  return state;
}

export function getSandboxStage(age: AgeGroup, stageNumber: 4 | 8): SandboxStageSpec {
  if (age === 7 && stageNumber === 4) {
    // Open chasm crossing: orb launches right & slightly up, falls into gap unless helped by plank, wind, bumper, or attractor
    return {
      id: 'sb-7-4',
      age: 7,
      stageNumber: 4,
      gravityY: 220,
      launcher: { x: 90, y: 200, vx: 215, vy: -40 },
      portal: { x: 690, y: 290, r: 34 },
      asteroids: [
        { x: 400, y: 410, r: 46 },
      ],
      toolbox: {
        plank: 2,
        bumper: 1,
        wind: 1,
        attractor: 1,
      },
    };
  }

  if (age === 7 && stageNumber === 8) {
    // High orbital ledge: portal sits high on the right behind a mid-air asteroid
    return {
      id: 'sb-7-8',
      age: 7,
      stageNumber: 8,
      gravityY: 140,
      launcher: { x: 90, y: 310, vx: 220, vy: -80 },
      portal: { x: 685, y: 175, r: 36 },
      asteroids: [
        { x: 390, y: 225, r: 42 },
        { x: 560, y: 350, r: 36 },
      ],
      toolbox: {
        plank: 2,
        wind: 2,
        bumper: 2,
        attractor: 1,
      },
    };
  }

  if (age === 9 && stageNumber === 4) {
    // Dual-barrier nebula slalom
    return {
      id: 'sb-9-4',
      age: 9,
      stageNumber: 4,
      gravityY: 165,
      launcher: { x: 85, y: 150, vx: 235, vy: 0 },
      portal: { x: 705, y: 350, r: 32 },
      asteroids: [
        { x: 310, y: 165, r: 50 },
        { x: 510, y: 330, r: 52 },
      ],
      toolbox: {
        plank: 2,
        bumper: 2,
        attractor: 2,
        repulsor: 1,
        wind: 1,
      },
    };
  }

  // Age 9, Stage 8: Zero-G Slingshot Orbit around central twin asteroids
  return {
    id: 'sb-9-8',
    age: 9,
    stageNumber: 8,
    gravityY: 0,
    launcher: { x: 90, y: 250, vx: 235, vy: 0 },
    portal: { x: 705, y: 250, r: 34 },
    asteroids: [
      { x: 400, y: 250, r: 56 },
      { x: 400, y: 105, r: 28 },
    ],
    toolbox: {
      attractor: 2,
      repulsor: 2,
      plank: 2,
      bumper: 2,
      wind: 1,
    },
  };
}
