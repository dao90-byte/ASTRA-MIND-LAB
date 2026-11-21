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

export interface WormholePair {
  inX: number;
  inY: number;
  outX: number;
  outY: number;
  r: number;
}

export interface SandboxToolbox {
  plank?: number;
  bumper?: number;
  attractor?: number;
  repulsor?: number;
  wind?: number;
}

export type SandboxStageNumber = 4 | 8 | 13 | 18 | 23 | 28;

export interface SandboxStageSpec {
  id: string;
  age: AgeGroup;
  stageNumber: SandboxStageNumber;
  gravityY: number;
  launcher: { x: number; y: number; vx: number; vy: number };
  portal: { x: number; y: number; r: number };
  asteroids: AsteroidObstacle[];
  wormholes?: WormholePair[];
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
  wormholeCooldown?: number;
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
    wormholeCooldown: 0,
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
  let wormholeCooldown = Math.max(0, (orb.wormholeCooldown ?? 0) - 1);

  // 1. Base cosmic gravity (can be downward > 0, zero = 0, or inverted anti-gravity < 0)
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

  // 2b. Quantum Wormhole Teleportation
  if (spec.wormholes && wormholeCooldown === 0) {
    for (const wh of spec.wormholes) {
      const dIn = Math.hypot(x - wh.inX, y - wh.inY);
      if (dIn <= wh.r + ORB_RADIUS * 0.45) {
        x = wh.outX;
        y = wh.outY;
        vy *= 0.35;
        wormholeCooldown = 24;
        break;
      }
    }
  }

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

  return { x, y, vx, vy, trail, won, outOfBounds, ticks, wormholeCooldown };
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

export function getSandboxStage(
  age: AgeGroup,
  stageNumber: SandboxStageNumber
): SandboxStageSpec {
  if (age === 7 && stageNumber === 4) {
    return {
      id: 'sb-7-4',
      age: 7,
      stageNumber: 4,
      gravityY: 220,
      launcher: { x: 90, y: 200, vx: 215, vy: -40 },
      portal: { x: 690, y: 290, r: 34 },
      asteroids: [{ x: 400, y: 410, r: 46 }],
      toolbox: {
        plank: 2,
        bumper: 1,
        wind: 1,
        attractor: 1,
      },
    };
  }

  if (age === 7 && stageNumber === 8) {
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

  if (age === 7 && stageNumber === 13) {
    // Inverted Anti-Gravity + Quantum Wormhole Shortcut
    return {
      id: 'sb-7-13',
      age: 7,
      stageNumber: 13,
      gravityY: -150,
      launcher: { x: 90, y: 350, vx: 225, vy: 20 },
      portal: { x: 695, y: 125, r: 36 },
      asteroids: [{ x: 410, y: 220, r: 48 }],
      wormholes: [{ inX: 330, inY: 400, outX: 540, outY: 140, r: 30 }],
      toolbox: {
        plank: 2,
        wind: 2,
        attractor: 1,
        bumper: 1,
      },
    };
  }

  if (age === 7 && stageNumber === 18) {
    // Twin-Crystal Canyon Slalom
    return {
      id: 'sb-7-18',
      age: 7,
      stageNumber: 18,
      gravityY: 180,
      launcher: { x: 85, y: 150, vx: 230, vy: -20 },
      portal: { x: 700, y: 220, r: 36 },
      asteroids: [
        { x: 370, y: 165, r: 44 },
        { x: 530, y: 360, r: 42 },
      ],
      toolbox: {
        plank: 2,
        bumper: 2,
        wind: 2,
        attractor: 1,
      },
    };
  }

  if (age === 9 && stageNumber === 4) {
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

  if (age === 9 && stageNumber === 8) {
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

  if (age === 9 && stageNumber === 13) {
    // Inverted Anti-Gravity + Wormhole Slingshot
    return {
      id: 'sb-9-13',
      age: 9,
      stageNumber: 13,
      gravityY: -175,
      launcher: { x: 85, y: 380, vx: 235, vy: 0 },
      portal: { x: 705, y: 355, r: 34 },
      asteroids: [
        { x: 380, y: 235, r: 52 },
        { x: 560, y: 145, r: 42 },
      ],
      wormholes: [{ inX: 350, inY: 410, outX: 545, outY: 385, r: 28 }],
      toolbox: {
        plank: 2,
        wind: 2,
        attractor: 2,
        repulsor: 1,
        bumper: 1,
      },
    };
  }

  if (age === 9 && stageNumber === 18) {
    // Age 9, Stage 18: Grand Zero-G Diamond Fortress & Quantum Wormhole
    return {
      id: 'sb-9-18',
      age: 9,
      stageNumber: 18,
      gravityY: 0,
      launcher: { x: 85, y: 250, vx: 240, vy: 0 },
      portal: { x: 710, y: 250, r: 34 },
      asteroids: [
        { x: 340, y: 250, r: 48 },
        { x: 500, y: 145, r: 38 },
        { x: 500, y: 355, r: 38 },
      ],
      wormholes: [{ inX: 340, inY: 95, outX: 575, outY: 250, r: 28 }],
      toolbox: {
        plank: 2,
        bumper: 2,
        attractor: 2,
        repulsor: 2,
        wind: 2,
      },
    };
  }

  if (age === 7 && stageNumber === 23) {
    // Age 7, Stage 23: Twin-Wormhole Gravity Ricochet
    return {
      id: 'sb-7-23',
      age: 7,
      stageNumber: 23,
      gravityY: 110,
      launcher: { x: 85, y: 130, vx: 225, vy: 0 },
      portal: { x: 695, y: 375, r: 36 },
      asteroids: [
        { x: 380, y: 215, r: 46 },
        { x: 530, y: 270, r: 40 },
      ],
      wormholes: [
        { inX: 285, inY: 340, outX: 465, outY: 115, r: 28 },
        { inX: 615, inY: 145, outX: 590, outY: 375, r: 28 },
      ],
      toolbox: {
        plank: 2,
        bumper: 2,
        wind: 2,
        attractor: 1,
      },
    };
  }

  if (age === 7 && stageNumber === 28) {
    // Age 7, Stage 28: Supernova Dual-Gate Canyon
    return {
      id: 'sb-7-28',
      age: 7,
      stageNumber: 28,
      gravityY: 135,
      launcher: { x: 85, y: 260, vx: 230, vy: -30 },
      portal: { x: 705, y: 165, r: 36 },
      asteroids: [
        { x: 350, y: 245, r: 46 },
        { x: 515, y: 155, r: 38 },
        { x: 525, y: 365, r: 42 },
      ],
      wormholes: [{ inX: 355, inY: 390, outX: 595, outY: 235, r: 30 }],
      toolbox: {
        plank: 2,
        bumper: 2,
        wind: 2,
        attractor: 1,
        repulsor: 1,
      },
    };
  }

  if (age === 9 && stageNumber === 23) {
    // Age 9, Stage 23: Anti-Gravity Twin-Wormhole Slingshot
    return {
      id: 'sb-9-23',
      age: 9,
      stageNumber: 23,
      gravityY: -185,
      launcher: { x: 85, y: 370, vx: 235, vy: 0 },
      portal: { x: 710, y: 130, r: 34 },
      asteroids: [
        { x: 340, y: 230, r: 48 },
        { x: 510, y: 285, r: 46 },
        { x: 625, y: 260, r: 34 },
      ],
      wormholes: [
        { inX: 290, inY: 115, outX: 440, outY: 395, r: 28 },
        { inX: 605, inY: 390, outX: 590, outY: 130, r: 28 },
      ],
      toolbox: {
        plank: 2,
        bumper: 2,
        wind: 2,
        attractor: 2,
        repulsor: 1,
      },
    };
  }

  // Age 9, Stage 28: Grand Supernova Zero-G Twin-Wormhole Finale
  return {
    id: 'sb-9-28',
    age: 9,
    stageNumber: 28,
    gravityY: 0,
    launcher: { x: 80, y: 250, vx: 245, vy: 0 },
    portal: { x: 715, y: 250, r: 34 },
    asteroids: [
      { x: 315, y: 250, r: 46 },
      { x: 470, y: 155, r: 42 },
      { x: 470, y: 345, r: 42 },
      { x: 585, y: 250, r: 44 },
    ],
    wormholes: [
      { inX: 315, inY: 95, outX: 470, outY: 430, r: 28 },
      { inX: 635, inY: 405, outX: 650, outY: 165, r: 28 },
    ],
    toolbox: {
      plank: 2,
      bumper: 2,
      attractor: 2,
      repulsor: 2,
      wind: 2,
    },
  };
}
