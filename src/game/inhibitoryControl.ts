import { AgeGroup } from './types';

export type InhibitoryTileKind =
  | 'floor'
  | 'void'
  | 'goal'
  | 'fragile'
  | 'switch'
  | 'gate'
  | 'phase_gate'
  | 'warp'
  | 'ice';

export interface Coord {
  r: number;
  c: number;
}

export interface SwitchLink {
  r: number;
  c: number;
  targets: Coord[]; // gate coordinates toggled when stepped on
}

export interface WarpLink {
  from: Coord;
  to: Coord;
}

export interface PhaseGateDef {
  r: number;
  c: number;
  period: number; // open when turn % period === openMod
  openMod: number;
}

export interface SentinelDef {
  id: string;
  orbit: Coord[]; // looping or ping-pong path array
}

export type InhibitoryStageNumber = 2 | 6 | 10 | 15 | 20 | 25;

export interface InhibitoryStageSpec {
  id: string;
  age: AgeGroup;
  stageNumber: InhibitoryStageNumber;
  rows: number;
  cols: number;
  start: Coord;
  goal: Coord;
  maxMoves: number;
  allowWait: boolean;
  tiles: InhibitoryTileKind[][];
  initialGatesOpen: Record<string, boolean>; // key: "r,c"
  switches: SwitchLink[];
  warpLinks?: WarpLink[];
  phaseGates: PhaseGateDef[];
  sentinels: SentinelDef[];
}

export interface InhibitoryState {
  player: Coord;
  turn: number;
  gatesOpen: Record<string, boolean>;
  brokenTiles: Record<string, boolean>;
  crackedTiles: Record<string, boolean>;
  status: 'playing' | 'won' | 'failed';
  failReason?: 'sentinel' | 'out_of_moves' | 'trapped';
  history: Array<{
    player: Coord;
    turn: number;
    gatesOpen: Record<string, boolean>;
    brokenTiles: Record<string, boolean>;
    crackedTiles: Record<string, boolean>;
  }>;
}

export function keyOf(r: number, c: number): string {
  return `${r},${c}`;
}

export function getSentinelPos(sentinel: SentinelDef, turn: number): Coord {
  return sentinel.orbit[turn % sentinel.orbit.length];
}

export function isPhaseGateOpen(pg: PhaseGateDef, turn: number): boolean {
  return turn % pg.period === pg.openMod;
}

export function createInitialInhibitoryState(spec: InhibitoryStageSpec): InhibitoryState {
  return {
    player: { ...spec.start },
    turn: 0,
    gatesOpen: { ...spec.initialGatesOpen },
    brokenTiles: {},
    crackedTiles: {},
    status: 'playing',
    history: [],
  };
}

export function isTilePassableAtTurn(
  spec: InhibitoryStageSpec,
  state: InhibitoryState,
  r: number,
  c: number,
  nextTurn: number
): boolean {
  if (r < 0 || r >= spec.rows || c < 0 || c >= spec.cols) return false;
  const k = keyOf(r, c);
  if (state.brokenTiles[k]) return false;

  const kind = spec.tiles[r][c];
  if (kind === 'void') return false;
  if (kind === 'gate') return Boolean(state.gatesOpen[k]);
  if (kind === 'phase_gate') {
    const pg = spec.phaseGates.find((p) => p.r === r && p.c === c);
    return pg ? isPhaseGateOpen(pg, nextTurn) : true;
  }
  return true;
}

export function stepInhibitory(
  spec: InhibitoryStageSpec,
  state: InhibitoryState,
  action: 'up' | 'down' | 'left' | 'right' | 'wait'
): InhibitoryState {
  if (state.status !== 'playing') return state;

  let dr = 0;
  let dc = 0;
  if (action === 'up') dr = -1;
  if (action === 'down') dr = 1;
  if (action === 'left') dc = -1;
  if (action === 'right') dc = 1;

  let nr = state.player.r + dr;
  let nc = state.player.c + dc;

  if (action === 'wait' && !spec.allowWait) return state;

  const nextTurn = state.turn + 1;
  if (nextTurn > spec.maxMoves) return state;

  // Check tile passability against current gates/broken, and nextTurn phase gates
  if (action !== 'wait' && !isTilePassableAtTurn(spec, state, nr, nc, nextTurn)) {
    return state;
  }

  const snapshot = {
    player: { ...state.player },
    turn: state.turn,
    gatesOpen: { ...state.gatesOpen },
    brokenTiles: { ...state.brokenTiles },
    crackedTiles: { ...state.crackedTiles },
  };

  const nextGates = { ...state.gatesOpen };
  const nextBroken = { ...state.brokenTiles };
  const nextCracked = { ...state.crackedTiles };

  // Fragile tile left behind breaks
  if (action !== 'wait') {
    const prevKey = keyOf(state.player.r, state.player.c);
    if (spec.tiles[state.player.r][state.player.c] === 'fragile') {
      nextBroken[prevKey] = true;
    }

    // Frictionless ice crystal sliding: keep sliding while on 'ice' if next tile is passable
    let safety = 0;
    while (spec.tiles[nr][nc] === 'ice' && safety < 16) {
      safety++;
      const sr = nr + dr;
      const sc = nc + dc;
      if (!isTilePassableAtTurn(spec, state, sr, sc, nextTurn)) {
        break;
      }
      nr = sr;
      nc = sc;
    }

    // Trigger switch on landing
    const sw = spec.switches.find((s) => s.r === nr && s.c === nc);
    if (sw) {
      for (const tgt of sw.targets) {
        const tk = keyOf(tgt.r, tgt.c);
        nextGates[tk] = !nextGates[tk];
      }
    }

    // Trigger paired crystal warp teleporter on landing
    if (spec.tiles[nr][nc] === 'warp' && spec.warpLinks) {
      const link = spec.warpLinks.find((w) => w.from.r === nr && w.from.c === nc);
      if (link) {
        nr = link.to.r;
        nc = link.to.c;
      }
    }
  }

  // Check Sentinel collisions (occupying same tile at nextTurn or head-on swap)
  for (const s of spec.sentinels) {
    const prevS = getSentinelPos(s, state.turn);
    const nextS = getSentinelPos(s, nextTurn);
    const sameEnd = nextS.r === nr && nextS.c === nc;
    const swapped =
      nextS.r === state.player.r &&
      nextS.c === state.player.c &&
      prevS.r === nr &&
      prevS.c === nc;

    if (sameEnd || swapped) {
      return {
        player: { r: nr, c: nc },
        turn: nextTurn,
        gatesOpen: nextGates,
        brokenTiles: nextBroken,
        crackedTiles: nextCracked,
        status: 'failed',
        failReason: 'sentinel',
        history: [...state.history, snapshot],
      };
    }
  }

  // Win check
  if (nr === spec.goal.r && nc === spec.goal.c) {
    return {
      player: { r: nr, c: nc },
      turn: nextTurn,
      gatesOpen: nextGates,
      brokenTiles: nextBroken,
      crackedTiles: nextCracked,
      status: 'won',
      history: [...state.history, snapshot],
    };
  }

  // Out of moves check
  if (nextTurn >= spec.maxMoves) {
    return {
      player: { r: nr, c: nc },
      turn: nextTurn,
      gatesOpen: nextGates,
      brokenTiles: nextBroken,
      crackedTiles: nextCracked,
      status: 'failed',
      failReason: 'out_of_moves',
      history: [...state.history, snapshot],
    };
  }

  return {
    player: { r: nr, c: nc },
    turn: nextTurn,
    gatesOpen: nextGates,
    brokenTiles: nextBroken,
    crackedTiles: nextCracked,
    status: 'playing',
    history: [...state.history, snapshot],
  };
}

export function undoInhibitory(state: InhibitoryState): InhibitoryState {
  if (state.history.length === 0) return state;
  const prev = state.history[state.history.length - 1];
  return {
    player: { ...prev.player },
    turn: prev.turn,
    gatesOpen: { ...prev.gatesOpen },
    brokenTiles: { ...prev.brokenTiles },
    crackedTiles: { ...prev.crackedTiles },
    status: 'playing',
    history: state.history.slice(0, -1),
  };
}

function makeFloor(rows: number, cols: number): InhibitoryTileKind[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 'floor' as InhibitoryTileKind)
  );
}

export function getInhibitoryStage(
  age: AgeGroup,
  stageNumber: InhibitoryStageNumber
): InhibitoryStageSpec {
  if (age === 7 && stageNumber === 2) {
    const tiles = makeFloor(5, 5);
    tiles[0][3] = 'void';
    tiles[1][3] = 'void';
    tiles[3][3] = 'void';
    tiles[4][3] = 'void';
    tiles[0][4] = 'goal';
    tiles[1][4] = 'gate'; // GateA
    tiles[2][3] = 'gate'; // GateB
    tiles[1][0] = 'switch'; // SwitchA -> opens GateA
    tiles[2][0] = 'switch'; // SwitchB -> closes GateB!
    return {
      id: 'inh-7-2',
      age: 7,
      stageNumber: 2,
      rows: 5,
      cols: 5,
      start: { r: 4, c: 0 },
      goal: { r: 0, c: 4 },
      maxMoves: 15,
      allowWait: false,
      tiles,
      initialGatesOpen: {
        '1,4': false,
        '2,3': true,
      },
      switches: [
        { r: 1, c: 0, targets: [{ r: 1, c: 4 }] },
        { r: 2, c: 0, targets: [{ r: 2, c: 3 }] },
      ],
      phaseGates: [],
      sentinels: [],
    };
  }

  if (age === 7 && stageNumber === 6) {
    const tiles = makeFloor(5, 5);
    tiles[1][0] = 'void';
    tiles[1][1] = 'void';
    tiles[1][3] = 'void';
    tiles[1][4] = 'void';
    tiles[3][0] = 'void';
    tiles[3][1] = 'void';
    tiles[3][3] = 'void';
    tiles[3][4] = 'void';
    tiles[0][3] = 'phase_gate';
    tiles[0][4] = 'goal';
    return {
      id: 'inh-7-6',
      age: 7,
      stageNumber: 6,
      rows: 5,
      cols: 5,
      start: { r: 4, c: 0 },
      goal: { r: 0, c: 4 },
      maxMoves: 11,
      allowWait: true,
      tiles,
      initialGatesOpen: {},
      switches: [],
      phaseGates: [{ r: 0, c: 3, period: 2, openMod: 0 }],
      sentinels: [
        {
          id: 's1',
          orbit: [
            { r: 2, c: 2 },
            { r: 2, c: 3 },
            { r: 2, c: 2 },
            { r: 2, c: 1 },
          ],
        },
      ],
    };
  }

  if (age === 7 && stageNumber === 10) {
    // Crystal Warp Pad & Remote Gate Unlock: warping immediately traps player behind locked gate!
    const tiles = makeFloor(5, 5);
    tiles[0][3] = 'void';
    tiles[1][2] = 'void';
    tiles[2][2] = 'void';
    tiles[2][3] = 'void';
    tiles[2][4] = 'void';
    tiles[3][3] = 'void';
    tiles[4][3] = 'void';
    tiles[3][0] = 'warp';
    tiles[1][3] = 'floor';
    tiles[1][4] = 'gate';
    tiles[0][4] = 'goal';
    tiles[4][2] = 'switch';
    return {
      id: 'inh-7-10',
      age: 7,
      stageNumber: 10,
      rows: 5,
      cols: 5,
      start: { r: 4, c: 0 },
      goal: { r: 0, c: 4 },
      maxMoves: 10,
      allowWait: false,
      tiles,
      initialGatesOpen: { '1,4': false },
      switches: [{ r: 4, c: 2, targets: [{ r: 1, c: 4 }] }],
      warpLinks: [{ from: { r: 3, c: 0 }, to: { r: 1, c: 3 } }],
      phaseGates: [],
      sentinels: [],
    };
  }

  if (age === 7 && stageNumber === 15) {
    // Frictionless Ice Crystal Corridor & Sentinel Wait Timing
    const tiles = makeFloor(5, 5);
    tiles[4][0] = 'void';
    tiles[3][0] = 'void';
    tiles[2][0] = 'void';
    tiles[3][2] = 'void';
    tiles[2][2] = 'void';
    tiles[3][1] = 'ice';
    tiles[2][1] = 'ice';
    tiles[0][2] = 'ice';
    tiles[0][3] = 'ice';
    tiles[0][4] = 'goal';
    return {
      id: 'inh-7-15',
      age: 7,
      stageNumber: 15,
      rows: 5,
      cols: 5,
      start: { r: 4, c: 1 },
      goal: { r: 0, c: 4 },
      maxMoves: 9,
      allowWait: true,
      tiles,
      initialGatesOpen: {},
      switches: [],
      phaseGates: [],
      sentinels: [
        {
          id: 's1',
          orbit: [
            { r: 1, c: 2 },
            { r: 1, c: 1 },
            { r: 1, c: 2 },
            { r: 1, c: 3 },
          ],
        },
      ],
    };
  }

  if (age === 9 && stageNumber === 2) {
    const tiles = makeFloor(6, 6);
    tiles[0][3] = 'void';
    tiles[1][3] = 'void';
    tiles[3][3] = 'void';
    tiles[4][3] = 'void';
    tiles[5][3] = 'void';
    tiles[0][4] = 'void';
    tiles[2][5] = 'void';
    tiles[0][5] = 'goal';
    tiles[2][3] = 'gate'; // GateA (initially OPEN)
    tiles[1][4] = 'gate'; // GateB (initially CLOSED)
    tiles[5][2] = 'switch'; // Switch1 -> toggles GateA
    tiles[2][1] = 'switch'; // Switch2 -> toggles GateA AND GateB
    return {
      id: 'inh-9-2',
      age: 9,
      stageNumber: 2,
      rows: 6,
      cols: 6,
      start: { r: 5, c: 0 },
      goal: { r: 0, c: 5 },
      maxMoves: 15,
      allowWait: false,
      tiles,
      initialGatesOpen: {
        '2,3': true,
        '1,4': false,
      },
      switches: [
        { r: 5, c: 2, targets: [{ r: 2, c: 3 }] },
        { r: 2, c: 1, targets: [{ r: 2, c: 3 }, { r: 1, c: 4 }] },
      ],
      phaseGates: [],
      sentinels: [],
    };
  }

  if (age === 9 && stageNumber === 6) {
    const tiles = makeFloor(6, 6);
    tiles[2][0] = 'void';
    tiles[2][1] = 'void';
    tiles[2][3] = 'void';
    tiles[2][5] = 'void';
    tiles[4][3] = 'void';
    tiles[4][4] = 'void';
    tiles[4][5] = 'void';
    tiles[0][4] = 'void';
    tiles[2][2] = 'fragile';
    tiles[1][5] = 'phase_gate';
    tiles[0][5] = 'goal';
    return {
      id: 'inh-9-6',
      age: 9,
      stageNumber: 6,
      rows: 6,
      cols: 6,
      start: { r: 5, c: 0 },
      goal: { r: 0, c: 5 },
      maxMoves: 13,
      allowWait: true,
      tiles,
      initialGatesOpen: {},
      switches: [],
      phaseGates: [{ r: 1, c: 5, period: 2, openMod: 0 }],
      sentinels: [
        {
          id: 's1',
          orbit: [
            { r: 3, c: 2 },
            { r: 3, c: 3 },
            { r: 3, c: 2 },
            { r: 3, c: 1 },
          ],
        },
        {
          id: 's2',
          orbit: [
            { r: 1, c: 4 },
            { r: 2, c: 4 },
            { r: 3, c: 4 },
            { r: 2, c: 4 },
          ],
        },
      ],
    };
  }

  if (age === 9 && stageNumber === 10) {
    // Dual-Switch Warp Labyrinth: must pre-toggle SwitchPre (5,2) before SwitchTrap (4,0) to enter Warp (2,3) -> (2,5)
    const tiles = makeFloor(6, 6);
    tiles[0][4] = 'void';
    tiles[1][4] = 'void';
    tiles[2][4] = 'void';
    tiles[3][4] = 'void';
    tiles[3][5] = 'void';
    tiles[4][3] = 'void';
    tiles[1][3] = 'void';
    tiles[2][2] = 'void';
    tiles[5][2] = 'switch'; // SwitchPre -> toggles GateA (3,3)
    tiles[4][0] = 'switch'; // SwitchTrap -> toggles GateA (3,3) AND GateB (1,5)
    tiles[3][3] = 'gate';   // GateA (initially true)
    tiles[2][3] = 'warp';   // Warps to (2,5)
    tiles[1][5] = 'gate';   // GateB (initially false)
    tiles[0][5] = 'goal';
    return {
      id: 'inh-9-10',
      age: 9,
      stageNumber: 10,
      rows: 6,
      cols: 6,
      start: { r: 5, c: 0 },
      goal: { r: 0, c: 5 },
      maxMoves: 14,
      allowWait: false,
      tiles,
      initialGatesOpen: {
        '3,3': true,
        '1,5': false,
      },
      switches: [
        { r: 5, c: 2, targets: [{ r: 3, c: 3 }] },
        { r: 4, c: 0, targets: [{ r: 3, c: 3 }, { r: 1, c: 5 }] },
      ],
      warpLinks: [{ from: { r: 2, c: 3 }, to: { r: 2, c: 5 } }],
      phaseGates: [],
      sentinels: [],
    };
  }

  if (age === 9 && stageNumber === 15) {
    // Age 9, Stage 15: Frictionless Ice Slide + Twin Sentinels + Phase Gate
    const tiles = makeFloor(6, 6);
    tiles[5][0] = 'void';
    tiles[4][0] = 'void';
    tiles[3][0] = 'void';
    tiles[4][2] = 'void';
    tiles[3][2] = 'void';
    tiles[4][1] = 'ice';
    tiles[3][1] = 'ice';
    tiles[1][2] = 'ice';
    tiles[1][3] = 'ice';
    tiles[1][5] = 'phase_gate';
    tiles[0][5] = 'goal';
    return {
      id: 'inh-9-15',
      age: 9,
      stageNumber: 15,
      rows: 6,
      cols: 6,
      start: { r: 5, c: 1 },
      goal: { r: 0, c: 5 },
      maxMoves: 10,
      allowWait: true,
      tiles,
      initialGatesOpen: {},
      switches: [],
      phaseGates: [{ r: 1, c: 5, period: 2, openMod: 1 }],
      sentinels: [
        {
          id: 's1',
          orbit: [
            { r: 2, c: 2 },
            { r: 2, c: 1 },
            { r: 2, c: 2 },
            { r: 2, c: 3 },
          ],
        },
        {
          id: 's2',
          orbit: [
            { r: 2, c: 4 },
            { r: 1, c: 4 },
            { r: 0, c: 4 },
            { r: 1, c: 4 },
          ],
        },
      ],
    };
  }

  if (age === 7 && stageNumber === 20) {
    // Age 7, Stage 20: Chrono-Phase Ice & Fragile Bridge Gauntlet
    const tiles = makeFloor(5, 5);
    tiles[3][0] = 'void';
    tiles[3][1] = 'void';
    tiles[3][2] = 'void';
    tiles[1][0] = 'void';
    tiles[1][1] = 'void';
    tiles[1][2] = 'void';
    tiles[1][4] = 'void';
    tiles[3][4] = 'void';
    tiles[4][4] = 'void';
    tiles[4][1] = 'ice';
    tiles[4][2] = 'ice';
    tiles[3][3] = 'fragile';
    tiles[1][3] = 'phase_gate';
    tiles[0][4] = 'goal';
    return {
      id: 'inh-7-20',
      age: 7,
      stageNumber: 20,
      rows: 5,
      cols: 5,
      start: { r: 4, c: 0 },
      goal: { r: 0, c: 4 },
      maxMoves: 10,
      allowWait: true,
      tiles,
      initialGatesOpen: {},
      switches: [],
      phaseGates: [{ r: 1, c: 3, period: 2, openMod: 1 }],
      sentinels: [
        {
          id: 's1',
          orbit: [
            { r: 2, c: 2 },
            { r: 2, c: 3 },
            { r: 2, c: 4 },
            { r: 2, c: 3 },
          ],
        },
      ],
    };
  }

  if (age === 7 && stageNumber === 25) {
    // Age 7, Stage 25: Warp onto Ice Runway + Remote Switch + Sentinel
    const tiles = makeFloor(5, 5);
    tiles[2][0] = 'void';
    tiles[2][1] = 'void';
    tiles[2][2] = 'void';
    tiles[2][4] = 'void';
    tiles[3][3] = 'void';
    tiles[4][3] = 'void';
    tiles[0][3] = 'void';
    tiles[3][0] = 'warp';
    tiles[4][2] = 'switch';
    tiles[1][2] = 'ice';
    tiles[1][3] = 'ice';
    tiles[1][4] = 'gate';
    tiles[0][4] = 'goal';
    return {
      id: 'inh-7-25',
      age: 7,
      stageNumber: 25,
      rows: 5,
      cols: 5,
      start: { r: 4, c: 0 },
      goal: { r: 0, c: 4 },
      maxMoves: 10,
      allowWait: true,
      tiles,
      initialGatesOpen: { '1,4': false },
      switches: [{ r: 4, c: 2, targets: [{ r: 1, c: 4 }] }],
      warpLinks: [{ from: { r: 3, c: 0 }, to: { r: 1, c: 1 } }],
      phaseGates: [],
      sentinels: [
        {
          id: 's1',
          orbit: [
            { r: 2, c: 3 },
            { r: 1, c: 3 },
            { r: 2, c: 3 },
            { r: 1, c: 4 },
          ],
        },
      ],
    };
  }

  if (age === 9 && stageNumber === 20) {
    // Age 9, Stage 20: Double-Sentinel Warp & Ice Paradox
    const tiles = makeFloor(6, 6);
    tiles[3][1] = 'void';
    tiles[3][2] = 'void';
    tiles[3][3] = 'void';
    tiles[3][4] = 'void';
    tiles[3][5] = 'void';
    tiles[4][4] = 'void';
    tiles[4][5] = 'void';
    tiles[0][3] = 'void';
    tiles[1][3] = 'void';
    tiles[5][3] = 'switch';
    tiles[4][0] = 'warp';
    tiles[2][3] = 'ice';
    tiles[2][4] = 'ice';
    tiles[1][5] = 'gate';
    tiles[0][4] = 'phase_gate';
    tiles[0][5] = 'goal';
    return {
      id: 'inh-9-20',
      age: 9,
      stageNumber: 20,
      rows: 6,
      cols: 6,
      start: { r: 5, c: 0 },
      goal: { r: 0, c: 5 },
      maxMoves: 14,
      allowWait: true,
      tiles,
      initialGatesOpen: { '1,5': false },
      switches: [{ r: 5, c: 3, targets: [{ r: 1, c: 5 }] }],
      warpLinks: [{ from: { r: 4, c: 0 }, to: { r: 2, c: 2 } }],
      phaseGates: [{ r: 0, c: 4, period: 2, openMod: 0 }],
      sentinels: [
        {
          id: 's1',
          orbit: [
            { r: 5, c: 2 },
            { r: 4, c: 2 },
            { r: 5, c: 2 },
            { r: 4, c: 3 },
          ],
        },
        {
          id: 's2',
          orbit: [
            { r: 1, c: 4 },
            { r: 2, c: 5 },
            { r: 1, c: 4 },
            { r: 2, c: 4 },
          ],
        },
      ],
    };
  }

  // Age 9, Stage 25: Triple-Switch Mirror Lock + Fragile Shortcut + Twin Sentinels
  const tiles = makeFloor(6, 6);
  tiles[0][3] = 'void';
  tiles[1][3] = 'void';
  tiles[3][3] = 'void';
  tiles[4][3] = 'void';
  tiles[5][3] = 'void';
  tiles[3][5] = 'void';
  tiles[4][4] = 'void';
  tiles[0][4] = 'void';
  tiles[5][2] = 'switch'; // toggles GateA (2,3) & GateC (1,5)
  tiles[2][1] = 'switch'; // toggles GateA (2,3) & GateB (1,4)
  tiles[2][3] = 'gate';   // GateA (initially true)
  tiles[1][4] = 'gate';   // GateB (initially false)
  tiles[1][5] = 'gate';   // GateC (initially true)
  tiles[2][4] = 'fragile';
  tiles[0][5] = 'goal';
  return {
    id: 'inh-9-25',
    age: 9,
    stageNumber: 25,
    rows: 6,
    cols: 6,
    start: { r: 5, c: 0 },
    goal: { r: 0, c: 5 },
    maxMoves: 16,
    allowWait: true,
    tiles,
    initialGatesOpen: {
      '2,3': true,
      '1,4': false,
      '1,5': true,
    },
    switches: [
      { r: 5, c: 2, targets: [{ r: 2, c: 3 }, { r: 1, c: 5 }] },
      { r: 2, c: 1, targets: [{ r: 2, c: 3 }, { r: 1, c: 4 }] },
    ],
    phaseGates: [],
    sentinels: [
      {
        id: 's1',
        orbit: [
          { r: 4, c: 1 },
          { r: 4, c: 2 },
          { r: 3, c: 2 },
          { r: 3, c: 1 },
        ],
      },
      {
        id: 's2',
        orbit: [
          { r: 2, c: 5 },
          { r: 2, c: 4 },
          { r: 2, c: 5 },
          { r: 3, c: 4 },
        ],
      },
    ],
  };
}
