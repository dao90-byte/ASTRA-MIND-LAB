import { Progress, Separator, Toolbar } from 'radix-ui';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Hourglass,
  Lock,
  LockOpen,
  RotateCcw,
  Undo2,
} from 'lucide-react';
import {
  InhibitoryStageNumber,
  createInitialInhibitoryState,
  getInhibitoryStage,
  getSentinelPos,
  isPhaseGateOpen,
  isTilePassableAtTurn,
  keyOf,
  stepInhibitory,
  undoInhibitory,
} from '../game/inhibitoryControl';
import { cosmicSound } from '../game/sound';
import { AgeGroup } from '../game/types';

export function InhibitoryBoard({
  age,
  stageNumber,
  resetSignal,
  onWin,
}: {
  age: AgeGroup;
  stageNumber: InhibitoryStageNumber;
  resetSignal: number;
  onWin: () => void;
}) {
  const spec = useMemo(() => getInhibitoryStage(age, stageNumber), [age, stageNumber]);
  const [state, setState] = useState(() => createInitialInhibitoryState(spec));
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    setState(createInitialInhibitoryState(spec));
    setSettling(false);
  }, [spec, resetSignal]);

  useEffect(() => {
    if (state.status === 'won') {
      cosmicSound.playVictory();
      const t = setTimeout(() => onWin(), 480);
      return () => clearTimeout(t);
    }
    if (state.status === 'failed') {
      cosmicSound.playSoftError();
    }
  }, [state.status, onWin]);

  const performAction = (action: 'up' | 'down' | 'left' | 'right' | 'wait') => {
    if (settling || state.status !== 'playing') return;
    const next = stepInhibitory(spec, state, action);
    if (next === state) return;
    setState(next);
    cosmicSound.playStep(next.turn);
    setSettling(true);
    setTimeout(() => setSettling(false), 260);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        performAction('up');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        performAction('down');
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        performAction('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        performAction('right');
      } else if (e.key === ' ' && spec.allowWait) {
        e.preventDefault();
        performAction('wait');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleTileClick = (r: number, c: number) => {
    const dr = r - state.player.r;
    const dc = c - state.player.c;
    if (dr === -1 && dc === 0) performAction('up');
    else if (dr === 1 && dc === 0) performAction('down');
    else if (dr === 0 && dc === -1) performAction('left');
    else if (dr === 0 && dc === 1) performAction('right');
  };

  const remainingMoves = Math.max(0, spec.maxMoves - state.turn);
  const budgetPct =
    spec.maxMoves > 0
      ? Math.min(100, Math.max(0, (remainingMoves / spec.maxMoves) * 100))
      : 0;

  return (
    <div className="h-full w-full flex flex-col items-center justify-between gap-3 py-2">
      {/* Move Budget Meter */}
      <div className="flex items-center gap-3.5 px-4 py-2 rounded-xl cosmo-panel border border-[#FFD23F]/45">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: spec.maxMoves }, (_, i) => {
            const left = i < remainingMoves;
            return (
              <span
                key={i}
                className={`h-2 rotate-45 transition-all ${
                  left ? 'w-2 bg-[#FFD23F] shadow-[0_0_8px_oklch(0.89_0.17_84_/_0.75)]' : 'w-1.5 bg-[#242C60]'
                }`}
              />
            );
          })}
        </div>
        <Progress.Root
          value={budgetPct}
          max={100}
          aria-label="Move Budget"
          className="relative hidden sm:block w-16 h-1.5 overflow-hidden rounded-sm bg-[#161C47]"
        >
          <Progress.Indicator
            className={`h-full w-full transition-transform duration-150 ${
              remainingMoves <= 2 ? 'bg-[#FF6B8B]' : 'bg-[#FFD23F]'
            }`}
            style={{ transform: `translateX(-${100 - budgetPct}%)` }}
          />
        </Progress.Root>
        <span className="tabular-nums text-sm font-extrabold text-[#FFD23F]">
          {remainingMoves}
        </span>
      </div>

      {/* Turn-Based Strategy Board */}
      <div className="flex-1 flex items-center justify-center w-full min-h-0">
        <div
          className="relative p-3 rounded-2xl cosmo-panel border border-[#FFD23F]/45"
          style={{
            width: spec.cols === 5 ? 'min(78vw, 440px)' : 'min(82vw, 476px)',
            aspectRatio: `${spec.cols} / ${spec.rows}`,
          }}
          data-testid="inhibitory-grid"
        >
          <svg
            viewBox={`0 0 ${spec.cols * 100} ${spec.rows * 100}`}
            className="absolute inset-3.5 w-[calc(100%-1.75rem)] h-[calc(100%-1.75rem)] pointer-events-none z-30"
            aria-hidden="true"
          >
            {spec.switches.map((sw, idx) =>
              sw.targets.map((tgt, tidx) => {
                const open = Boolean(state.gatesOpen[keyOf(tgt.r, tgt.c)]);
                return (
                  <line
                    key={`tether-${idx}-${tidx}`}
                    x1={sw.c * 100 + 50}
                    y1={sw.r * 100 + 50}
                    x2={tgt.c * 100 + 50}
                    y2={tgt.r * 100 + 50}
                    stroke={open ? '#2DF59A' : '#FFD23F'}
                    strokeOpacity="0.52"
                    strokeWidth="3"
                    strokeDasharray="7 7"
                  />
                );
              })
            )}
            {spec.warpLinks?.map((wl, idx) => (
              <line
                key={`warp-link-${idx}`}
                x1={wl.from.c * 100 + 50}
                y1={wl.from.r * 100 + 50}
                x2={wl.to.c * 100 + 50}
                y2={wl.to.r * 100 + 50}
                stroke="#B378FF"
                strokeOpacity="0.72"
                strokeWidth="3.2"
                strokeDasharray="6 5"
              />
            ))}
            {spec.sentinels.map((s) => {
              const pts = s.orbit.map((o) => `${o.c * 100 + 50},${o.r * 100 + 50}`).join(' ');
              return (
                <polyline
                  key={`orbit-${s.id}`}
                  points={pts}
                  fill="none"
                  stroke="#FF4EC6"
                  strokeOpacity="0.48"
                  strokeWidth="3"
                  strokeDasharray="5 5"
                />
              );
            })}
          </svg>

          <div
            className="relative z-20 grid gap-1.5 w-full h-full"
            style={{
              gridTemplateColumns: `repeat(${spec.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${spec.rows}, minmax(0, 1fr))`,
            }}
          >
            {spec.tiles.map((row, r) =>
              row.map((tile, c) => {
                const k = keyOf(r, c);
                const broken = Boolean(state.brokenTiles[k]);
                const isPlayer = state.player.r === r && state.player.c === c;
                const dr = r - state.player.r;
                const dc = c - state.player.c;
                const isAdjacent = Math.abs(dr) + Math.abs(dc) === 1;
                const passableNext = isTilePassableAtTurn(
                  spec,
                  state,
                  r,
                  c,
                  state.turn + 1
                );

                const sentinelHere = spec.sentinels.some((s) => {
                  const pos = getSentinelPos(s, state.turn);
                  return pos.r === r && pos.c === c;
                });

                const sentinelNext = spec.sentinels.some((s) => {
                  const pos = getSentinelPos(s, state.turn + 1);
                  return pos.r === r && pos.c === c;
                });

                const isWarpDest = Boolean(
                  spec.warpLinks?.some((wl) => wl.to.r === r && wl.to.c === c)
                );

                const gateOpen = tile === 'gate' ? Boolean(state.gatesOpen[k]) : false;
                const pg = spec.phaseGates.find((p) => p.r === r && p.c === c);
                const pgOpenNow = pg ? isPhaseGateOpen(pg, state.turn) : false;
                const pgOpenNext = pg ? isPhaseGateOpen(pg, state.turn + 1) : false;

                if (tile === 'void' || broken) {
                  return (
                    <div
                      key={k}
                      className="rounded-xl bg-[#040617] border border-[#141A3F] opacity-55"
                    />
                  );
                }

                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleTileClick(r, c)}
                    disabled={!isAdjacent || !passableNext || state.status !== 'playing'}
                    aria-label={`Board tile ${r + 1},${c + 1} ${tile}`}
                    className={`group relative rounded-xl border flex items-center justify-center transition-all duration-150 cosmo-tile ${
                      isPlayer && state.status === 'failed'
                        ? 'bg-[#42102E] border-[#FF6B8B] shadow-[0_0_26px_oklch(0.72_0.22_18_/_0.5)]'
                        : isPlayer
                        ? 'bg-[#0C2E4F] border-[#22EBFF] shadow-[0_0_26px_oklch(0.87_0.16_196_/_0.45)]'
                        : tile === 'goal'
                        ? 'bg-[#0D3030] border-[#2DF59A] shadow-[0_0_24px_oklch(0.86_0.19_158_/_0.38)]'
                        : tile === 'ice'
                        ? 'bg-[#0E2848] border-[#66F2FF]/70 hover:border-[#66F2FF]'
                        : isAdjacent && passableNext && state.status === 'playing'
                        ? 'bg-[#121C52] border-[#22EBFF]/70 hover:border-[#22EBFF] hover:bg-[#19286E] cursor-pointer'
                        : 'bg-[#0C1136] border-[#252D66]'
                    }`}
                  >
                    {sentinelNext && !sentinelHere && (
                      <div
                        className="absolute inset-2 rounded-lg border border-dashed border-[#FF4EC6]/75 pointer-events-none"
                        aria-hidden="true"
                      />
                    )}

                    {isWarpDest && !isPlayer && (
                      <div
                        className="absolute inset-2 rotate-45 border border-dashed border-[#B378FF]/70 pointer-events-none"
                        aria-hidden="true"
                      />
                    )}

                    {isAdjacent && passableNext && state.status === 'playing' && !isPlayer && tile === 'floor' && !sentinelHere && (
                      <span
                        className="text-[#22EBFF]/65 group-hover:text-white transition-colors pointer-events-none"
                        aria-hidden="true"
                      >
                        {dr === -1 ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : dr === 1 ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : dc === -1 ? (
                          <ChevronLeft className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </span>
                    )}

                    {tile === 'goal' && !isPlayer && (
                      <div className="w-7 h-7 rotate-45 border-2 border-[#2DF59A] flex items-center justify-center shadow-[0_0_16px_oklch(0.86_0.19_158_/_0.6)]">
                        <div className="w-3 h-3 bg-[#2DF59A]" />
                      </div>
                    )}

                    {tile === 'switch' && !isPlayer && (
                      <div className="w-6 h-6 rotate-45 bg-[#FFD23F]/28 border-2 border-[#FFD23F] shadow-[0_0_14px_oklch(0.89_0.17_84_/_0.5)]" />
                    )}

                    {tile === 'warp' && !isPlayer && (
                      <div className="relative w-7 h-7 rotate-45 border-2 border-[#B378FF] bg-[#B378FF]/25 flex items-center justify-center shadow-[0_0_18px_oklch(0.75_0.21_294_/_0.6)]">
                        <div className="w-2.5 h-2.5 bg-[#FFFFFF]" />
                      </div>
                    )}

                    {tile === 'ice' && !isPlayer && (
                      <svg viewBox="0 0 32 32" className="w-6 h-6 text-[#88FAFF]" fill="none" aria-hidden="true">
                        <polygon points="16,4 28,16 16,28 4,16" stroke="currentColor" strokeWidth="1.8" fill="rgba(136,250,255,0.18)" />
                        <line x1="10" y1="16" x2="22" y2="16" stroke="#FFFFFF" strokeWidth="1.6" />
                        <line x1="16" y1="10" x2="16" y2="22" stroke="#FFFFFF" strokeWidth="1.6" />
                      </svg>
                    )}

                    {tile === 'fragile' && !isPlayer && (
                      <div className="relative w-7 h-7 rounded-md border border-dashed border-[#22EBFF]/80 flex items-center justify-center">
                        <span className="w-4 h-px bg-[#22EBFF]/80 rotate-45" />
                      </div>
                    )}

                    {tile === 'gate' && !isPlayer && (
                      <div className={gateOpen ? 'text-[#2DF59A]' : 'text-[#FF4EC6]'}>
                        {gateOpen ? <LockOpen className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                      </div>
                    )}

                    {tile === 'phase_gate' && !isPlayer && (
                      <div
                        className={`relative w-7 h-7 rotate-45 border-2 flex items-center justify-center ${
                          pgOpenNow
                            ? 'border-[#2DF59A] bg-[#2DF59A]/25'
                            : 'border-[#FF4EC6] bg-[#FF4EC6]/25'
                        }`}
                      >
                        <span
                          className={`w-2.5 h-2.5 ${
                            pgOpenNow ? 'bg-[#2DF59A]' : 'bg-[#FF4EC6]'
                          }`}
                        />
                        <span
                          className={`absolute -top-1.5 -right-1.5 w-2.5 h-2.5 border border-[#050819] ${
                            pgOpenNext ? 'bg-[#2DF59A]' : 'bg-[#FF4EC6]'
                          }`}
                        />
                      </div>
                    )}

                    {sentinelHere && (
                      <div className="absolute inset-1.5 rotate-45 rounded-sm bg-[#FF4EC6]/28 border border-[#FF4EC6] flex items-center justify-center shadow-[0_0_18px_oklch(0.74_0.24_336_/_0.6)]">
                        <div className="w-2.5 h-2.5 bg-[#FF4EC6]" />
                      </div>
                    )}

                    {isPlayer && (
                      <div className="relative z-10 w-7 h-7 rotate-45 bg-gradient-to-br from-[#99FBFF] to-[#22EBFF] shadow-[0_0_24px_oklch(0.87_0.16_196_/_0.88)] flex items-center justify-center">
                        <div className="w-2.5 h-2.5 bg-[#050819]" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Deliberation Dock */}
      <Toolbar.Root
        aria-label="Deliberation Controls"
        className="flex items-center gap-2 p-2 rounded-2xl cosmo-panel border border-[#FFD23F]/40"
      >
        <Toolbar.Button
          type="button"
          onClick={() => {
            cosmicSound.playClick();
            setState((s) => undoInhibitory(s));
          }}
          disabled={state.history.length === 0}
          aria-label="Undo last move"
          className="w-11 h-11 rounded-xl bg-[#0C1236] border border-indigo-300/35 hover:border-[#B378FF] disabled:opacity-35 text-[#B378FF] flex items-center justify-center cursor-pointer cosmo-btn-3d transition-colors"
        >
          <Undo2 className="w-5 h-5" />
        </Toolbar.Button>

        <Separator.Root orientation="vertical" className="w-px h-7 bg-indigo-300/25" />

        <div className="flex items-center gap-1.5">
          <Toolbar.Button
            type="button"
            onClick={() => performAction('left')}
            disabled={state.status !== 'playing'}
            aria-label="Move Left"
            className="w-11 h-11 rounded-xl bg-[#0E184A] border border-[#22EBFF]/45 hover:border-[#22EBFF] text-[#22EBFF] flex items-center justify-center cursor-pointer disabled:opacity-40 cosmo-btn-3d transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Toolbar.Button>
          <Toolbar.Button
            type="button"
            onClick={() => performAction('up')}
            disabled={state.status !== 'playing'}
            aria-label="Move Up"
            className="w-11 h-11 rounded-xl bg-[#0E184A] border border-[#22EBFF]/45 hover:border-[#22EBFF] text-[#22EBFF] flex items-center justify-center cursor-pointer disabled:opacity-40 cosmo-btn-3d transition-colors"
          >
            <ArrowUp className="w-5 h-5" />
          </Toolbar.Button>
          <Toolbar.Button
            type="button"
            onClick={() => performAction('down')}
            disabled={state.status !== 'playing'}
            aria-label="Move Down"
            className="w-11 h-11 rounded-xl bg-[#0E184A] border border-[#22EBFF]/45 hover:border-[#22EBFF] text-[#22EBFF] flex items-center justify-center cursor-pointer disabled:opacity-40 cosmo-btn-3d transition-colors"
          >
            <ArrowDown className="w-5 h-5" />
          </Toolbar.Button>
          <Toolbar.Button
            type="button"
            onClick={() => performAction('right')}
            disabled={state.status !== 'playing'}
            aria-label="Move Right"
            className="w-11 h-11 rounded-xl bg-[#0E184A] border border-[#22EBFF]/45 hover:border-[#22EBFF] text-[#22EBFF] flex items-center justify-center cursor-pointer disabled:opacity-40 cosmo-btn-3d transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </Toolbar.Button>
        </div>

        {spec.allowWait && (
          <>
            <Separator.Root orientation="vertical" className="w-px h-7 bg-indigo-300/25" />
            <Toolbar.Button
              type="button"
              onClick={() => performAction('wait')}
              disabled={state.status !== 'playing'}
              aria-label="Wait one turn"
              className="h-11 px-4 rounded-xl bg-[#211A42] border border-[#FFD23F]/70 hover:bg-[#FFD23F]/20 text-[#FFD23F] flex items-center justify-center cursor-pointer disabled:opacity-40 cosmo-btn-3d transition-colors"
            >
              <Hourglass className="w-5 h-5" />
            </Toolbar.Button>
          </>
        )}

        {state.status === 'failed' && (
          <Toolbar.Button
            type="button"
            onClick={() => {
              cosmicSound.playClick();
              setState(createInitialInhibitoryState(spec));
            }}
            aria-label="Retry puzzle"
            className="h-11 px-4 rounded-xl bg-[#42102E] border border-[#FF6B8B] text-[#FF6B8B] flex items-center justify-center cursor-pointer cosmo-btn-3d transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
          </Toolbar.Button>
        )}
      </Toolbar.Root>
    </div>
  );
}
