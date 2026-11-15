import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOTAL_STAGES,
  createInitialProgress,
  completeStageInProgress,
  isStageUnlocked,
  hasEarnedMedal,
} from './progression';
import { CellData, SystemInventory, getSystemStage, simulateSystemGrid } from './systemThinking';
import {
  InhibitoryState,
  getInhibitoryStage,
  createInitialInhibitoryState,
  stepInhibitory,
  undoInhibitory,
} from './inhibitoryControl';
import {
  getMemoryMazeStage,
  isAdjacentCoord,
  stepMemoryMaze,
  getSpatial3DStage,
  rotateVoxels,
  voxelsMatch,
} from './memorySpatial';
import {
  getSandboxStage,
  simulateFullSandboxRun,
  PlacedTool,
  SandboxToolbox,
} from './emergentSandbox';
import { StageNumber } from './types';

function assertInventoryRespected(grid: CellData[][], inventory: SystemInventory) {
  const used: Record<string, number> = {};
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.locked && cell.kind !== 'empty') {
        used[cell.kind] = (used[cell.kind] ?? 0) + 1;
      }
    }
  }
  for (const [kind, count] of Object.entries(used)) {
    const avail = inventory[kind as keyof SystemInventory] ?? 0;
    assert.ok(count <= avail, `Used ${count} of ${kind}, exceeds inventory ${avail}`);
  }
}

function assertToolboxRespected(tools: PlacedTool[], toolbox: SandboxToolbox) {
  const used: Record<string, number> = {};
  for (const t of tools) {
    used[t.kind] = (used[t.kind] ?? 0) + 1;
  }
  for (const [kind, count] of Object.entries(used)) {
    const avail = toolbox[kind as keyof SandboxToolbox] ?? 0;
    assert.ok(count <= avail, `Used ${count} of ${kind}, exceeds toolbox ${avail}`);
  }
}

test('Progression unlocks strictly sequentially 1..18 and awards independent medals per age track', () => {
  let p = createInitialProgress();
  assert.equal(TOTAL_STAGES, 18);
  assert.equal(isStageUnlocked(p, 7, 1), true);
  assert.equal(isStageUnlocked(p, 7, 2), false);
  assert.equal(isStageUnlocked(p, 9, 2), false);

  for (let s = 1; s < TOTAL_STAGES; s++) {
    p = completeStageInProgress(p, 7, s as StageNumber);
    assert.equal(hasEarnedMedal(p, 7, s as StageNumber), true);
    assert.equal(isStageUnlocked(p, 7, (s + 1) as StageNumber), true);
    assert.equal(isStageUnlocked(p, 9, 2), false);
  }
  p = completeStageInProgress(p, 7, 18);
  assert.equal(p[7].earnedMedals.length, 18);
  assert.equal(p[9].earnedMedals.length, 0);
});

test('System Thinking Age 7 Stage 1 solves within inventory and fails incomplete', () => {
  const spec = getSystemStage(7, 1);
  assert.equal(simulateSystemGrid(spec.grid).won, false);

  const g = spec.grid.map((row) => row.map((c) => ({ ...c })));
  g[2][1] = { kind: 'elbow', rot: 3 }; // W-N
  g[1][1] = { kind: 'elbow', rot: 1 }; // E-S
  g[1][2] = { kind: 'straight', rot: 1 }; // E-W
  g[1][3] = { kind: 'elbow', rot: 2 }; // S-W
  g[2][3] = { kind: 'straight', rot: 0 }; // N-S
  g[3][3] = { kind: 'elbow', rot: 0 }; // N-E
  g[3][4] = { kind: 'elbow', rot: 2 }; // S-W

  assertInventoryRespected(g, spec.inventory);
  const res = simulateSystemGrid(g);
  assert.equal(res.won, true);
});

test('System Thinking Age 7 Stage 5 solves dual cyan+amber targets via splitter & converter within inventory', () => {
  const spec = getSystemStage(7, 5);
  const g = spec.grid.map((row) => row.map((c) => ({ ...c })));
  g[1][2] = { kind: 'splitter', rot: 0 };
  g[1][1] = { kind: 'straight', rot: 1 };
  g[1][0] = { kind: 'elbow', rot: 1 }; // E-S
  g[2][0] = { kind: 'straight', rot: 0 };
  g[3][0] = { kind: 'straight', rot: 0 };
  g[1][3] = { kind: 'straight', rot: 1 };
  g[1][4] = { kind: 'elbow', rot: 2 }; // S-W
  g[2][4] = { kind: 'converter', rot: 0 };
  g[3][4] = { kind: 'straight', rot: 0 };

  assertInventoryRespected(g, spec.inventory);
  const res = simulateSystemGrid(g);
  assert.equal(res.won, true);

  // Removing converter causes wrong color at Amber target
  g[2][4] = { kind: 'straight', rot: 0 };
  const wrongColorRes = simulateSystemGrid(g);
  assert.equal(wrongColorRes.won, false);
});

test('System Thinking Age 7 Stage 9 (Quantum Wormhole) and Stage 14 (Dual-Sided 45° Prism Mirror) solve within inventory', () => {
  // Stage 9: Quantum Wormhole across impenetrable rock wall
  const spec9 = getSystemStage(7, 9);
  assert.equal(simulateSystemGrid(spec9.grid).won, false);
  const g9 = spec9.grid.map((row) => row.map((c) => ({ ...c })));
  g9[0][1] = { kind: 'straight', rot: 1 };
  g9[0][2] = { kind: 'splitter', rot: 2 }; // E, S, W -> E to (0,3), S into Portal A (1,2)
  g9[0][3] = { kind: 'straight', rot: 1 }; // reaches Cyan Target (0,4)
  // Exits Portal A (3,1) going S into (4,1)
  g9[4][1] = { kind: 'elbow', rot: 0 }; // N-E
  g9[4][2] = { kind: 'converter', rot: 1 }; // E-W cyan -> amber
  g9[4][3] = { kind: 'straight', rot: 1 }; // reaches Amber Target (4,4)
  assertInventoryRespected(g9, spec9.inventory);
  assert.equal(simulateSystemGrid(g9).won, true);

  // Stage 14: Single Dual-Sided 45° Crystal Mirror at (2,2) reflects both opposing beams simultaneously
  const spec14 = getSystemStage(7, 14);
  assert.equal(simulateSystemGrid(spec14.grid).won, false);
  const g14 = spec14.grid.map((row) => row.map((c) => ({ ...c })));
  g14[1][2] = { kind: 'straight', rot: 0 }; // N-S cyan into (2,2)
  g14[3][2] = { kind: 'straight', rot: 0 }; // N-S amber into (2,2)
  g14[2][2] = { kind: 'mirror', rot: 0 }; // '/' reflects N->W (cyan) and S->E (amber)
  g14[2][1] = { kind: 'straight', rot: 1 }; // E-W into Cyan Target (2,0)
  g14[2][3] = { kind: 'straight', rot: 1 }; // E-W into Amber Target (2,4)
  assertInventoryRespected(g14, spec14.inventory);
  assert.equal(simulateSystemGrid(g14).won, true);
});

test('System Thinking Age 9 Stage 1 & Stage 5 & Stage 9 (Dual Mirror + Twin Portals) & Stage 14 (XOR + AND Synthesis) solve within inventory', () => {
  const spec1 = getSystemStage(9, 1);
  const g1 = spec1.grid.map((row) => row.map((c) => ({ ...c })));
  g1[2][1] = { kind: 'splitter', rot: 3 };
  g1[1][1] = { kind: 'elbow', rot: 1 };
  g1[1][2] = { kind: 'straight', rot: 1 };
  g1[1][3] = { kind: 'straight', rot: 1 };
  g1[1][4] = { kind: 'elbow', rot: 2 };
  g1[3][1] = { kind: 'elbow', rot: 0 };
  g1[3][2] = { kind: 'straight', rot: 1 };
  g1[3][3] = { kind: 'straight', rot: 1 };
  g1[3][4] = { kind: 'elbow', rot: 3 };
  assertInventoryRespected(g1, spec1.inventory);
  assert.equal(simulateSystemGrid(g1).won, true);

  const spec5 = getSystemStage(9, 5);
  const g5 = spec5.grid.map((row) => row.map((c) => ({ ...c })));
  g5[1][1] = { kind: 'straight', rot: 1 };
  g5[1][2] = { kind: 'bridge', rot: 0 };
  g5[1][3] = { kind: 'straight', rot: 1 };
  g5[1][4] = { kind: 'elbow', rot: 2 };
  g5[2][4] = { kind: 'straight', rot: 0 };
  g5[2][2] = { kind: 'straight', rot: 0 };
  g5[3][2] = { kind: 'straight', rot: 0 };
  g5[4][2] = { kind: 'elbow', rot: 0 };
  g5[4][3] = { kind: 'converter', rot: 1 };
  g5[4][4] = { kind: 'elbow', rot: 3 };
  assertInventoryRespected(g5, spec5.inventory);
  assert.equal(simulateSystemGrid(g5).won, true);

  // Age 9 Stage 9: Dual-Sided Prism Mirror at (2,1) + Twin Wormholes A & B + AND Gate
  const spec9 = getSystemStage(9, 9);
  const g9 = spec9.grid.map((row) => row.map((c) => ({ ...c })));
  g9[1][1] = { kind: 'converter', rot: 0 }; // N-S converts top cyan -> amber
  g9[4][1] = { kind: 'converter', rot: 0 }; // N-S converts bottom cyan -> amber
  g9[3][1] = { kind: 'straight', rot: 0 }; // N-S
  g9[2][1] = { kind: 'mirror', rot: 1 }; // '\' reflects N->E into Portal A (2,2) and S->W into Portal B (2,0)
  // Portal A exits (0,3) going E into (0,4)
  g9[0][4] = { kind: 'elbow', rot: 2 }; // S-W into AND gate N port at (1,4)
  // Portal B exits (3,5) going W into (3,4)
  g9[3][4] = { kind: 'elbow', rot: 0 }; // N-E into (2,4)
  g9[2][4] = { kind: 'straight', rot: 0 }; // N-S into AND gate S port at (1,4)
  assertInventoryRespected(g9, spec9.inventory);
  const solved9 = simulateSystemGrid(g9);
  assert.equal(solved9.andGatesState[0].fired, true);
  assert.equal(solved9.won, true);

  // Age 9 Stage 14: Exclusive Resonance (XOR Gate) + AND Gate Dual-Logic Synthesis
  const spec14 = getSystemStage(9, 14);
  const g14 = spec14.grid.map((row) => row.map((c) => ({ ...c })));
  g14[1][1] = { kind: 'splitter', rot: 2 }; // E, S, W
  g14[1][2] = { kind: 'straight', rot: 1 };
  g14[1][3] = { kind: 'straight', rot: 1 };
  g14[1][4] = { kind: 'elbow', rot: 2 }; // S-W into XOR gate N port at (2,4)
  g14[2][1] = { kind: 'straight', rot: 0 };
  g14[3][1] = { kind: 'elbow', rot: 0 }; // N-E
  g14[3][2] = { kind: 'converter', rot: 1 }; // E-W converts cyan -> amber
  g14[3][3] = { kind: 'straight', rot: 1 };
  g14[3][4] = { kind: 'elbow', rot: 2 }; // S-W into AND gate N port at (4,4)
  g14[5][2] = { kind: 'straight', rot: 1 };
  g14[5][3] = { kind: 'straight', rot: 1 };
  g14[5][4] = { kind: 'elbow', rot: 3 }; // W-N into AND gate S port at (4,4)
  assertInventoryRespected(g14, spec14.inventory);
  const solved14 = simulateSystemGrid(g14);
  assert.equal(solved14.won, true);
});

test('Inhibitory Control Stages 2, 6, 10 (Warp), and 15 (Ice Slide) solve cleanly across Age 7 and Age 9', () => {
  // Age 7 Stage 2
  const spec72 = getInhibitoryStage(7, 2);
  let s72 = createInitialInhibitoryState(spec72);
  for (const act of ['right', 'up', 'up', 'up', 'left', 'right', 'right', 'down', 'right', 'right', 'up', 'up'] as const) {
    s72 = stepInhibitory(spec72, s72, act);
  }
  assert.equal(s72.status, 'won');

  // Age 7 Stage 6
  const spec76 = getInhibitoryStage(7, 6);
  let s76 = createInitialInhibitoryState(spec76);
  for (const act of ['right', 'right', 'up', 'wait', 'up', 'up', 'up', 'right', 'right'] as const) {
    s76 = stepInhibitory(spec76, s76, act);
  }
  assert.equal(s76.status, 'won');

  // Helper BFS solver for Inhibitory stages
  const solveInhibitoryBFS = (age: 7 | 9, stageNum: 2 | 6 | 10 | 15): InhibitoryState | null => {
    const spec = getInhibitoryStage(age, stageNum);
    const start = createInitialInhibitoryState(spec);
    const q: InhibitoryState[] = [start];
    const seen = new Set<string>();
    const actions = ['up', 'down', 'left', 'right', 'wait'] as const;
    while (q.length > 0) {
      const cur = q.shift()!;
      if (cur.status === 'won') return cur;
      if (cur.status === 'failed' || cur.turn >= 28) continue;
      for (const act of actions) {
        const nxt = stepInhibitory(spec, cur, act);
        if (nxt === cur) continue;
        const gateKey = Object.entries(nxt.gatesOpen)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}:${v ? 1 : 0}`)
          .join('|');
        const key = `${nxt.player.r},${nxt.player.c},${nxt.turn % 8},${gateKey}`;
        if (!seen.has(key)) {
          seen.add(key);
          q.push(nxt);
        }
      }
    }
    return null;
  };

  for (const age of [7, 9] as const) {
    for (const st of [2, 6, 10, 15] as const) {
      const winState = solveInhibitoryBFS(age, st);
      assert.ok(winState !== null, `Inhibitory Age ${age} Stage ${st} must be solvable`);
      assert.equal(winState.status, 'won');
      const undone = undoInhibitory(winState);
      assert.equal(undone.status, 'playing');
    }
  }
});

test('Working Memory Maze (Stages 3, 11, 16) and Spatial 3D (Stages 7, 12, 17) solve cleanly for Age 7 and Age 9', () => {
  for (const age of [7, 9] as const) {
    for (const st of [3, 11, 16] as const) {
      const maze = getMemoryMazeStage(age, st);
      assert.deepEqual(maze.safePath[0], maze.start);
      assert.deepEqual(maze.safePath[maze.safePath.length - 1], maze.goal);

      // Ensure strictly induced path: non-consecutive cells are never orthogonally adjacent
      for (let i = 0; i < maze.safePath.length; i++) {
        for (let j = i + 2; j < maze.safePath.length; j++) {
          assert.equal(
            isAdjacentCoord(maze.safePath[i], maze.safePath[j]),
            false,
            `Age ${age} Stage ${st} maze has unintended shortcut between step ${i} and step ${j}`
          );
        }
      }

      let path = [maze.start];
      let won = false;
      for (let i = 1; i < maze.safePath.length; i++) {
        const res = stepMemoryMaze(maze, path, maze.safePath[i]);
        assert.equal(res.ok, true);
        path = res.nextPath;
        won = res.won;
      }
      assert.equal(won, true);
    }

    // Spatial 3D Stages 7, 12, 17: verify initial != target and reachable via 3D rotations
    for (const st of [7, 12, 17] as const) {
      const sp = getSpatial3DStage(age, st);
      assert.equal(voxelsMatch(sp.initial, sp.target), false, `Spatial3D Age ${age} Stage ${st} initial should not already match target`);

      // BFS over 90-degree rotations to verify target is reachable within 4 moves
      const q: Array<{ v: typeof sp.initial; depth: number }> = [{ v: sp.initial, depth: 0 }];
      let matched = false;
      while (q.length > 0) {
        const cur = q.shift()!;
        if (voxelsMatch(cur.v, sp.target)) {
          matched = true;
          break;
        }
        if (cur.depth >= 4) continue;
        for (const axis of ['x', 'y', 'z'] as const) {
          for (const dir of [1, -1] as const) {
            q.push({ v: rotateVoxels(cur.v, axis, dir), depth: cur.depth + 1 });
          }
        }
      }
      assert.equal(matched, true, `Spatial3D Age ${age} Stage ${st} target must be reachable via 3D rotations`);
    }
  }
});

test('Emergent Sandbox Stages 4, 8, 13 (Wormhole), and 18 (Anti-Gravity) fail empty and solve within toolbox', () => {
  // Age 7 Stage 4
  const sb74 = getSandboxStage(7, 4);
  assert.equal(simulateFullSandboxRun(sb74, []).won, false);
  const sol74Wind: PlacedTool[] = [{ id: 'w1', kind: 'wind', x: 320, y: 200, angleDeg: 0 }];
  assertToolboxRespected(sol74Wind, sb74.toolbox);
  assert.equal(simulateFullSandboxRun(sb74, sol74Wind).won, true);

  // Age 7 Stage 8
  const sb78 = getSandboxStage(7, 8);
  assert.equal(simulateFullSandboxRun(sb78, []).won, false);
  const sol78Attractor: PlacedTool[] = [{ id: 'a1', kind: 'attractor', x: 480, y: 200, angleDeg: 0 }];
  assertToolboxRespected(sol78Attractor, sb78.toolbox);
  assert.equal(simulateFullSandboxRun(sb78, sol78Attractor).won, true);

  // Age 7 Stage 13 (Anti-Gravity + Wormhole Shortcut)
  const sb713 = getSandboxStage(7, 13);
  assert.equal(simulateFullSandboxRun(sb713, []).won, false);
  const sol713: PlacedTool[] = [
    { id: 'w1', kind: 'wind', x: 160, y: 350, angleDeg: 35 },
  ];
  assertToolboxRespected(sol713, sb713.toolbox);
  assert.equal(simulateFullSandboxRun(sb713, sol713).won, true);

  // Age 7 Stage 18 (Twin-Crystal Canyon Slalom)
  const sb718 = getSandboxStage(7, 18);
  assert.equal(simulateFullSandboxRun(sb718, []).won, false);
  const sol718: PlacedTool[] = [
    { id: 'w1', kind: 'wind', x: 180, y: 160, angleDeg: 35 },
    { id: 'w2', kind: 'wind', x: 400, y: 280, angleDeg: 0 },
  ];
  assertToolboxRespected(sol718, sb718.toolbox);
  assert.equal(simulateFullSandboxRun(sb718, sol718).won, true);

  // Age 9 Stage 4
  const sb94 = getSandboxStage(9, 4);
  assert.equal(simulateFullSandboxRun(sb94, []).won, false);
  const sol94Wind: PlacedTool[] = [{ id: 'w1', kind: 'wind', x: 160, y: 240, angleDeg: -25 }];
  assertToolboxRespected(sol94Wind, sb94.toolbox);
  assert.equal(simulateFullSandboxRun(sb94, sol94Wind).won, true);

  // Age 9 Stage 8
  const sb98 = getSandboxStage(9, 8);
  assert.equal(simulateFullSandboxRun(sb98, []).won, false);
  const sol98Wind: PlacedTool[] = [{ id: 'w1', kind: 'wind', x: 160, y: 240, angleDeg: -45 }];
  assertToolboxRespected(sol98Wind, sb98.toolbox);
  assert.equal(simulateFullSandboxRun(sb98, sol98Wind).won, true);

  // Age 9 Stage 13 (Anti-Gravity + Wormhole Slingshot)
  const sb913 = getSandboxStage(9, 13);
  assert.equal(simulateFullSandboxRun(sb913, []).won, false);
  const sol913: PlacedTool[] = [
    { id: 'w1', kind: 'wind', x: 185, y: 375, angleDeg: 25 },
    { id: 'a1', kind: 'attractor', x: 645, y: 365, angleDeg: 0 },
  ];
  assertToolboxRespected(sol913, sb913.toolbox);
  assert.equal(simulateFullSandboxRun(sb913, sol913).won, true);

  // Age 9 Stage 18 (Grand Zero-G Diamond Fortress & Quantum Wormhole)
  const sb918 = getSandboxStage(9, 18);
  assert.equal(simulateFullSandboxRun(sb918, []).won, false);
  const sol918: PlacedTool[] = [
    { id: 'w1', kind: 'wind', x: 140, y: 250, angleDeg: -55 },
  ];
  assertToolboxRespected(sol918, sb918.toolbox);
  assert.equal(simulateFullSandboxRun(sb918, sol918).won, true);
});

