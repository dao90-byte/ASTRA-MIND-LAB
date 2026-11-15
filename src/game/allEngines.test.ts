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

test('Progression unlocks strictly sequentially 1..8 and awards independent medals per age track', () => {
  let p = createInitialProgress();
  assert.equal(isStageUnlocked(p, 7, 1), true);
  assert.equal(isStageUnlocked(p, 7, 2), false);
  assert.equal(isStageUnlocked(p, 9, 2), false);

  for (let s = 1; s < TOTAL_STAGES; s++) {
    p = completeStageInProgress(p, 7, s as StageNumber);
    assert.equal(hasEarnedMedal(p, 7, s as StageNumber), true);
    assert.equal(isStageUnlocked(p, 7, (s + 1) as StageNumber), true);
    assert.equal(isStageUnlocked(p, 9, 2), false);
  }
  p = completeStageInProgress(p, 7, 8);
  assert.equal(p[7].earnedMedals.length, 8);
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

test('System Thinking Age 9 Stage 1 requires BOTH AND-gate inputs and respects inventory', () => {
  const spec = getSystemStage(9, 1);
  const g = spec.grid.map((row) => row.map((c) => ({ ...c })));
  g[2][1] = { kind: 'splitter', rot: 3 }; // W, N, S
  // Top branch only first -> should NOT fire AND gate
  g[1][1] = { kind: 'elbow', rot: 1 };
  g[1][2] = { kind: 'straight', rot: 1 };
  g[1][3] = { kind: 'straight', rot: 1 };
  g[1][4] = { kind: 'elbow', rot: 2 };

  const partial = simulateSystemGrid(g);
  assert.equal(partial.won, false);
  assert.equal(partial.andGatesState[0].fired, false);

  // Complete bottom branch -> AND gate fires!
  g[3][1] = { kind: 'elbow', rot: 0 };
  g[3][2] = { kind: 'straight', rot: 1 };
  g[3][3] = { kind: 'straight', rot: 1 };
  g[3][4] = { kind: 'elbow', rot: 3 };

  assertInventoryRespected(g, spec.inventory);
  const solved = simulateSystemGrid(g);
  assert.equal(solved.won, true);
  assert.equal(solved.andGatesState[0].fired, true);
});

test('System Thinking Age 9 Stage 5 solves with bridge crossing, converter, and AND gate within inventory', () => {
  const spec = getSystemStage(9, 5);
  const g = spec.grid.map((row) => row.map((c) => ({ ...c })));
  // Source B (1,0) amber -> E
  g[1][1] = { kind: 'straight', rot: 1 };
  g[1][2] = { kind: 'bridge', rot: 0 };
  g[1][3] = { kind: 'straight', rot: 1 };
  g[1][4] = { kind: 'elbow', rot: 2 };
  g[2][4] = { kind: 'straight', rot: 0 };

  // Source A (0,2) cyan -> S
  g[2][2] = { kind: 'straight', rot: 0 };
  g[3][2] = { kind: 'straight', rot: 0 };
  g[4][2] = { kind: 'elbow', rot: 0 };
  g[4][3] = { kind: 'converter', rot: 1 };
  g[4][4] = { kind: 'elbow', rot: 3 };

  assertInventoryRespected(g, spec.inventory);
  const res = simulateSystemGrid(g);
  assert.equal(res.won, true);

  // Without converter, cyan+amber at AND gate outputs cyan -> Amber target fails
  g[4][3] = { kind: 'straight', rot: 1 };
  assert.equal(simulateSystemGrid(g).won, false);
});

test('Inhibitory Control Age 7 Stage 2 traps hasty col-0 path and wins on deliberate detour', () => {
  const spec = getInhibitoryStage(7, 2);

  // Hasty rush up col 0 closes GateB at (2,3)
  let hasty = createInitialInhibitoryState(spec);
  for (const act of ['up', 'up', 'up', 'right', 'right', 'right'] as const) {
    hasty = stepInhibitory(spec, hasty, act);
  }
  assert.equal(hasty.gatesOpen['2,3'], false);
  assert.deepEqual(hasty.player, { r: 1, c: 2 });

  // Deliberate detour path
  let smart = createInitialInhibitoryState(spec);
  const winActions = [
    'right', 'up', 'up', 'up', 'left', // hits SwitchA (1,0)
    'right', 'right', 'down', 'right', 'right', 'up', 'up',
  ] as const;
  for (const act of winActions) {
    smart = stepInhibitory(spec, smart, act);
  }
  assert.equal(smart.status, 'won');

  const undone = undoInhibitory(smart);
  assert.equal(undone.status, 'playing');
});

test('Inhibitory Control Age 7 Stage 6 collides if rushing, requires wait, and wins cleanly', () => {
  const spec = getInhibitoryStage(7, 6);

  // Rush straight -> Turn 4 collides with sentinel at (2,2)
  let rush = createInitialInhibitoryState(spec);
  for (const act of ['right', 'right', 'up', 'up'] as const) {
    rush = stepInhibitory(spec, rush, act);
  }
  assert.equal(rush.status, 'failed');
  assert.equal(rush.failReason, 'sentinel');

  // Verify BFS cannot win without waiting
  const canWinWithoutWait = (allowWait: boolean) => {
    const start = createInitialInhibitoryState(spec);
    const q: InhibitoryState[] = [start];
    const seen = new Set<string>();
    const actions = allowWait
      ? (['up', 'down', 'left', 'right', 'wait'] as const)
      : (['up', 'down', 'left', 'right'] as const);
    while (q.length > 0) {
      const cur = q.shift()!;
      if (cur.status === 'won') return true;
      if (cur.status === 'failed') continue;
      for (const act of actions) {
        const nxt = stepInhibitory(spec, cur, act);
        if (nxt === cur) continue;
        const key = `${nxt.player.r},${nxt.player.c},${nxt.turn}`;
        if (!seen.has(key)) {
          seen.add(key);
          q.push(nxt);
        }
      }
    }
    return false;
  };
  assert.equal(canWinWithoutWait(false), false);
  assert.equal(canWinWithoutWait(true), true);

  let smart = createInitialInhibitoryState(spec);
  for (const act of ['right', 'right', 'up', 'wait', 'up', 'up', 'up', 'right', 'right'] as const) {
    smart = stepInhibitory(spec, smart, act);
  }
  assert.equal(smart.status, 'won');
});

test('Inhibitory Control Age 9 Stage 2 and Stage 6 solve cleanly and catch hasty moves', () => {
  const spec2 = getInhibitoryStage(9, 2);
  // Trying Switch2 alone closes GateA while opening GateB -> trapped
  let skipSwitch1 = createInitialInhibitoryState(spec2);
  for (const a of ['up', 'up', 'up', 'right'] as const) {
    skipSwitch1 = stepInhibitory(spec2, skipSwitch1, a);
  }
  assert.equal(skipSwitch1.gatesOpen['2,3'], false);
  assert.equal(skipSwitch1.gatesOpen['1,4'], true);

  let s2 = createInitialInhibitoryState(spec2);
  const actions2 = [
    'right', 'right', 'up', 'left', 'up', 'up',
    'right', 'right', 'right', 'up', 'right', 'up',
  ] as const;
  for (const a of actions2) s2 = stepInhibitory(spec2, s2, a);
  assert.equal(s2.status, 'won');

  const spec6 = getInhibitoryStage(9, 6);
  let rush6 = createInitialInhibitoryState(spec6);
  for (const a of ['right', 'right', 'up', 'up'] as const) {
    rush6 = stepInhibitory(spec6, rush6, a);
  }
  assert.equal(rush6.status, 'failed');

  let smart6 = createInitialInhibitoryState(spec6);
  const actions6 = [
    'right', 'right', 'up', 'wait', 'up', 'up', 'up', 'right', 'right', 'right', 'up',
  ] as const;
  for (const a of actions6) smart6 = stepInhibitory(spec6, smart6, a);
  assert.equal(smart6.status, 'won');
});

test('Working Memory Maze paths are contiguous, induced (zero unintended shortcuts), and Spatial 3D solves cleanly', () => {
  for (const age of [7, 9] as const) {
    const maze = getMemoryMazeStage(age);
    assert.deepEqual(maze.safePath[0], maze.start);
    assert.deepEqual(maze.safePath[maze.safePath.length - 1], maze.goal);

    // Ensure strictly induced path: non-consecutive cells are never orthogonally adjacent
    for (let i = 0; i < maze.safePath.length; i++) {
      for (let j = i + 2; j < maze.safePath.length; j++) {
        assert.equal(
          isAdjacentCoord(maze.safePath[i], maze.safePath[j]),
          false,
          `Age ${age} maze has unintended shortcut between step ${i} and step ${j}`
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

  // Spatial 3D Age 7
  const sp7 = getSpatial3DStage(7);
  assert.equal(voxelsMatch(sp7.initial, sp7.target), false);
  let cur7 = rotateVoxels(sp7.initial, 'x', -1);
  cur7 = rotateVoxels(cur7, 'y', -1);
  assert.equal(voxelsMatch(cur7, sp7.target), true);

  // Spatial 3D Age 9
  const sp9 = getSpatial3DStage(9);
  assert.equal(voxelsMatch(sp9.initial, sp9.target), false);
  let cur9 = rotateVoxels(sp9.initial, 'z', -1);
  cur9 = rotateVoxels(cur9, 'y', -1);
  cur9 = rotateVoxels(cur9, 'x', -1);
  assert.equal(voxelsMatch(cur9, sp9.target), true);
});

test('Emergent Sandbox stages fail empty and allow multiple distinct winning designs within toolbox', () => {
  // Age 7 Stage 4
  const sb74 = getSandboxStage(7, 4);
  assert.equal(simulateFullSandboxRun(sb74, []).won, false);

  const sol74Wind: PlacedTool[] = [{ id: 'w1', kind: 'wind', x: 320, y: 200, angleDeg: 0 }];
  assertToolboxRespected(sol74Wind, sb74.toolbox);
  assert.equal(simulateFullSandboxRun(sb74, sol74Wind).won, true);

  const sol74Plank: PlacedTool[] = [{ id: 'p1', kind: 'plank', x: 320, y: 320, angleDeg: 0 }];
  assertToolboxRespected(sol74Plank, sb74.toolbox);
  assert.equal(simulateFullSandboxRun(sb74, sol74Plank).won, true);

  const sol74Attractor: PlacedTool[] = [{ id: 'a1', kind: 'attractor', x: 440, y: 200, angleDeg: 0 }];
  assertToolboxRespected(sol74Attractor, sb74.toolbox);
  assert.equal(simulateFullSandboxRun(sb74, sol74Attractor).won, true);

  // Age 7 Stage 8
  const sb78 = getSandboxStage(7, 8);
  assert.equal(simulateFullSandboxRun(sb78, []).won, false);

  const sol78Attractor: PlacedTool[] = [{ id: 'a1', kind: 'attractor', x: 480, y: 200, angleDeg: 0 }];
  assertToolboxRespected(sol78Attractor, sb78.toolbox);
  assert.equal(simulateFullSandboxRun(sb78, sol78Attractor).won, true);

  const sol78PlankWind: PlacedTool[] = [
    { id: 'p1', kind: 'plank', x: 180, y: 220, angleDeg: -20 },
    { id: 'w1', kind: 'wind', x: 420, y: 360, angleDeg: -25 },
  ];
  assertToolboxRespected(sol78PlankWind, sb78.toolbox);
  assert.equal(simulateFullSandboxRun(sb78, sol78PlankWind).won, true);

  // Age 9 Stage 4
  const sb94 = getSandboxStage(9, 4);
  assert.equal(simulateFullSandboxRun(sb94, []).won, false);

  const sol94Wind: PlacedTool[] = [{ id: 'w1', kind: 'wind', x: 160, y: 240, angleDeg: -25 }];
  assertToolboxRespected(sol94Wind, sb94.toolbox);
  assert.equal(simulateFullSandboxRun(sb94, sol94Wind).won, true);

  const sol94Plank: PlacedTool[] = [{ id: 'p1', kind: 'plank', x: 240, y: 320, angleDeg: 20 }];
  assertToolboxRespected(sol94Plank, sb94.toolbox);
  assert.equal(simulateFullSandboxRun(sb94, sol94Plank).won, true);

  // Age 9 Stage 8
  const sb98 = getSandboxStage(9, 8);
  assert.equal(simulateFullSandboxRun(sb98, []).won, false);

  const sol98Wind: PlacedTool[] = [{ id: 'w1', kind: 'wind', x: 160, y: 240, angleDeg: -45 }];
  assertToolboxRespected(sol98Wind, sb98.toolbox);
  assert.equal(simulateFullSandboxRun(sb98, sol98Wind).won, true);

  const sol98PlankWind: PlacedTool[] = [
    { id: 'p1', kind: 'plank', x: 300, y: 260, angleDeg: -20 },
    { id: 'w1', kind: 'wind', x: 420, y: 360, angleDeg: -25 },
  ];
  assertToolboxRespected(sol98PlankWind, sb98.toolbox);
  assert.equal(simulateFullSandboxRun(sb98, sol98PlankWind).won, true);
});
