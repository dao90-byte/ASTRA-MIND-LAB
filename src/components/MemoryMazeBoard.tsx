import { Progress, Toolbar } from 'radix-ui';
import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import {
  MazeCoord,
  MemoryStageNumber,
  getMemoryMazeStage,
  isAdjacentCoord,
  isSafeMazeCell,
  stepMemoryMaze,
} from '../game/memorySpatial';
import { cosmicSound } from '../game/sound';
import { AgeGroup } from '../game/types';

export function MemoryMazeBoard({
  age,
  stageNumber = 3,
  resetSignal,
  onWin,
}: {
  age: AgeGroup;
  stageNumber?: MemoryStageNumber;
  resetSignal: number;
  onWin: () => void;
}) {
  const spec = useMemo(() => getMemoryMazeStage(age, stageNumber), [age, stageNumber]);
  const [phase, setPhase] = useState<'observe' | 'recall' | 'won'>('observe');
  const [tracedPath, setTracedPath] = useState<MazeCoord[]>([spec.start]);
  const [errorCell, setErrorCell] = useState<MazeCoord | null>(null);
  const [progressPct, setProgressPct] = useState(100);

  useEffect(() => {
    setPhase('observe');
    setTracedPath([spec.start]);
    setErrorCell(null);
    setProgressPct(100);
  }, [spec, resetSignal]);

  useEffect(() => {
    if (phase !== 'observe') return;
    const startAt = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = Math.max(0, now - startAt);
      const pct = Math.min(100, Math.max(0, 100 - (elapsed / spec.observeMs) * 100));
      setProgressPct(pct);
      if (elapsed >= spec.observeMs) {
        setPhase('recall');
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, spec.observeMs]);

  const handleCellClick = (r: number, c: number) => {
    if (phase !== 'recall') return;
    const res = stepMemoryMaze(spec, tracedPath, { r, c });
    if (res.hitVoid) {
      cosmicSound.playSoftError();
      setErrorCell({ r, c });
      setTimeout(() => {
        setErrorCell(null);
        setTracedPath([spec.start]);
      }, 420);
      return;
    }
    if (!res.ok) return;

    setTracedPath(res.nextPath);
    cosmicSound.playStep(res.nextPath.length);
    if (res.won) {
      setPhase('won');
      cosmicSound.playVictory();
      setTimeout(() => onWin(), 500);
    }
  };

  const triggerPeek = () => {
    if (phase === 'won') return;
    cosmicSound.playClick();
    setTracedPath([spec.start]);
    setProgressPct(100);
    setPhase('observe');
  };

  const head = tracedPath[tracedPath.length - 1];
  const recallPct = Math.max(0, Math.min(100, (tracedPath.length / spec.safePath.length) * 100));

  const cometPos = useMemo(() => {
    if (phase !== 'observe' || spec.safePath.length < 2) return null;
    const t = Math.max(0, Math.min(1, (100 - progressPct) / 100));
    const exact = t * (spec.safePath.length - 1);
    const i0 = Math.min(spec.safePath.length - 2, Math.floor(exact));
    const frac = exact - i0;
    const a = spec.safePath[i0];
    const b = spec.safePath[i0 + 1];
    return {
      x: (a.c + (b.c - a.c) * frac) * 100 + 50,
      y: (a.r + (b.r - a.r) * frac) * 100 + 50,
    };
  }, [phase, progressPct, spec.safePath]);

  return (
    <div className="h-full w-full flex flex-col items-center justify-between gap-3 py-2">
      {/* Observation Ring + Progress */}
      <div className="flex items-center gap-4 px-4 py-2 rounded-xl cosmo-panel border border-[#B378FF]/45">
        <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 36 36" className="w-8 h-8 -rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#232A5C" strokeWidth="2.8" />
            {phase === 'observe' && (
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="#B378FF"
                strokeWidth="2.8"
                strokeDasharray={`${(progressPct / 100) * 88} 88`}
                strokeLinecap="square"
              />
            )}
          </svg>
          <span className="absolute text-[#B378FF]">
            {phase === 'observe' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-indigo-300/70" />}
          </span>
        </div>

        <Progress.Root
          value={phase === 'observe' ? progressPct : recallPct}
          max={100}
          aria-label="Maze Progress"
          className="relative w-24 h-2 overflow-hidden rounded-sm bg-[#161C47]"
        >
          <Progress.Indicator
            className={`h-full w-full transition-transform duration-150 ${
              phase === 'observe' ? 'bg-[#B378FF]' : phase === 'won' ? 'bg-[#2DF59A]' : 'bg-[#22EBFF]'
            }`}
            style={{
              transform: `translateX(-${100 - (phase === 'observe' ? progressPct : recallPct)}%)`,
            }}
          />
        </Progress.Root>

        <div className="flex items-center gap-1 tabular-nums text-sm font-extrabold text-[#B378FF] shrink-0">
          <span>{tracedPath.length}</span>
          <span className="text-indigo-400/50">/</span>
          <span className="text-indigo-200">{spec.safePath.length}</span>
        </div>
      </div>

      {/* Starlight Crystal Lattice Grid */}
      <div className="flex-1 flex items-center justify-center w-full min-h-0">
        <div
          className="relative p-3 rounded-2xl cosmo-panel border border-[#B378FF]/45"
          style={{
            width:
              spec.cols === 4
                ? 'min(76vw, 420px)'
                : spec.cols === 5
                ? 'min(80vw, 456px)'
                : 'min(84vw, 480px)',
            aspectRatio: `${spec.cols} / ${spec.rows}`,
          }}
          data-testid="memory-grid"
        >
          <svg
            viewBox={`0 0 ${spec.cols * 100} ${spec.rows * 100}`}
            className="absolute inset-3 w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)] pointer-events-none z-10"
            aria-hidden="true"
          >
            {phase === 'observe' && (
              <>
                <polyline
                  points={spec.safePath.map((p) => `${p.c * 100 + 50},${p.r * 100 + 50}`).join(' ')}
                  fill="none"
                  stroke="#FF4EC6"
                  strokeOpacity="0.28"
                  strokeWidth="16"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
                <polyline
                  points={spec.safePath.map((p) => `${p.c * 100 + 50},${p.r * 100 + 50}`).join(' ')}
                  fill="none"
                  stroke="#E5BDFF"
                  strokeOpacity="0.95"
                  strokeWidth="5.5"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
                {cometPos && (
                  <g transform={`translate(${cometPos.x} ${cometPos.y}) rotate(45)`}>
                    <rect x="-10" y="-10" width="20" height="20" fill="#FFD23F" fillOpacity="0.38" />
                    <rect x="-5.5" y="-5.5" width="11" height="11" fill="#FFFFFF" />
                  </g>
                )}
              </>
            )}
            {tracedPath.length > 1 && (
              <>
                <polyline
                  points={tracedPath.map((p) => `${p.c * 100 + 50},${p.r * 100 + 50}`).join(' ')}
                  fill="none"
                  stroke={phase === 'won' ? '#2DF59A' : '#22EBFF'}
                  strokeOpacity="0.32"
                  strokeWidth="14"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
                <polyline
                  points={tracedPath.map((p) => `${p.c * 100 + 50},${p.r * 100 + 50}`).join(' ')}
                  fill="none"
                  stroke={phase === 'won' ? '#2DF59A' : '#22EBFF'}
                  strokeWidth="5.5"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
              </>
            )}
          </svg>

          <div
            className="relative z-20 grid gap-2 w-full h-full"
            style={{
              gridTemplateColumns: `repeat(${spec.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${spec.rows}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: spec.rows }, (_, r) =>
              Array.from({ length: spec.cols }, (_, c) => {
                const isStart = spec.start.r === r && spec.start.c === c;
                const isGoal = spec.goal.r === r && spec.goal.c === c;
                const isSafe = isSafeMazeCell(spec, { r, c });
                const isDecoy = Boolean(
                  spec.decoyCells?.some((d) => d.r === r && d.c === c)
                );
                const isWaypoint = Boolean(
                  spec.waypoints?.some((w) => w.r === r && w.c === c)
                );
                const isTraced = tracedPath.some((p) => p.r === r && p.c === c);
                const isHead = head.r === r && head.c === c;
                const isError = errorCell?.r === r && errorCell?.c === c;
                const canClick =
                  phase === 'recall' && isAdjacentCoord(head, { r, c });

                const showGlow =
                  phase === 'observe' ? isSafe : isTraced || isStart || isGoal;

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onClick={() => handleCellClick(r, c)}
                    disabled={!canClick}
                    aria-label={`Star node ${r + 1},${c + 1}${isGoal ? ' Goal' : ''}`}
                    className={`relative rounded-xl border flex items-center justify-center transition-all duration-150 cosmo-tile ${
                      isError
                        ? 'bg-[#42102E] border-[#FF6B8B] shadow-[0_0_26px_oklch(0.72_0.22_18_/_0.5)]'
                        : isGoal
                        ? 'bg-[#0D3030] border-[#2DF59A] shadow-[0_0_24px_oklch(0.86_0.19_158_/_0.38)]'
                        : isTraced
                        ? 'bg-[#0C2E4F] border-[#22EBFF] shadow-[0_0_24px_oklch(0.87_0.16_196_/_0.4)]'
                        : phase === 'observe' && isSafe
                        ? 'bg-[#1D154D] border-[#B378FF] shadow-[0_0_22px_oklch(0.75_0.21_294_/_0.38)]'
                        : phase === 'observe' && isDecoy
                        ? 'bg-[#2B1730] border-[#FFD23F]/65'
                        : canClick
                        ? 'bg-[#121C52] border-[#22EBFF]/55 hover:border-[#22EBFF] hover:bg-[#19286E] cursor-pointer'
                        : 'bg-[#090D2B] border-[#222B5E]'
                    }`}
                  >
                    {isWaypoint && (phase === 'observe' || isTraced) && (
                      <span
                        className="absolute w-6 h-6 rotate-45 border border-[#FFD23F]/80 pointer-events-none"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`rotate-45 transition-all ${
                        isHead
                          ? 'w-4.5 h-4.5 bg-[#22EBFF] shadow-[0_0_18px_oklch(0.87_0.16_196_/_0.9)]'
                          : isGoal
                          ? 'w-4 h-4 border-2 border-[#2DF59A] bg-[#2DF59A]/45'
                          : showGlow
                          ? 'w-3 h-3 bg-[#E5BDFF] shadow-[0_0_12px_oklch(0.75_0.21_294_/_0.8)]'
                          : phase === 'observe' && isDecoy
                          ? 'w-2.5 h-2.5 border border-[#FFD23F] bg-[#FFD23F]/35'
                          : canClick
                          ? 'w-2.5 h-2.5 bg-[#22EBFF]/60'
                          : 'w-2 h-2 bg-[#3A437D]'
                      }`}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <Toolbar.Root
        aria-label="Maze Controls"
        className="flex items-center gap-2.5 p-2 rounded-2xl cosmo-panel border border-[#B378FF]/40"
      >
        {phase === 'observe' ? (
          <Toolbar.Button
            type="button"
            onClick={() => {
              cosmicSound.playClick();
              setPhase('recall');
            }}
            aria-label="Start recall now"
            className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#B378FF] to-[#FF4EC6] hover:brightness-110 text-[#050819] font-bold flex items-center justify-center cursor-pointer shadow-[0_0_28px_oklch(0.75_0.21_294_/_0.5)] cosmo-btn-3d transition-colors"
          >
            <EyeOff className="w-5 h-5" />
          </Toolbar.Button>
        ) : (
          <>
            <Toolbar.Button
              type="button"
              onClick={triggerPeek}
              disabled={phase === 'won'}
              aria-label="Peek constellation again"
              className="h-11 px-5 rounded-xl bg-[#0C1236] border border-[#B378FF]/70 hover:bg-[#B378FF]/20 text-[#B378FF] flex items-center justify-center cursor-pointer disabled:opacity-40 cosmo-btn-3d transition-colors"
            >
              <Eye className="w-5 h-5" />
            </Toolbar.Button>
            <Toolbar.Button
              type="button"
              onClick={() => {
                cosmicSound.playClick();
                setTracedPath([spec.start]);
              }}
              disabled={phase === 'won' || tracedPath.length <= 1}
              aria-label="Clear path"
              className="w-11 h-11 rounded-xl bg-[#0C1236] border border-indigo-300/35 hover:border-[#22EBFF] text-indigo-100 flex items-center justify-center cursor-pointer disabled:opacity-35 cosmo-btn-3d transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </Toolbar.Button>
          </>
        )}
      </Toolbar.Root>
    </div>
  );
}
