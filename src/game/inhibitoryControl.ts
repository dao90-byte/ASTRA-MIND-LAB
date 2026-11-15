import { AgeGroup } from './types';

export type InhibitoryTileKind = 'floor' | 'void' | 'goal' | 'fragile' | 'switch' | 'gate' | 'phase_gate';

export interface Coord {
  r: number;
  c: number;
}

export interface SwitchLink {
  r: number;
  c: number;
  targets: Coord[]; // gate coordinates toggled when stepped on
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

export interface InhibitoryStageSpec {
  id: string;
  age: AgeGroup;
  stageNumber: 2 | 6;
  rows: number;
  cols: number;
  start: Coord;
  goal: Coord;
  maxMoves: number;
  allowWait: boolean;
  tiles: InhibitoryTileKind[][];
  initialGatesOpen: Record<string, boolean>; // key: "r,c"
  switches: SwitchLink[];
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

  let nr = state.player.r;
  let nc = state.player.c;
  if (action === 'up') nr -= 1;
  if (action === 'down') nr += 1;
  if (action === 'left') nc -= 1;
  if (action === 'right') nc += 1;

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

  // Fragile tile left behind breaks or cracks
  if (action !== 'wait') {
    const prevKey = keyOf(state.player.r, state.player.c);
    if (spec.tiles[state.player.r][state.player.c] === 'fragile') {
      if (nextCracked[prevKey]) {
        nextBroken[prevKey] = true;
      } else {
        nextBroken[prevKey] = true; // 1-step crystal bridge shatters after leaving
      }
    }
  }

  // Trigger switch on landing
  if (action !== 'wait') {
    const sw = spec.switches.find((s) => s.r === nr && s.c === nc);
    if (sw) {
      for (const tgt of sw.targets) {
        const tk = keyOf(tgt.r, tgt.c);
        nextGates[tk] = !nextGates[tk];
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

export function getInhibitoryStage(age: AgeGroup, stageNumber: 2 | 6): InhibitoryStageSpec {
  if (age === 7 && stageNumber === 2) {
    // 5x5 Linked Switch Trap: rushing up col 0 hits SwitchB (2,0) which closes GateB (2,3) 5 steps later!
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
    // 5x5 Sentinel + Wait + Phase Gate
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

  if (age === 9 && stageNumber === 2) {
    // 6x6 Double-Linked Switch Sequencing
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

  // Age 9, Stage 6: Twin Sentinels + Fragile Nexus + Phase Gate
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
