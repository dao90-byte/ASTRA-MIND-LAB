import { AgeGroup } from './types';

export type Direction = 0 | 1 | 2 | 3; // 0=N, 1=E, 2=S, 3=W
export type BeamColor = 'cyan' | 'amber';

export type ModuleKind =
  | 'empty'
  | 'rock'
  | 'source'
  | 'target'
  | 'straight'
  | 'elbow'
  | 'splitter'
  | 'bridge'
  | 'converter'
  | 'mirror'
  | 'portal'
  | 'and_gate'
  | 'xor_gate';

export interface CellData {
  kind: ModuleKind;
  rot: Direction; // 0..3
  locked?: boolean;
  color?: BeamColor; // For source / target
  portalId?: 'A' | 'B'; // For paired quantum crystal wormholes
}

export interface SystemInventory {
  straight?: number;
  elbow?: number;
  splitter?: number;
  bridge?: number;
  converter?: number;
  mirror?: number;
}

export type SystemStageNumber = 1 | 5 | 9 | 14;

export interface SystemStageSpec {
  id: string;
  age: AgeGroup;
  stageNumber: SystemStageNumber;
  rows: number;
  cols: number;
  grid: CellData[][];
  inventory: SystemInventory;
}

export interface BeamSegment {
  r: number;
  c: number;
  fromDir: Direction | null; // Direction beam entered FROM (edge) or null for source/portal center
  toDir: Direction | null;   // Direction beam exits TOWARD (edge) or null for target/portal center
  color: BeamColor;
  step: number;
}

export interface SimulationResult {
  segments: BeamSegment[];
  maxStep: number;
  energizedTargets: Array<{ r: number; c: number; matched: boolean; received: BeamColor | null; expected: BeamColor }>;
  andGatesState: Array<{ r: number; c: number; kind: 'and_gate' | 'xor_gate'; inputA: boolean; inputB: boolean; fired: boolean }>;
  won: boolean;
}

export const DIR_DELTA: Record<Direction, [number, number]> = {
  0: [-1, 0],
  1: [0, 1],
  2: [1, 0],
  3: [0, -1],
};

export function oppositeDir(d: Direction): Direction {
  return ((d + 2) % 4) as Direction;
}

export function getAndInputPorts(rot: Direction): [Direction, Direction] {
  if (rot === 0 || rot === 2) return [0, 2]; // N and S inputs -> output E(1) or W(3)
  return [1, 3]; // E and W inputs -> output S(2) or N(0)
}

export function getAndOutputPort(rot: Direction): Direction {
  // rot 0 -> E(1), rot 1 -> S(2), rot 2 -> W(3), rot 3 -> N(0)
  return ((rot + 1) % 4) as Direction;
}

export function getModuleOutDirections(
  cell: CellData,
  entryPort: Direction,
  inColor: BeamColor
): Array<{ exitDir: Direction; outColor: BeamColor }> {
  const { kind, rot } = cell;

  switch (kind) {
    case 'straight': {
      const axisA: Direction = rot % 2 === 0 ? 0 : 1;
      const axisB: Direction = oppositeDir(axisA);
      if (entryPort === axisA) return [{ exitDir: axisB, outColor: inColor }];
      if (entryPort === axisB) return [{ exitDir: axisA, outColor: inColor }];
      return [];
    }
    case 'elbow': {
      const p1 = rot;
      const p2 = ((rot + 1) % 4) as Direction;
      if (entryPort === p1) return [{ exitDir: p2, outColor: inColor }];
      if (entryPort === p2) return [{ exitDir: p1, outColor: inColor }];
      return [];
    }
    case 'mirror': {
      // Double-sided 45-degree crystal prism mirror: reflects on BOTH faces simultaneously!
      if (rot % 2 === 0) {
        // '/' diagonal: N(0)<->W(3) and S(2)<->E(1)
        const map: Record<Direction, Direction> = { 0: 3, 3: 0, 2: 1, 1: 2 };
        return [{ exitDir: map[entryPort], outColor: inColor }];
      } else {
        // '\' diagonal: N(0)<->E(1) and S(2)<->W(3)
        const map: Record<Direction, Direction> = { 0: 1, 1: 0, 2: 3, 3: 2 };
        return [{ exitDir: map[entryPort], outColor: inColor }];
      }
    }
    case 'splitter': {
      // Closed port is opposite of rot+2 -> rot=0 closes S(2), open [0,1,3]
      const closed = ((rot + 2) % 4) as Direction;
      if (entryPort === closed) return [];
      const open: Direction[] = ([0, 1, 2, 3] as Direction[]).filter((d) => d !== closed);
      return open
        .filter((d) => d !== entryPort)
        .map((d) => ({ exitDir: d, outColor: inColor }));
    }
    case 'bridge': {
      return [{ exitDir: oppositeDir(entryPort), outColor: inColor }];
    }
    case 'converter': {
      const axisA: Direction = rot % 2 === 0 ? 0 : 1;
      const axisB: Direction = oppositeDir(axisA);
      const flipped: BeamColor = inColor === 'cyan' ? 'amber' : 'cyan';
      if (entryPort === axisA) return [{ exitDir: axisB, outColor: flipped }];
      if (entryPort === axisB) return [{ exitDir: axisA, outColor: flipped }];
      return [];
    }
    default:
      return [];
  }
}

export function simulateSystemGrid(grid: CellData[][]): SimulationResult {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  interface BeamWave {
    r: number;
    c: number;
    travelDir: Direction;
    color: BeamColor;
    step: number;
  }

  const segments: BeamSegment[] = [];
  const queue: BeamWave[] = [];
  const visitedBeamKey = new Set<string>();

  const targetColors = new Map<string, BeamColor | null>();
  const gateInputs = new Map<
    string,
    {
      r: number;
      c: number;
      kind: 'and_gate' | 'xor_gate';
      rot: Direction;
      portA: BeamColor | null;
      portB: BeamColor | null;
      maxInStep: number;
      fired: boolean;
    }
  >();

  const portals: Array<{ r: number; c: number; portalId: 'A' | 'B' }> = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.kind === 'source') {
        const color = cell.color ?? 'cyan';
        const outDir = cell.rot;
        segments.push({ r, c, fromDir: null, toDir: outDir, color, step: 0 });
        const [dr, dc] = DIR_DELTA[outDir];
        queue.push({ r: r + dr, c: c + dc, travelDir: outDir, color, step: 1 });
      } else if (cell.kind === 'target') {
        targetColors.set(`${r},${c}`, null);
      } else if (cell.kind === 'and_gate' || cell.kind === 'xor_gate') {
        gateInputs.set(`${r},${c}`, {
          r,
          c,
          kind: cell.kind,
          rot: cell.rot,
          portA: null,
          portB: null,
          maxInStep: 0,
          fired: false,
        });
      } else if (cell.kind === 'portal') {
        portals.push({ r, c, portalId: cell.portalId ?? 'A' });
      }
    }
  }

  let maxStep = 0;
  let safety = 0;

  const propagateQueue = () => {
    while (queue.length > 0 && safety < 500) {
      safety++;
      const wave = queue.shift()!;
      const { r, c, travelDir, color, step } = wave;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;

      const key = `${r},${c},${travelDir},${color}`;
      if (visitedBeamKey.has(key)) continue;
      visitedBeamKey.add(key);

      const cell = grid[r][c];
      const entryPort = oppositeDir(travelDir);

      if (cell.kind === 'empty' || cell.kind === 'rock' || cell.kind === 'source') {
        continue;
      }

      if (cell.kind === 'target') {
        maxStep = Math.max(maxStep, step);
        segments.push({ r, c, fromDir: entryPort, toDir: null, color, step });
        const prev = targetColors.get(`${r},${c}`);
        const expected = cell.color ?? 'cyan';
        if (prev === null || color === expected) {
          targetColors.set(`${r},${c}`, color);
        }
        continue;
      }

      if (cell.kind === 'portal') {
        const pid = cell.portalId ?? 'A';
        const partner = portals.find((p) => p.portalId === pid && (p.r !== r || p.c !== c));
        maxStep = Math.max(maxStep, step);
        segments.push({ r, c, fromDir: entryPort, toDir: null, color, step });
        if (partner) {
          const exitStep = step + 1;
          maxStep = Math.max(maxStep, exitStep);
          segments.push({
            r: partner.r,
            c: partner.c,
            fromDir: null,
            toDir: travelDir,
            color,
            step: exitStep,
          });
          const [dr, dc] = DIR_DELTA[travelDir];
          queue.push({
            r: partner.r + dr,
            c: partner.c + dc,
            travelDir,
            color,
            step: exitStep + 1,
          });
        }
        continue;
      }

      if (cell.kind === 'and_gate' || cell.kind === 'xor_gate') {
        const gate = gateInputs.get(`${r},${c}`)!;
        const [pA, pB] = getAndInputPorts(gate.rot);
        if (entryPort !== pA && entryPort !== pB) continue;

        maxStep = Math.max(maxStep, step);
        gate.maxInStep = Math.max(gate.maxInStep, step);
        segments.push({ r, c, fromDir: entryPort, toDir: null, color, step });

        if (entryPort === pA) gate.portA = color;
        if (entryPort === pB) gate.portB = color;

        if (gate.kind === 'and_gate' && gate.portA && gate.portB && !gate.fired) {
          gate.fired = true;
          const outDir = getAndOutputPort(gate.rot);
          const outColor: BeamColor =
            gate.portA === 'amber' && gate.portB === 'amber' ? 'amber' : 'cyan';
          const nextStep = step + 1;
          maxStep = Math.max(maxStep, nextStep);
          segments.push({ r, c, fromDir: null, toDir: outDir, color: outColor, step: nextStep });
          const [dr, dc] = DIR_DELTA[outDir];
          queue.push({ r: r + dr, c: c + dc, travelDir: outDir, color: outColor, step: nextStep + 1 });
        }
        continue;
      }

      const exits = getModuleOutDirections(cell, entryPort, color);
      if (exits.length === 0) continue;

      maxStep = Math.max(maxStep, step);
      for (const ex of exits) {
        segments.push({
          r,
          c,
          fromDir: entryPort,
          toDir: ex.exitDir,
          color: ex.outColor,
          step,
        });
        const [dr, dc] = DIR_DELTA[ex.exitDir];
        queue.push({
          r: r + dr,
          c: c + dc,
          travelDir: ex.exitDir,
          color: ex.outColor,
          step: step + 1,
        });
      }
    }
  };

  // Pass 1: propagate all sources, mirrors, portals, and AND gates
  propagateQueue();

  // Pass 2: evaluate XOR gates after all upstream branches have arrived
  for (const gate of gateInputs.values()) {
    if (gate.kind === 'xor_gate' && !gate.fired) {
      const hasA = Boolean(gate.portA);
      const hasB = Boolean(gate.portB);
      if (hasA !== hasB) {
        gate.fired = true;
        const outDir = getAndOutputPort(gate.rot);
        const outColor: BeamColor = (gate.portA ?? gate.portB) ?? 'cyan';
        const nextStep = gate.maxInStep + 1;
        maxStep = Math.max(maxStep, nextStep);
        segments.push({
          r: gate.r,
          c: gate.c,
          fromDir: null,
          toDir: outDir,
          color: outColor,
          step: nextStep,
        });
        const [dr, dc] = DIR_DELTA[outDir];
        queue.push({
          r: gate.r + dr,
          c: gate.c + dc,
          travelDir: outDir,
          color: outColor,
          step: nextStep + 1,
        });
      }
    }
  }

  if (queue.length > 0) {
    propagateQueue();
  }

  const energizedTargets: SimulationResult['energizedTargets'] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.kind === 'target') {
        const expected = cell.color ?? 'cyan';
        const received = targetColors.get(`${r},${c}`) ?? null;
        energizedTargets.push({
          r,
          c,
          expected,
          received,
          matched: received === expected,
        });
      }
    }
  }

  const andGatesState = Array.from(gateInputs.values()).map((g) => ({
    r: g.r,
    c: g.c,
    kind: g.kind,
    inputA: Boolean(g.portA),
    inputB: Boolean(g.portB),
    fired: g.fired,
  }));

  const won =
    energizedTargets.length > 0 && energizedTargets.every((t) => t.matched);

  return {
    segments,
    maxStep,
    energizedTargets,
    andGatesState,
    won,
  };
}

function emptyGrid(rows: number, cols: number): CellData[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ kind: 'empty' as ModuleKind, rot: 0 as Direction }))
  );
}

export function getSystemStage(age: AgeGroup, stageNumber: SystemStageNumber): SystemStageSpec {
  if (age === 7 && stageNumber === 1) {
    const grid = emptyGrid(5, 5);
    grid[2][0] = { kind: 'source', rot: 1, locked: true, color: 'cyan' };
    grid[4][4] = { kind: 'target', rot: 0, locked: true, color: 'cyan' };
    grid[2][2] = { kind: 'rock', rot: 0, locked: true };
    grid[1][4] = { kind: 'rock', rot: 0, locked: true };
    grid[3][1] = { kind: 'rock', rot: 0, locked: true };
    return {
      id: 'sys-7-1',
      age: 7,
      stageNumber: 1,
      rows: 5,
      cols: 5,
      grid,
      inventory: { elbow: 5, straight: 3 },
    };
  }

  if (age === 7 && stageNumber === 5) {
    const grid = emptyGrid(5, 5);
    grid[0][2] = { kind: 'source', rot: 2, locked: true, color: 'cyan' };
    grid[4][0] = { kind: 'target', rot: 0, locked: true, color: 'cyan' };
    grid[4][4] = { kind: 'target', rot: 0, locked: true, color: 'amber' };
    grid[2][2] = { kind: 'rock', rot: 0, locked: true };
    grid[3][1] = { kind: 'rock', rot: 0, locked: true };
    grid[3][3] = { kind: 'rock', rot: 0, locked: true };
    return {
      id: 'sys-7-5',
      age: 7,
      stageNumber: 5,
      rows: 5,
      cols: 5,
      grid,
      inventory: { splitter: 1, converter: 1, elbow: 3, straight: 5 },
    };
  }

  if (age === 7 && stageNumber === 9) {
    // Quantum Crystal Wormhole across impenetrable obsidian barrier
    const grid = emptyGrid(5, 5);
    grid[0][0] = { kind: 'source', rot: 1, locked: true, color: 'cyan' };
    grid[0][4] = { kind: 'target', rot: 0, locked: true, color: 'cyan' };
    grid[4][4] = { kind: 'target', rot: 0, locked: true, color: 'amber' };
    grid[1][2] = { kind: 'portal', rot: 0, locked: true, portalId: 'A' };
    grid[3][1] = { kind: 'portal', rot: 0, locked: true, portalId: 'A' };
    for (let c = 0; c < 5; c++) {
      grid[2][c] = { kind: 'rock', rot: 0, locked: true };
    }
    return {
      id: 'sys-7-9',
      age: 7,
      stageNumber: 9,
      rows: 5,
      cols: 5,
      grid,
      inventory: { splitter: 1, converter: 1, elbow: 2, straight: 4 },
    };
  }

  if (age === 7 && stageNumber === 14) {
    // Double-sided 45° Crystal Mirror: one mirror reflects two opposing beams simultaneously
    const grid = emptyGrid(5, 5);
    grid[0][2] = { kind: 'source', rot: 2, locked: true, color: 'cyan' };
    grid[4][2] = { kind: 'source', rot: 0, locked: true, color: 'amber' };
    grid[2][0] = { kind: 'target', rot: 0, locked: true, color: 'cyan' };
    grid[2][4] = { kind: 'target', rot: 0, locked: true, color: 'amber' };
    grid[1][1] = { kind: 'rock', rot: 0, locked: true };
    grid[1][3] = { kind: 'rock', rot: 0, locked: true };
    grid[3][1] = { kind: 'rock', rot: 0, locked: true };
    grid[3][3] = { kind: 'rock', rot: 0, locked: true };
    return {
      id: 'sys-7-14',
      age: 7,
      stageNumber: 14,
      rows: 5,
      cols: 5,
      grid,
      inventory: { mirror: 1, straight: 4 },
    };
  }

  if (age === 9 && stageNumber === 1) {
    const grid = emptyGrid(6, 6);
    grid[2][0] = { kind: 'source', rot: 1, locked: true, color: 'cyan' };
    grid[2][4] = { kind: 'and_gate', rot: 0, locked: true };
    grid[2][5] = { kind: 'target', rot: 0, locked: true, color: 'cyan' };
    grid[2][2] = { kind: 'rock', rot: 0, locked: true };
    grid[2][3] = { kind: 'rock', rot: 0, locked: true };
    grid[1][5] = { kind: 'rock', rot: 0, locked: true };
    grid[3][5] = { kind: 'rock', rot: 0, locked: true };
    grid[0][3] = { kind: 'rock', rot: 0, locked: true };
    grid[4][3] = { kind: 'rock', rot: 0, locked: true };
    return {
      id: 'sys-9-1',
      age: 9,
      stageNumber: 1,
      rows: 6,
      cols: 6,
      grid,
      inventory: { splitter: 1, elbow: 5, straight: 5 },
    };
  }

  if (age === 9 && stageNumber === 5) {
    // Age 9, Stage 5: Dual-Source + Bridge + Converter + AND Gate
    const grid = emptyGrid(6, 6);
    grid[0][2] = { kind: 'source', rot: 2, locked: true, color: 'cyan' };
    grid[1][0] = { kind: 'source', rot: 1, locked: true, color: 'amber' };
    grid[3][4] = { kind: 'and_gate', rot: 0, locked: true };
    grid[3][5] = { kind: 'target', rot: 0, locked: true, color: 'amber' };
    grid[0][1] = { kind: 'rock', rot: 0, locked: true };
    grid[0][3] = { kind: 'rock', rot: 0, locked: true };
    grid[2][1] = { kind: 'rock', rot: 0, locked: true };
    grid[2][3] = { kind: 'rock', rot: 0, locked: true };
    grid[3][3] = { kind: 'rock', rot: 0, locked: true };
    grid[5][2] = { kind: 'rock', rot: 0, locked: true };
    return {
      id: 'sys-9-5',
      age: 9,
      stageNumber: 5,
      rows: 6,
      cols: 6,
      grid,
      inventory: { bridge: 1, converter: 1, elbow: 3, straight: 6 },
    };
  }

  if (age === 9 && stageNumber === 9) {
    // Age 9, Stage 9: Dual-Sided Prism Mirror + Twin Wormholes ('A' & 'B') + AND Gate
    const grid = emptyGrid(6, 6);
    grid[0][1] = { kind: 'source', rot: 2, locked: true, color: 'cyan' };
    grid[5][1] = { kind: 'source', rot: 0, locked: true, color: 'cyan' };
    grid[2][2] = { kind: 'portal', rot: 0, locked: true, portalId: 'A' };
    grid[0][3] = { kind: 'portal', rot: 0, locked: true, portalId: 'A' };
    grid[2][0] = { kind: 'portal', rot: 0, locked: true, portalId: 'B' };
    grid[3][5] = { kind: 'portal', rot: 0, locked: true, portalId: 'B' };
    grid[1][4] = { kind: 'and_gate', rot: 0, locked: true };
    grid[1][5] = { kind: 'target', rot: 0, locked: true, color: 'amber' };
    grid[1][3] = { kind: 'rock', rot: 0, locked: true };
    grid[3][3] = { kind: 'rock', rot: 0, locked: true };
    grid[4][3] = { kind: 'rock', rot: 0, locked: true };
    grid[5][3] = { kind: 'rock', rot: 0, locked: true };
    return {
      id: 'sys-9-9',
      age: 9,
      stageNumber: 9,
      rows: 6,
      cols: 6,
      grid,
      inventory: { mirror: 1, converter: 2, elbow: 2, straight: 2 },
    };
  }

  // Age 9, Stage 14: Exclusive Resonance (XOR Gate) + AND Gate Dual-Logic Synthesis
  const grid = emptyGrid(6, 6);
  grid[1][0] = { kind: 'source', rot: 1, locked: true, color: 'cyan' };
  grid[5][1] = { kind: 'source', rot: 1, locked: true, color: 'amber' };
  grid[2][4] = { kind: 'xor_gate', rot: 0, locked: true };
  grid[2][5] = { kind: 'target', rot: 0, locked: true, color: 'cyan' };
  grid[4][4] = { kind: 'and_gate', rot: 0, locked: true };
  grid[4][5] = { kind: 'target', rot: 0, locked: true, color: 'amber' };
  grid[0][4] = { kind: 'rock', rot: 0, locked: true };
  grid[2][2] = { kind: 'rock', rot: 0, locked: true };
  grid[2][3] = { kind: 'rock', rot: 0, locked: true };
  grid[4][2] = { kind: 'rock', rot: 0, locked: true };
  return {
    id: 'sys-9-14',
    age: 9,
    stageNumber: 14,
    rows: 6,
    cols: 6,
    grid,
    inventory: { splitter: 1, converter: 1, elbow: 4, straight: 6 },
  };
}
