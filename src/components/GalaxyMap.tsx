import { useEffect, useRef, useState } from 'react';
import { RadioGroup, Toggle } from 'radix-ui';
import { ArrowLeft, Award, Lock, Volume2, VolumeX } from 'lucide-react';
import {
  STAGE_DESCRIPTORS,
  TOTAL_STAGES,
  hasEarnedMedal,
  isStageUnlocked,
} from '../game/progression';
import { AgeGroup, AllProgress, StageNumber } from '../game/types';
import { CosmicMedalEmblem, PillarIcon } from './CosmicMedals';

const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

interface GalaxyMapProps {
  selectedAge: AgeGroup;
  progress: AllProgress;
  onSelectAge: (age: AgeGroup) => void;
  onSelectStage: (stage: StageNumber) => void;
  onBackTitle: () => void;
  onOpenVault: () => void;
  onToggleMute: () => void;
}

const NODE_POSITIONS: Array<{ x: number; y: number }> = [
  { x: 9, y: 66 },
  { x: 21, y: 31 },
  { x: 34, y: 69 },
  { x: 47, y: 29 },
  { x: 60, y: 67 },
  { x: 73, y: 31 },
  { x: 85, y: 65 },
  { x: 92, y: 29 },
];

export function GalaxyMap({
  selectedAge,
  progress,
  onSelectAge,
  onSelectStage,
  onBackTitle,
  onOpenVault,
  onToggleMute,
}: GalaxyMapProps) {
  const ageProgress = progress[selectedAge];
  const lastArrowAtRef = useRef(0);
  const [hoveredStage, setHoveredStage] = useState<StageNumber | null>(null);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="relative z-10 h-full w-full flex flex-col justify-between p-5 md:p-8">
      {/* Crisp Header Instruments */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackTitle}
          aria-label="Back to Title"
          className="w-11 h-11 rounded-xl cosmo-panel border border-[#22EBFF]/35 hover:border-[#22EBFF] text-[#22EBFF] flex items-center justify-center transition-all cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22EBFF]"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* Age 7 / Age 9 Crystalline Track Switcher */}
        <RadioGroup.Root
          orientation="horizontal"
          value={String(selectedAge)}
          onValueChange={(val) => {
            if (val === '7' || val === '9') {
              onSelectAge(Number(val) as AgeGroup);
            }
          }}
          onKeyDownCapture={(e) => {
            if (ARROW_KEYS.includes(e.key)) {
              lastArrowAtRef.current = Date.now();
            }
          }}
          aria-label="Age Track Selector"
          className="flex items-center gap-1 p-1 rounded-xl cosmo-panel border border-indigo-300/25"
        >
          {([7, 9] as const).map((age) => {
            const isAge9 = age === 9;
            return (
              <RadioGroup.Item
                key={age}
                value={String(age)}
                aria-label={`Select Age ${age}`}
                onFocus={() => {
                  if (Date.now() - lastArrowAtRef.current < 250 && selectedAge !== age) {
                    onSelectAge(age);
                  }
                }}
                className={`h-9 px-4.5 rounded-lg text-sm font-extrabold tabular-nums transition-all cursor-pointer flex items-center gap-2 text-indigo-200/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22EBFF] ${
                  isAge9
                    ? 'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#FFD23F] data-[state=checked]:to-[#FF8A3D] data-[state=checked]:text-[#050819] data-[state=checked]:shadow-[0_0_24px_oklch(0.89_0.17_84_/_0.5)]'
                    : 'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#22EBFF] data-[state=checked]:to-[#2DF59A] data-[state=checked]:text-[#050819] data-[state=checked]:shadow-[0_0_24px_oklch(0.87_0.16_196_/_0.5)]'
                }`}
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" aria-hidden="true">
                  <polygon
                    points="10,2 16,6.5 16,13.5 10,18 4,13.5 4,6.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  {isAge9 && <polygon points="10,6 13,10 10,14 7,10" fill="currentColor" />}
                </svg>
                <span>{age}</span>
              </RadioGroup.Item>
            );
          })}
        </RadioGroup.Root>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenVault}
            aria-label="Open Medal Vault"
            className="h-11 px-4 rounded-xl cosmo-panel border border-[#FFD23F]/45 hover:border-[#FFD23F] text-[#FFD23F] flex items-center gap-2.5 transition-all cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD23F]"
          >
            <Award className="w-4.5 h-4.5" />
            <span className="tabular-nums text-sm font-extrabold text-white">
              {ageProgress.earnedMedals.length}
              <span className="text-indigo-300/50 mx-0.5">/</span>
              <span className="text-indigo-200">{TOTAL_STAGES}</span>
            </span>
          </button>
          <Toggle.Root
            pressed={progress.muted}
            onPressedChange={() => onToggleMute()}
            aria-label={progress.muted ? 'Unmute audio' : 'Mute audio'}
            className="w-11 h-11 rounded-xl cosmo-panel border border-[#22EBFF]/35 hover:border-[#22EBFF] data-[state=on]:border-[#FF4EC6] data-[state=on]:text-[#FF4EC6] text-[#22EBFF] flex items-center justify-center transition-all cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22EBFF]"
          >
            {progress.muted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
          </Toggle.Root>
        </div>
      </div>

      {/* Sharp Crystalline Refraction Constellation Map */}
      <div className="relative flex-1 flex items-center justify-center my-2">
        {isDesktop ? (
          <div className="relative w-full max-w-6xl h-[470px]">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="auroraRainbow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22EBFF" />
                  <stop offset="30%" stopColor="#FFD23F" />
                  <stop offset="55%" stopColor="#B378FF" />
                  <stop offset="78%" stopColor="#FF4EC6" />
                  <stop offset="100%" stopColor="#2DF59A" />
                </linearGradient>
              </defs>

              <polygon
                points="50,6 84,18 96,50 84,82 50,94 16,82 4,50 16,18"
                fill="none"
                stroke="#4F5A9E"
                strokeOpacity="0.28"
                strokeWidth="0.22"
                strokeDasharray="1.2 1.8"
              />

              {NODE_POSITIONS.slice(0, -1).map((pos, idx) => {
                const next = NODE_POSITIONS[idx + 1];
                const stageNum = (idx + 2) as StageNumber;
                const unlocked = isStageUnlocked(progress, selectedAge, stageNum);
                const highlighted = hoveredStage !== null && stageNum <= hoveredStage && unlocked;
                const mx = (pos.x + next.x) / 2;
                const my = (pos.y + next.y) / 2 + (idx % 2 === 0 ? -11 : 11);
                const d = `M ${pos.x} ${pos.y} L ${mx} ${my} L ${next.x} ${next.y}`;

                return (
                  <g key={idx}>
                    {unlocked && (
                      <path
                        d={d}
                        fill="none"
                        stroke="url(#auroraRainbow)"
                        strokeOpacity={highlighted ? 0.45 : 0.22}
                        strokeWidth={highlighted ? '1.9' : '1.25'}
                        strokeLinejoin="miter"
                      />
                    )}
                    <path
                      d={d}
                      fill="none"
                      stroke={unlocked ? 'url(#auroraRainbow)' : '#353E75'}
                      strokeOpacity={highlighted ? 1 : unlocked ? 0.95 : 0.45}
                      strokeWidth={highlighted ? '0.68' : unlocked ? '0.45' : '0.32'}
                      strokeDasharray={unlocked ? undefined : '1 1.3'}
                      strokeLinejoin="miter"
                    />
                    {unlocked && (
                      <path
                        d={d}
                        fill="none"
                        stroke="#FFFFFF"
                        strokeOpacity={highlighted ? 0.85 : 0.45}
                        strokeWidth="0.16"
                        strokeLinejoin="miter"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {STAGE_DESCRIPTORS.map((desc, idx) => {
              const pos = NODE_POSITIONS[idx];
              const unlocked = isStageUnlocked(progress, selectedAge, desc.stage);
              const earned = hasEarnedMedal(progress, selectedAge, desc.stage);
              const isCurrent = unlocked && !earned && desc.stage === ageProgress.highestUnlocked;

              return (
                <div
                  key={desc.stage}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2.5"
                >
                  <div className="relative flex items-center justify-center">
                    {unlocked && (
                      <span
                        className="absolute -inset-6 rounded-full pointer-events-none"
                        style={{
                          background: `radial-gradient(circle, ${earned ? 'rgba(255,210,63,0.32)' : `${desc.accentHex}38`} 0%, transparent 68%)`,
                        }}
                        aria-hidden="true"
                      />
                    )}
                    {isCurrent && (
                      <span
                        className="absolute -inset-3 rounded-xl border-2 rotate-45 animate-beacon-ring pointer-events-none"
                        style={{ borderColor: desc.accentHex }}
                        aria-hidden="true"
                      />
                    )}
                    <button
                      type="button"
                      disabled={!unlocked}
                      onMouseEnter={() => unlocked && setHoveredStage(desc.stage)}
                      onMouseLeave={() => setHoveredStage(null)}
                      onFocus={() => unlocked && setHoveredStage(desc.stage)}
                      onBlur={() => setHoveredStage(null)}
                      onClick={() => onSelectStage(desc.stage)}
                      aria-label={`Stage ${desc.stage}${unlocked ? '' : ' Locked'}${earned ? ' Completed' : ''}`}
                      style={
                        unlocked
                          ? {
                              borderColor: earned ? '#FFD23F' : desc.accentHex,
                              boxShadow: isCurrent
                                ? `0 0 42px -2px ${desc.accentHex}99, 0 18px 36px -8px rgba(0,0,0,0.92), inset 0 1px 0 rgba(255,255,255,0.28)`
                                : `0 0 28px -4px ${desc.accentHex}66, 0 14px 28px -8px rgba(0,0,0,0.88), inset 0 1px 0 rgba(255,255,255,0.2)`,
                            }
                          : undefined
                      }
                      className={`relative w-21 h-21 rounded-xl flex items-center justify-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        !unlocked
                          ? 'bg-[#090D28]/92 border border-[#2C356E] text-indigo-300/45 cursor-not-allowed'
                          : earned
                          ? 'bg-[#12194A] border hover:scale-108 cursor-pointer'
                          : isCurrent
                          ? 'bg-[#15225E] border-2 hover:scale-108 cursor-pointer'
                          : 'bg-[#0F1744] border hover:scale-108 cursor-pointer'
                      }`}
                    >
                      {!unlocked && (
                        <span
                          className="absolute inset-2.5 border border-indigo-400/15 rotate-45 pointer-events-none"
                          aria-hidden="true"
                        />
                      )}
                      {!unlocked ? (
                        <Lock className="w-5 h-5 opacity-75" />
                      ) : earned ? (
                        <CosmicMedalEmblem
                          shape={desc.medalShape}
                          accentHex={desc.accentHex}
                          earned={true}
                          size={68}
                        />
                      ) : (
                        <PillarIcon
                          pillar={desc.pillar}
                          className="w-8.5 h-8.5"
                          color={desc.accentHex}
                        />
                      )}
                    </button>
                  </div>

                  <span
                    className={`tabular-nums text-xs font-extrabold tracking-tight px-2.5 py-0.5 rounded-md ${
                      earned
                        ? 'bg-[#211B45] text-[#FFD23F] border border-[#FFD23F]/60'
                        : unlocked
                        ? 'bg-[#0E1338] text-white border border-indigo-300/35'
                        : 'text-indigo-300/55'
                    }`}
                  >
                    {desc.stage}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-md">
            {STAGE_DESCRIPTORS.map((desc) => {
              const unlocked = isStageUnlocked(progress, selectedAge, desc.stage);
              const earned = hasEarnedMedal(progress, selectedAge, desc.stage);
              const isCurrent = unlocked && !earned && desc.stage === ageProgress.highestUnlocked;
              return (
                <button
                  key={desc.stage}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => onSelectStage(desc.stage)}
                  aria-label={`Stage ${desc.stage}${unlocked ? '' : ' Locked'}`}
                  style={
                    unlocked
                      ? { borderColor: earned ? '#FFD23F' : desc.accentHex }
                      : undefined
                  }
                  className={`h-24 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all cosmo-tile ${
                    !unlocked
                      ? 'bg-[#090D26]/92 border-[#252C5C] text-indigo-400/45 cursor-not-allowed'
                      : isCurrent
                      ? 'bg-[#141E54] cursor-pointer shadow-[0_0_28px_oklch(0.87_0.16_196_/_0.4)]'
                      : 'bg-[#0E143B] cursor-pointer'
                  }`}
                >
                  {!unlocked ? (
                    <Lock className="w-5 h-5" />
                  ) : earned ? (
                    <CosmicMedalEmblem
                      shape={desc.medalShape}
                      accentHex={desc.accentHex}
                      earned={true}
                      size={44}
                    />
                  ) : (
                    <PillarIcon pillar={desc.pillar} className="w-6 h-6" color={desc.accentHex} />
                  )}
                  <span className="tabular-nums text-xs font-extrabold text-white">{desc.stage}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Crystalline Pillar Key */}
      <div className="flex items-center justify-center gap-8 py-1" aria-hidden="true">
        <PillarIcon pillar="system" className="w-5.5 h-5.5" color="#22EBFF" />
        <PillarIcon pillar="inhibitory" className="w-5.5 h-5.5" color="#FFD23F" />
        <PillarIcon pillar="memory" className="w-5.5 h-5.5" color="#B378FF" />
        <PillarIcon pillar="spatial3d" className="w-5.5 h-5.5" color="#FF4EC6" />
        <PillarIcon pillar="sandbox" className="w-5.5 h-5.5" color="#2DF59A" />
      </div>
    </div>
  );
}
