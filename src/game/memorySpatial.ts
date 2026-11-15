import { AgeGroup } from './types';

export interface MazeCoord {
  r: number;
  c: number;
}

export type MemoryStageNumber = 3 | 11 | 16;

export interface MemoryMazeSpec {
  id: string;
  age: AgeGroup;
  stageNumber: MemoryStageNumber;
  rows: number;
  cols: number;
  observeMs: number;
  start: MazeCoord;
  goal: MazeCoord;
  safePath: MazeCoord[]; // Ordered constellation path from start to goal
  decoyCells?: MazeCoord[]; // Isolated distractor stars shown during observe phase
  waypoints?: MazeCoord[]; // Key harmonic crystal checkpoints along safePath
}

export interface Voxel {
  x: number;
  y: number;
  z: number;
  accent: 'cyan' | 'amber' | 'violet' | 'mint';
}

export type Axis3D = 'x' | 'y' | 'z';
export type Spatial3DStageNumber = 7 | 12 | 17;

export interface Spatial3DSpec {
  id: string;
  age: AgeGroup;
  stageNumber: Spatial3DStageNumber;
  target: Voxel[];
  initial: Voxel[];
}

export function getMemoryMazeStage(
  age: AgeGroup,
  stageNumber: MemoryStageNumber = 3
): MemoryMazeSpec {
  if (age === 7 && stageNumber === 3) {
    return {
      id: 'mem-7-3',
      age: 7,
      stageNumber: 3,
      rows: 4,
      cols: 4,
      observeMs: 3600,
      start: { r: 3, c: 0 },
      goal: { r: 0, c: 3 },
      safePath: [
        { r: 3, c: 0 },
        { r: 2, c: 0 },
        { r: 2, c: 1 },
        { r: 1, c: 1 },
        { r: 1, c: 2 },
        { r: 0, c: 2 },
        { r: 0, c: 3 },
      ],
    };
  }

  if (age === 7 && stageNumber === 11) {
    return {
      id: 'mem-7-11',
      age: 7,
      stageNumber: 11,
      rows: 4,
      cols: 4,
      observeMs: 4100,
      start: { r: 3, c: 3 },
      goal: { r: 2, c: 0 },
      safePath: [
        { r: 3, c: 3 },
        { r: 2, c: 3 },
        { r: 1, c: 3 },
        { r: 0, c: 3 },
        { r: 0, c: 2 },
        { r: 0, c: 1 },
        { r: 1, c: 1 },
        { r: 2, c: 1 },
        { r: 2, c: 0 },
      ],
      decoyCells: [
        { r: 2, c: 2 },
        { r: 0, c: 0 },
      ],
      waypoints: [
        { r: 0, c: 3 },
        { r: 2, c: 1 },
      ],
    };
  }

  if (age === 7 && stageNumber === 16) {
    return {
      id: 'mem-7-16',
      age: 7,
      stageNumber: 16,
      rows: 5,
      cols: 5,
      observeMs: 4500,
      start: { r: 4, c: 0 },
      goal: { r: 2, c: 4 },
      safePath: [
        { r: 4, c: 0 },
        { r: 3, c: 0 },
        { r: 2, c: 0 },
        { r: 1, c: 0 },
        { r: 0, c: 0 },
        { r: 0, c: 1 },
        { r: 0, c: 2 },
        { r: 1, c: 2 },
        { r: 2, c: 2 },
        { r: 2, c: 3 },
        { r: 2, c: 4 },
      ],
      decoyCells: [
        { r: 2, c: 1 },
        { r: 4, c: 2 },
        { r: 0, c: 4 },
      ],
      waypoints: [
        { r: 0, c: 0 },
        { r: 2, c: 2 },
      ],
    };
  }

  if (age === 9 && stageNumber === 3) {
    return {
      id: 'mem-9-3',
      age: 9,
      stageNumber: 3,
      rows: 5,
      cols: 5,
      observeMs: 4400,
      start: { r: 4, c: 0 },
      goal: { r: 0, c: 4 },
      safePath: [
        { r: 4, c: 0 },
        { r: 3, c: 0 },
        { r: 2, c: 0 },
        { r: 2, c: 1 },
        { r: 2, c: 2 },
        { r: 3, c: 2 },
        { r: 4, c: 2 },
        { r: 4, c: 3 },
        { r: 4, c: 4 },
        { r: 3, c: 4 },
        { r: 2, c: 4 },
        { r: 1, c: 4 },
        { r: 0, c: 4 },
      ],
    };
  }

  if (age === 9 && stageNumber === 11) {
    return {
      id: 'mem-9-11',
      age: 9,
      stageNumber: 11,
      rows: 5,
      cols: 5,
      observeMs: 4700,
      start: { r: 0, c: 0 },
      goal: { r: 4, c: 4 },
      safePath: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
        { r: 0, c: 2 },
        { r: 0, c: 3 },
        { r: 0, c: 4 },
        { r: 1, c: 4 },
        { r: 2, c: 4 },
        { r: 2, c: 3 },
        { r: 2, c: 2 },
        { r: 2, c: 1 },
        { r: 3, c: 1 },
        { r: 4, c: 1 },
        { r: 4, c: 2 },
        { r: 4, c: 3 },
        { r: 4, c: 4 },
      ],
      decoyCells: [
        { r: 1, c: 1 },
        { r: 1, c: 2 },
        { r: 3, c: 3 },
      ],
      waypoints: [
        { r: 0, c: 4 },
        { r: 2, c: 1 },
      ],
    };
  }

  // Age 9, Stage 16: 6x6 Deep-Space Serpentine Nebula + Decoys
  return {
    id: 'mem-9-16',
    age: 9,
    stageNumber: 16,
    rows: 6,
    cols: 6,
    observeMs: 5200,
    start: { r: 5, c: 0 },
    goal: { r: 5, c: 2 },
    safePath: [
      { r: 5, c: 0 },
      { r: 4, c: 0 },
      { r: 3, c: 0 },
      { r: 2, c: 0 },
      { r: 1, c: 0 },
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 0, c: 2 },
      { r: 0, c: 3 },
      { r: 0, c: 4 },
      { r: 0, c: 5 },
      { r: 1, c: 5 },
      { r: 2, c: 5 },
      { r: 3, c: 5 },
      { r: 3, c: 4 },
      { r: 3, c: 3 },
      { r: 3, c: 2 },
      { r: 4, c: 2 },
      { r: 5, c: 2 },
    ],
    decoyCells: [
      { r: 2, c: 2 },
      { r: 2, c: 3 },
      { r: 4, c: 4 },
      { r: 5, c: 4 },
    ],
    waypoints: [
      { r: 0, c: 0 },
      { r: 0, c: 5 },
      { r: 3, c: 2 },
    ],
  };
}

export function isAdjacentCoord(a: MazeCoord, b: MazeCoord): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

export function isSafeMazeCell(spec: MemoryMazeSpec, coord: MazeCoord): boolean {
  return spec.safePath.some((p) => p.r === coord.r && p.c === coord.c);
}

export function stepMemoryMaze(
  spec: MemoryMazeSpec,
  tracedPath: MazeCoord[],
  next: MazeCoord
): { ok: boolean; won: boolean; hitVoid: boolean; nextPath: MazeCoord[] } {
  const head = tracedPath[tracedPath.length - 1];
  if (!head || !isAdjacentCoord(head, next)) {
    return { ok: false, won: false, hitVoid: false, nextPath: tracedPath };
  }

  // Allow stepping back onto the previous star in tracedPath
  if (
    tracedPath.length >= 2 &&
    tracedPath[tracedPath.length - 2].r === next.r &&
    tracedPath[tracedPath.length - 2].c === next.c
  ) {
    return {
      ok: true,
      won: false,
      hitVoid: false,
      nextPath: tracedPath.slice(0, -1),
    };
  }

  // Disallow revisiting an already lit star
  if (tracedPath.some((p) => p.r === next.r && p.c === next.c)) {
    return { ok: false, won: false, hitVoid: false, nextPath: tracedPath };
  }

  if (!isSafeMazeCell(spec, next)) {
    return { ok: false, won: false, hitVoid: true, nextPath: tracedPath };
  }

  const nextPath = [...tracedPath, next];
  const won = next.r === spec.goal.r && next.c === spec.goal.c;
  return { ok: true, won, hitVoid: false, nextPath };
}

export function rotateVoxel(v: Voxel, axis: Axis3D, dir: 1 | -1): Voxel {
  const { x, y, z, accent } = v;
  if (axis === 'x') {
    return dir === 1 ? { x, y: -z, z: y, accent } : { x, y: z, z: -y, accent };
  }
  if (axis === 'y') {
    return dir === 1 ? { x: z, y, z: -x, accent } : { x: -z, y, z: x, accent };
  }
  return dir === 1 ? { x: -y, y: x, z, accent } : { x: y, y: -x, z, accent };
}

export function rotateVoxels(voxels: Voxel[], axis: Axis3D, dir: 1 | -1): Voxel[] {
  return normalizeVoxels(voxels.map((v) => rotateVoxel(v, axis, dir)));
}

export function normalizeVoxels(voxels: Voxel[]): Voxel[] {
  if (voxels.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  for (const v of voxels) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.z < minZ) minZ = v.z;
  }
  return voxels
    .map((v) => ({
      x: v.x - minX,
      y: v.y - minY,
      z: v.z - minZ,
      accent: v.accent,
    }))
    .sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z);
}

export function voxelsMatch(a: Voxel[], b: Voxel[]): boolean {
  const na = normalizeVoxels(a);
  const nb = normalizeVoxels(b);
  if (na.length !== nb.length) return false;
  for (let i = 0; i < na.length; i++) {
    if (
      na[i].x !== nb[i].x ||
      na[i].y !== nb[i].y ||
      na[i].z !== nb[i].z ||
      na[i].accent !== nb[i].accent
    ) {
      return false;
    }
  }
  return true;
}

export function getSpatial3DStage(
  age: AgeGroup,
  stageNumber: Spatial3DStageNumber = 7
): Spatial3DSpec {
  if (age === 7 && stageNumber === 7) {
    const target: Voxel[] = normalizeVoxels([
      { x: 0, y: 0, z: 0, accent: 'cyan' },
      { x: 1, y: 0, z: 0, accent: 'cyan' },
      { x: 1, y: 1, z: 0, accent: 'cyan' },
      { x: 1, y: 1, z: 1, accent: 'amber' },
    ]);
    let initial = rotateVoxels(target, 'y', 1);
    initial = rotateVoxels(initial, 'x', 1);
    return {
      id: 'sp3d-7-7',
      age: 7,
      stageNumber: 7,
      target,
      initial,
    };
  }

  if (age === 7 && stageNumber === 12) {
    const target: Voxel[] = normalizeVoxels([
      { x: 0, y: 0, z: 0, accent: 'violet' },
      { x: 1, y: 0, z: 0, accent: 'cyan' },
      { x: 2, y: 0, z: 0, accent: 'cyan' },
      { x: 2, y: 1, z: 0, accent: 'amber' },
      { x: 0, y: 0, z: 1, accent: 'cyan' },
    ]);
    let initial = rotateVoxels(target, 'z', 1);
    initial = rotateVoxels(initial, 'y', 1);
    return {
      id: 'sp3d-7-12',
      age: 7,
      stageNumber: 12,
      target,
      initial,
    };
  }

  if (age === 7 && stageNumber === 17) {
    const target: Voxel[] = normalizeVoxels([
      { x: 0, y: 0, z: 0, accent: 'cyan' },
      { x: 1, y: 0, z: 0, accent: 'mint' },
      { x: 1, y: 1, z: 0, accent: 'cyan' },
      { x: 1, y: 2, z: 0, accent: 'amber' },
      { x: 1, y: 0, z: 1, accent: 'cyan' },
      { x: 2, y: 0, z: 1, accent: 'violet' },
    ]);
    let initial = rotateVoxels(target, 'x', 1);
    initial = rotateVoxels(initial, 'z', -1);
    return {
      id: 'sp3d-7-17',
      age: 7,
      stageNumber: 17,
      target,
      initial,
    };
  }

  if (age === 9 && stageNumber === 7) {
    const target: Voxel[] = normalizeVoxels([
      { x: 0, y: 0, z: 0, accent: 'cyan' },
      { x: 1, y: 0, z: 0, accent: 'cyan' },
      { x: 1, y: 1, z: 0, accent: 'cyan' },
      { x: 1, y: 1, z: 1, accent: 'amber' },
      { x: 0, y: 0, z: 1, accent: 'cyan' },
      { x: 0, y: 1, z: 1, accent: 'violet' },
    ]);
    let initial = rotateVoxels(target, 'x', 1);
    initial = rotateVoxels(initial, 'y', 1);
    initial = rotateVoxels(initial, 'z', 1);
    return {
      id: 'sp3d-9-7',
      age: 9,
      stageNumber: 7,
      target,
      initial,
    };
  }

  if (age === 9 && stageNumber === 12) {
    const target: Voxel[] = normalizeVoxels([
      { x: 0, y: 0, z: 0, accent: 'amber' },
      { x: 1, y: 0, z: 0, accent: 'cyan' },
      { x: 1, y: 1, z: 0, accent: 'cyan' },
      { x: 1, y: 1, z: 1, accent: 'mint' },
      { x: 1, y: 2, z: 1, accent: 'cyan' },
      { x: 2, y: 2, z: 1, accent: 'violet' },
      { x: 0, y: 1, z: 0, accent: 'cyan' },
    ]);
    let initial = rotateVoxels(target, 'y', 1);
    initial = rotateVoxels(initial, 'x', -1);
    initial = rotateVoxels(initial, 'z', 1);
    return {
      id: 'sp3d-9-12',
      age: 9,
      stageNumber: 12,
      target,
      initial,
    };
  }

  // Age 9, Stage 17: 8-Voxel Quad-Jewel Astral Crown
  const target: Voxel[] = normalizeVoxels([
    { x: 0, y: 0, z: 0, accent: 'violet' },
    { x: 1, y: 0, z: 0, accent: 'cyan' },
    { x: 2, y: 0, z: 0, accent: 'amber' },
    { x: 1, y: 1, z: 0, accent: 'cyan' },
    { x: 1, y: 2, z: 0, accent: 'mint' },
    { x: 0, y: 1, z: 1, accent: 'cyan' },
    { x: 1, y: 1, z: 1, accent: 'cyan' },
    { x: 2, y: 1, z: 1, accent: 'violet' },
  ]);
  let initial = rotateVoxels(target, 'z', 1);
  initial = rotateVoxels(initial, 'x', 1);
  initial = rotateVoxels(initial, 'y', -1);
  return {
    id: 'sp3d-9-17',
    age: 9,
    stageNumber: 17,
    target,
    initial,
  };
}
