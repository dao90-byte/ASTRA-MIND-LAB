import { Separator, ToggleGroup, Toolbar } from 'radix-ui';
import { useEffect, useMemo, useState } from 'react';
import { Eraser, Play, RotateCw, Square } from 'lucide-react';
import {
  BeamColor,
  BeamSegment,
  CellData,
  Direction,
  ModuleKind,
  SimulationResult,
  getAndInputPorts,
  getAndOutputPort,
  getSystemStage,
  simulateSystemGrid,
} from '../game/systemThinking';
import { cosmicSound } from '../game/sound';
import { AgeGroup } from '../game/types';

const TOOL_ORDER: Array<'elbow' | 'straight' | 'splitter' | 'bridge' | 'converter'> = [
  'elbow',
  'straight',
  'splitter',
  'bridge',
  'converter',
];

function portPoint(dir: Direction): [number, number] {
  if (dir === 0) return [50, 0];
  if (dir === 1) return [100, 50];
  if (dir === 2) return [50, 100];
  return [0, 50];
}

function beamHex(color: BeamColor): string {
  return color === 'amber' ? '#FFD23F' : '#22EBFF';
}

function ModuleGlyph({
  kind,
  rot,
  color,
  andState,
  ghost = false,
}: {
  kind: ModuleKind;
  rot: Direction;
  color?: BeamColor;
  andState?: { inputA: boolean; inputB: boolean; fired: boolean };
  ghost?: boolean;
}) {
  const angle = rot * 90;
  if (kind === 'rock') {
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
        <polygon
          points="50,12 78,34 84,68 50,88 18,68 22,34"
          fill="#151A48"
          stroke="#6A77C7"
          strokeWidth="2.8"
          strokeLinejoin="miter"
        />
        <polygon points="50,12 78,34 50,52 22,34" fill="#283173" opacity="0.85" />
        <polygon points="50,52 78,34 84,68 50,88" fill="#0D1136" opacity="0.9" />
        <polygon points="50,34 62,50 50,66 38,50" fill="none" stroke="#99A5F0" strokeWidth="1.6" strokeOpacity="0.65" />
      </svg>
    );
  }

  if (kind === 'source') {
    const c = beamHex(color ?? 'cyan');
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
        <g transform={`rotate(${angle} 50 50)`}>
          <polygon points="50,16 80,50 50,84 20,50" fill={`${c}1C`} stroke={c} strokeWidth="2.2" strokeOpacity="0.75" />
          <polygon points="50,26 70,50 50,74 30,50" fill={`${c}35`} stroke={c} strokeWidth="3.2" />
          <polygon points="50,5 62,28 38,28" fill={c} />
          <polygon points="50,40 59,50 50,60 41,50" fill="#FFFFFF" />
        </g>
      </svg>
    );
  }

  if (kind === 'target') {
    const c = beamHex(color ?? 'cyan');
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
        <polygon points="50,14 82,32 82,68 50,86 18,68 18,32" fill={`${c}16`} stroke={c} strokeWidth="2.4" strokeDasharray="7 5" />
        <polygon points="50,23 73,50 50,77 27,50" fill={`${c}36`} stroke={c} strokeWidth="3.2" strokeLinejoin="miter" />
        <polygon points="50,41 59,50 50,59 41,50" fill={c} stroke="#FFFFFF" strokeWidth="1.4" />
      </svg>
    );
  }

  if (kind === 'and_gate') {
    const [pA, pB] = getAndInputPorts(rot);
    const outP = getAndOutputPort(rot);
    const [ax, ay] = portPoint(pA);
    const [bx, by] = portPoint(pB);
    const [ox, oy] = portPoint(outP);
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
        <line x1={ax} y1={ay} x2="50" y2="50" stroke={andState?.inputA ? '#22EBFF' : '#5864A8'} strokeWidth="6.5" strokeLinecap="square" />
        <line x1={bx} y1={by} x2="50" y2="50" stroke={andState?.inputB ? '#22EBFF' : '#5864A8'} strokeWidth="6.5" strokeLinecap="square" />
        <line x1="50" y1="50" x2={ox} y2={oy} stroke={andState?.fired ? '#2DF59A' : '#7682C2'} strokeWidth="6.5" strokeLinecap="square" />
        <polygon
          points="50,18 82,50 50,82 18,50"
          fill={andState?.fired ? '#0E4A42' : '#121847'}
          stroke={andState?.fired ? '#2DF59A' : '#B378FF'}
          strokeWidth="3.4"
          strokeLinejoin="miter"
        />
        <polygon points="41,45 45.5,50 41,55 36.5,50" fill={andState?.inputA ? '#22EBFF' : '#3B447D'} stroke="#FFFFFF" strokeWidth="1.2" />
        <polygon points="59,45 63.5,50 59,55 54.5,50" fill={andState?.inputB ? '#22EBFF' : '#3B447D'} stroke="#FFFFFF" strokeWidth="1.2" />
      </svg>
    );
  }

  const pipeColor = ghost ? '#22EBFF' : '#D5DDFF';
  return (
    <svg viewBox="0 0 100 100" className={`w-full h-full ${ghost ? 'opacity-45' : ''}`} aria-hidden="true">
      <g transform={`rotate(${angle} 50 50)`}>
        {kind === 'straight' && (
          <path d="M50 0V100" stroke={pipeColor} strokeWidth="9.5" strokeLinecap="square" />
        )}
        {kind === 'elbow' && (
          <path d="M50 0V50H100" fill="none" stroke={pipeColor} strokeWidth="9.5" strokeLinecap="square" strokeLinejoin="miter" />
        )}
        {kind === 'splitter' && (
          <g>
            <path d="M0 50H100M50 50V0" fill="none" stroke={pipeColor} strokeWidth="9.5" strokeLinecap="square" />
            <polygon points="50,36 64,50 50,64 36,50" fill="#FF4EC6" stroke="#FFFFFF" strokeWidth="2" />
          </g>
        )}
        {kind === 'bridge' && (
          <g>
            <path d="M50 0V100" stroke="#7682C2" strokeWidth="9.5" />
            <path d="M0 50H32M68 50H100" stroke={pipeColor} strokeWidth="9.5" />
            <path d="M32 50L44 34H56L68 50" fill="none" stroke="#2DF59A" strokeWidth="8.5" strokeLinejoin="miter" />
          </g>
        )}
        {kind === 'converter' && (
          <g>
            <path d="M50 0V100" stroke={pipeColor} strokeWidth="9.5" />
            <polygon points="50,22 72,50 50,78 28,50" fill="#FFD23F" fillOpacity="0.35" stroke="#FFD23F" strokeWidth="3.2" />
            <polygon points="50,41 59,50 50,59 41,50" fill="#FF4EC6" stroke="#FFFFFF" strokeWidth="1.2" />
          </g>
        )}
      </g>
    </svg>
  );
}

export function SystemBoard({
  age,
  stageNumber,
  resetSignal,
  onWin,
}: {
  age: AgeGroup;
  stageNumber: 1 | 5;
  resetSignal: number;
  onWin: () => void;
}) {
  const spec = useMemo(() => getSystemStage(age, stageNumber), [age, stageNumber]);

  const [grid, setGrid] = useState<CellData[][]>(() =>
    spec.grid.map((row) => row.map((c) => ({ ...c })))
  );
  const [selectedTool, setSelectedTool] = useState<ModuleKind | 'erase'>(() => {
    const first = TOOL_ORDER.find((t) => (spec.inventory[t] ?? 0) > 0);
    return first ?? 'elbow';
  });
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number } | null>(null);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [animStep, setAnimStep] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [wonPending, setWonPending] = useState(false);

  useEffect(() => {
    setGrid(spec.grid.map((row) => row.map((c) => ({ ...c }))));
    const first = TOOL_ORDER.find((t) => (spec.inventory[t] ?? 0) > 0);
    setSelectedTool(first ?? 'elbow');
    setHoveredCell(null);
    setSimResult(null);
    setAnimStep(-1);
    setIsRunning(false);
    setWonPending(false);
  }, [spec, resetSignal]);

  const remainingInventory = useMemo(() => {
    const counts: Record<string, number> = { ...spec.inventory };
    for (const row of grid) {
      for (const cell of row) {
        if (!cell.locked && cell.kind !== 'empty' && counts[cell.kind] !== undefined) {
          counts[cell.kind] = Math.max(0, counts[cell.kind] - 1);
        }
      }
    }
    return counts;
  }, [grid, spec.inventory]);

  useEffect(() => {
    if (!isRunning || !simResult) return;
    if (animStep >= simResult.maxStep) {
      setIsRunning(false);
      if (simResult.won) {
        cosmicSound.playVictory();
        setWonPending(true);
      } else {
        cosmicSound.playSoftError();
      }
      return;
    }
    const timer = setTimeout(() => {
      cosmicSound.playPulse();
      setAnimStep((s) => s + 1);
    }, 240);
    return () => clearTimeout(timer);
  }, [isRunning, simResult, animStep]);

  useEffect(() => {
    if (!wonPending) return;
    const t = setTimeout(() => {
      setWonPending(false);
      onWin();
    }, 480);
    return () => clearTimeout(t);
  }, [wonPending, onWin]);

  const stopSimulationPreview = () => {
    setIsRunning(false);
    setWonPending(false);
    setSimResult(null);
    setAnimStep(-1);
  };

  const handleCellClick = (r: number, c: number) => {
    const cell = grid[r][c];
    if (cell.locked) return;
    stopSimulationPreview();

    if (selectedTool === 'erase') {
      if (cell.kind !== 'empty') {
        cosmicSound.playClick();
        setGrid((prev) =>
          prev.map((row, ri) =>
            row.map((item, ci) =>
              ri === r && ci === c ? { kind: 'empty', rot: 0 } : item
            )
          )
        );
      }
      return;
    }

    if (cell.kind !== 'empty') {
      cosmicSound.playClick();
      setGrid((prev) =>
        prev.map((row, ri) =>
          row.map((item, ci) =>
            ri === r && ci === c
              ? { ...item, rot: ((item.rot + 1) % 4) as Direction }
              : item
          )
        )
      );
      return;
    }

    if ((remainingInventory[selectedTool] ?? 0) > 0) {
      cosmicSound.playPlace();
      setGrid((prev) =>
        prev.map((row, ri) =>
          row.map((item, ci) =>
            ri === r && ci === c ? { kind: selectedTool, rot: 0 } : item
          )
        )
      );
    }
  };

  const handleCellContextMenu = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    const cell = grid[r][c];
    if (cell.locked || cell.kind === 'empty') return;
    stopSimulationPreview();
    cosmicSound.playClick();
    setGrid((prev) =>
      prev.map((row, ri) =>
        row.map((item, ci) =>
          ri === r && ci === c ? { kind: 'empty', rot: 0 } : item
        )
      )
    );
  };

  const handleRun = () => {
    if (isRunning) {
      stopSimulationPreview();
      return;
    }
    const res = simulateSystemGrid(grid);
    setSimResult(res);
    setAnimStep(0);
    setIsRunning(true);
    cosmicSound.playPulse();
  };

  const visibleSegments = useMemo(() => {
    if (!simResult || animStep < 0) return new Map<string, BeamSegment[]>();
    const map = new Map<string, BeamSegment[]>();
    for (const seg of simResult.segments) {
      if (seg.step <= animStep) {
        const k = `${seg.r},${seg.c}`;
        const arr = map.get(k) ?? [];
        arr.push(seg);
        map.set(k, arr);
      }
    }
    return map;
  }, [simResult, animStep]);

  return (
    <div className="h-full w-full flex flex-col items-center justify-between gap-3 py-2">
      {/* Main Interactive Circuit Grid */}
      <div className="flex-1 flex items-center justify-center w-full min-h-0">
        <div
          className="grid gap-1.5 p-3 rounded-2xl cosmo-panel border border-[#22EBFF]/45"
          style={{
            gridTemplateColumns: `repeat(${spec.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${spec.rows}, minmax(0, 1fr))`,
            width: spec.cols === 5 ? 'min(78vw, 440px)' : 'min(82vw, 476px)',
            aspectRatio: `${spec.cols} / ${spec.rows}`,
          }}
          data-testid="system-grid"
        >
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const segs = visibleSegments.get(`${r},${c}`) ?? [];
              const andState = simResult?.andGatesState.find((g) => g.r === r && g.c === c);
              const targetMatched = simResult?.energizedTargets.find(
                (t) => t.r === r && t.c === c && animStep >= simResult.maxStep
              )?.matched;

              const showGhost =
                !cell.locked &&
                cell.kind === 'empty' &&
                hoveredCell?.r === r &&
                hoveredCell?.c === c &&
                selectedTool !== 'erase' &&
                (remainingInventory[selectedTool] ?? 0) > 0;

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handleCellClick(r, c)}
                  onContextMenu={(e) => handleCellContextMenu(e, r, c)}
                  onMouseEnter={() => setHoveredCell({ r, c })}
                  onMouseLeave={() => setHoveredCell(null)}
                  disabled={cell.locked}
                  aria-label={`Grid cell ${r + 1},${c + 1} ${cell.kind}`}
                  className={`group relative rounded-xl border transition-all duration-150 flex items-center justify-center p-1 cosmo-tile ${
                    cell.locked
                      ? 'bg-[#0E133D] border-[#2E3878] cursor-default'
                      : cell.kind === 'empty'
                      ? 'bg-[#080B26] border-[#222B5E] hover:border-[#22EBFF]/80 hover:bg-[#10184A] cursor-pointer'
                      : 'bg-[#121D54] border-[#22EBFF]/80 hover:border-[#22EBFF] shadow-[0_0_24px_oklch(0.87_0.16_196_/_0.26)] cursor-pointer'
                  } ${targetMatched ? 'ring-2 ring-[#2DF59A] shadow-[0_0_34px_oklch(0.86_0.19_158_/_0.65)]' : ''}`}
                >
                  {cell.kind !== 'empty' && (
                    <ModuleGlyph
                      kind={cell.kind}
                      rot={cell.rot}
                      color={cell.color}
                      andState={animStep >= 0 ? andState : undefined}
                    />
                  )}

                  {showGhost && <ModuleGlyph kind={selectedTool} rot={0} ghost />}

                  {!cell.locked && cell.kind !== 'empty' && selectedTool !== 'erase' && (
                    <span
                      className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-90 transition-opacity text-[#22EBFF] pointer-events-none"
                      aria-hidden="true"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </span>
                  )}

                  {segs.length > 0 && (
                    <svg
                      viewBox="0 0 100 100"
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      aria-hidden="true"
                    >
                      {segs.map((seg, idx) => {
                        const stroke = beamHex(seg.color);
                        const [fx, fy] =
                          seg.fromDir !== null ? portPoint(seg.fromDir) : [50, 50];
                        const [tx, ty] =
                          seg.toDir !== null ? portPoint(seg.toDir) : [50, 50];
                        return (
                          <g key={idx}>
                            <path
                              d={`M ${fx} ${fy} L 50 50 L ${tx} ${ty}`}
                              fill="none"
                              stroke={stroke}
                              strokeWidth="16"
                              strokeOpacity="0.32"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d={`M ${fx} ${fy} L 50 50 L ${tx} ${ty}`}
                              fill="none"
                              stroke={stroke}
                              strokeWidth="6.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d={`M ${fx} ${fy} L 50 50 L ${tx} ${ty}`}
                              fill="none"
                              stroke="#FFFFFF"
                              strokeWidth="2.2"
                              strokeOpacity="0.92"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Sharp Crystalline Circuit Dock */}
      <Toolbar.Root
        aria-label="System Circuit Dock"
        className="flex flex-wrap items-center justify-center gap-2.5 p-2 rounded-2xl cosmo-panel border border-[#22EBFF]/35"
      >
        <ToggleGroup.Root
          type="single"
          value={selectedTool}
          onValueChange={(val) => {
            if (!val) return;
            cosmicSound.playClick();
            setSelectedTool(val as ModuleKind | 'erase');
          }}
          aria-label="Module Palette"
          className="flex items-center gap-2"
        >
          {TOOL_ORDER.filter((t) => (spec.inventory[t] ?? 0) > 0).map((tool) => {
            const count = remainingInventory[tool] ?? 0;
            return (
              <ToggleGroup.Item
                key={tool}
                value={tool}
                aria-label={`Select ${tool} module (${count} left)`}
                className={`relative w-13 h-13 rounded-xl border p-2 flex items-center justify-center transition-all cursor-pointer cosmo-tile bg-[#080B26] border-indigo-300/30 hover:border-[#22EBFF]/75 data-[state=on]:bg-[#121D54] data-[state=on]:border-[#22EBFF] data-[state=on]:shadow-[0_0_24px_oklch(0.87_0.16_196_/_0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22EBFF] ${
                  count === 0 ? 'opacity-40' : ''
                }`}
              >
                <ModuleGlyph kind={tool} rot={0} />
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-md bg-[#0E1542] border border-[#22EBFF]/70 text-[11px] font-extrabold tabular-nums text-[#22EBFF] flex items-center justify-center">
                  {count}
                </span>
              </ToggleGroup.Item>
            );
          })}

          <ToggleGroup.Item
            value="erase"
            aria-label="Remove module tool"
            className="w-13 h-13 rounded-xl border flex items-center justify-center transition-all cursor-pointer cosmo-tile bg-[#080B26] border-indigo-300/30 text-indigo-200/80 hover:text-white data-[state=on]:bg-[#FF4EC6]/20 data-[state=on]:border-[#FF4EC6] data-[state=on]:text-[#FF4EC6] data-[state=on]:shadow-[0_0_20px_oklch(0.74_0.24_336_/_0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4EC6]"
          >
            <Eraser className="w-5 h-5" />
          </ToggleGroup.Item>
        </ToggleGroup.Root>

        <Separator.Root
          orientation="vertical"
          className="hidden sm:block w-px h-8 bg-indigo-300/25 mx-0.5"
        />

        <Toolbar.Button
          type="button"
          onClick={handleRun}
          aria-label={isRunning ? 'Stop simulation' : 'Run simulation'}
          className={`h-13 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
            isRunning
              ? 'bg-gradient-to-r from-[#FFD23F] to-[#FF8A3D] text-[#050819] shadow-[0_0_28px_oklch(0.89_0.17_84_/_0.48)]'
              : 'bg-gradient-to-r from-[#22EBFF] to-[#2DF59A] text-[#050819] shadow-[0_0_30px_oklch(0.87_0.16_196_/_0.5)]'
          }`}
        >
          {isRunning ? <Square className="w-5.5 h-5.5 fill-current" /> : <Play className="w-5.5 h-5.5 fill-current" />}
        </Toolbar.Button>
      </Toolbar.Root>
    </div>
  );
}
