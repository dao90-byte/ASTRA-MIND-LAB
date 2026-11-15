import { useRef } from 'react';
import { RadioGroup, Toggle } from 'radix-ui';
import { Award, Play, Volume2, VolumeX } from 'lucide-react';
import { TOTAL_STAGES } from '../game/progression';
import { AgeGroup, AllProgress } from '../game/types';

const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

interface TitleScreenProps {
  selectedAge: AgeGroup;
  progress: AllProgress;
  onSelectAge: (age: AgeGroup) => void;
  onStart: () => void;
  onToggleMute: () => void;
  onOpenVault: () => void;
}

export function TitleScreen({
  selectedAge,
  progress,
  onSelectAge,
  onStart,
  onToggleMute,
  onOpenVault,
}: TitleScreenProps) {
  const lastArrowAtRef = useRef(0);

  return (
    <div className="relative z-10 h-full w-full flex flex-col items-center justify-between p-5 md:p-8 pointer-events-none">
      {/* Top-right precision cosmic instruments */}
      <div className="w-full flex items-center justify-end gap-2.5 pointer-events-auto">
        <button
          type="button"
          onClick={onOpenVault}
          aria-label="Open Medal Vault"
          className="h-11 px-4 rounded-xl cosmo-panel border border-[#FFD23F]/45 hover:border-[#FFD23F] text-[#FFD23F] flex items-center gap-2.5 transition-all cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD23F]"
        >
          <Award className="w-4.5 h-4.5" />
          <span className="tabular-nums text-sm font-extrabold text-white">
            {progress[selectedAge].earnedMedals.length}
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

      {/* Unobstructed 3D Crystalline Monolith Viewport */}
      <div className="flex-1 w-full" aria-hidden="true" />

      {/* Lower-Third Sharp Prismatic Age Cards & Faceted Crystal Launch Core */}
      <div className="flex flex-col items-center justify-end gap-5 max-w-xl w-full pb-2 pointer-events-auto">
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
          className="grid grid-cols-2 gap-4 w-full"
        >
          {([7, 9] as const).map((age) => {
            const active = selectedAge === age;
            const ageData = progress[age];
            const isAge9 = age === 9;
            const accentStroke = isAge9 ? '#FFD23F' : '#22EBFF';
            const secondaryStroke = isAge9 ? '#FF4EC6' : '#2DF59A';

            return (
              <RadioGroup.Item
                key={age}
                value={String(age)}
                aria-label={`Age ${age} Track`}
                onFocus={() => {
                  if (Date.now() - lastArrowAtRef.current < 250 && selectedAge !== age) {
                    onSelectAge(age);
                  }
                }}
                className={`group relative overflow-hidden flex items-center justify-between gap-3 py-3.5 px-4.5 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 ${
                  isAge9
                    ? 'focus-visible:ring-[#FFD23F] cosmo-panel border-indigo-300/20 hover:border-[#FFD23F]/65 data-[state=checked]:border-[#FFD23F] data-[state=checked]:shadow-[0_0_40px_-4px_oklch(0.89_0.17_84_/_0.38),0_20px_48px_-12px_rgba(0,0,0,0.9)]'
                    : 'focus-visible:ring-[#22EBFF] cosmo-panel border-indigo-300/20 hover:border-[#22EBFF]/65 data-[state=checked]:border-[#22EBFF] data-[state=checked]:shadow-[0_0_40px_-4px_oklch(0.87_0.16_196_/_0.4),0_20px_48px_-12px_rgba(0,0,0,0.9)]'
                }`}
              >
                {/* Crystalline Octagonal Gauge with Numeral */}
                <div className="relative flex items-center justify-center w-16 h-16 shrink-0">
                  <svg viewBox="0 0 72 72" className="absolute inset-0 w-full h-full" aria-hidden="true">
                    {Array.from({ length: TOTAL_STAGES }, (_, i) => {
                      const st = i + 1;
                      const earned = ageData.earnedMedals.includes(st as never);
                      const unlocked = st <= ageData.highestUnlocked;
                      const startAngle = -90 + i * 45 + 6;
                      const endAngle = startAngle + 33;
                      const rad1 = (startAngle * Math.PI) / 180;
                      const rad2 = (endAngle * Math.PI) / 180;
                      const r = 32;
                      const x1 = 36 + r * Math.cos(rad1);
                      const y1 = 36 + r * Math.sin(rad1);
                      const x2 = 36 + r * Math.cos(rad2);
                      const y2 = 36 + r * Math.sin(rad2);
                      return (
                        <line
                          key={st}
                          x1={x1.toFixed(1)}
                          y1={y1.toFixed(1)}
                          x2={x2.toFixed(1)}
                          y2={y2.toFixed(1)}
                          stroke={earned ? '#FFD23F' : unlocked ? accentStroke : '#2C346B'}
                          strokeWidth={earned || active ? '2.6' : '1.8'}
                          strokeLinecap="round"
                          strokeOpacity={earned ? 1 : unlocked ? 0.92 : 0.7}
                        />
                      );
                    })}

                    {/* Sharp Octagonal Crystal Socket */}
                    <polygon
                      points="36,13 52,20 59,36 52,52 36,59 20,52 13,36 20,20"
                      fill={active ? `${accentStroke}1A` : 'rgba(10, 14, 42, 0.78)'}
                      stroke={active ? accentStroke : '#4A5496'}
                      strokeWidth="1.6"
                      strokeLinejoin="miter"
                    />

                    {isAge9 && (
                      <polygon
                        points="36,17 48,24 53,36 48,48 36,55 24,48 19,36 24,24"
                        fill="none"
                        stroke={active ? '#FF4EC6' : '#58629E'}
                        strokeWidth="1"
                        strokeOpacity={active ? 0.85 : 0.45}
                      />
                    )}
                  </svg>
                  <span
                    className={`relative text-2xl font-extrabold tabular-nums tracking-tight ${
                      active ? 'text-white' : 'text-indigo-200/70'
                    }`}
                  >
                    {age}
                  </span>
                </div>

                {/* Right Faceted Crystal Lattice Glyph + Medal Ratio */}
                <div className="flex flex-col items-end gap-2" aria-hidden="true">
                  <svg viewBox="0 0 68 28" className="w-17 h-7" fill="none">
                    <path
                      d={
                        isAge9
                          ? 'M 6 20 L 20 8 L 34 19 L 48 6 L 62 15'
                          : 'M 8 19 L 25 9 L 42 18 L 60 9'
                      }
                      stroke={active ? accentStroke : '#555F9E'}
                      strokeWidth="1.8"
                      strokeLinejoin="miter"
                    />
                    {(isAge9
                      ? [
                          [6, 20],
                          [20, 8],
                          [34, 19],
                          [48, 6],
                          [62, 15],
                        ]
                      : [
                          [8, 19],
                          [25, 9],
                          [42, 18],
                          [60, 9],
                        ]
                    ).map(([cx, cy], idx) => (
                      <polygon
                        key={cx}
                        points={`${cx},${cy - 3.6} ${cx + 3.2},${cy} ${cx},${cy + 3.6} ${cx - 3.2},${cy}`}
                        fill={
                          active
                            ? idx % 2 === 0
                              ? accentStroke
                              : secondaryStroke
                            : '#6974B3'
                        }
                      />
                    ))}
                  </svg>
                  <div className="flex items-center gap-1.5">
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
                      <polygon
                        points="8,1 13.5,8 8,15 2.5,8"
                        fill={active ? `${secondaryStroke}38` : 'transparent'}
                        stroke={active ? secondaryStroke : '#6974B3'}
                        strokeWidth="1.5"
                      />
                    </svg>
                    <span className="tabular-nums text-xs font-extrabold text-indigo-100">
                      {ageData.earnedMedals.length}/{TOTAL_STAGES}
                    </span>
                  </div>
                </div>
              </RadioGroup.Item>
            );
          })}
        </RadioGroup.Root>

        {/* Precision Faceted Crystal Launch Reticle */}
        <div className="relative flex items-center justify-center">
          <svg
            viewBox="0 0 120 120"
            className="w-28 h-28 pointer-events-none animate-slow-spin"
            aria-hidden="true"
          >
            <polygon
              points="60,6 98,22 114,60 98,98 60,114 22,98 6,60 22,22"
              fill="none"
              stroke={selectedAge === 9 ? '#FFD23F' : '#22EBFF'}
              strokeWidth="1.4"
              strokeOpacity="0.65"
              strokeDasharray="10 6"
            />
            <polygon
              points="60,2 64,8 60,14 56,8"
              fill={selectedAge === 9 ? '#FF4EC6' : '#2DF59A'}
            />
            <polygon points="60,106 63.5,112 60,118 56.5,112" fill="#B378FF" />
          </svg>

          <button
            type="button"
            data-start="true"
            onClick={onStart}
            aria-label="Start"
            className={`absolute w-18 h-18 rounded-full text-[#050819] flex items-center justify-center transition-all cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-4 ${
              selectedAge === 9
                ? 'bg-gradient-to-br from-[#FFF099] via-[#FFD23F] to-[#FF7B3D] hover:brightness-110 shadow-[0_0_52px_oklch(0.89_0.17_84_/_0.65)] ring-1 ring-[#FFE885] focus-visible:ring-[#FFD23F]'
                : 'bg-gradient-to-br from-[#88FAFF] via-[#22EBFF] to-[#2DF59A] hover:brightness-110 shadow-[0_0_52px_oklch(0.87_0.16_196_/_0.65)] ring-1 ring-[#99FBFF] focus-visible:ring-[#22EBFF]'
            }`}
          >
            <Play className="w-8 h-8 fill-current translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
