import { Dialog, VisuallyHidden } from 'radix-ui';
import { X } from 'lucide-react';
import { STAGE_DESCRIPTORS } from '../game/progression';
import { AgeGroup, CognitivePillar, MedalShape, StageNumber } from '../game/types';

export function PillarIcon({
  pillar,
  className = 'w-5 h-5',
  color = 'currentColor',
}: {
  pillar: CognitivePillar;
  className?: string;
  color?: string;
}) {
  switch (pillar) {
    case 'system':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <polygon points="5,9 8,12 5,15 2,12" stroke={color} strokeWidth="2" fill={`${color}35`} />
          <polygon points="19,3 22,6 19,9 16,6" stroke={color} strokeWidth="2" fill={`${color}35`} />
          <polygon points="19,15 22,18 19,21 16,18" stroke={color} strokeWidth="2" fill={`${color}35`} />
          <path d="M8 12H12L16.5 7M12 12L16.5 17" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="miter" />
        </svg>
      );
    case 'inhibitory':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" stroke={color} strokeWidth="1.9" strokeDasharray="3.2 2.2" />
          <polygon points="12,8 15.5,12 12,16 8.5,12" fill={color} />
        </svg>
      );
    case 'memory':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M5 17L9 9L15 14L19 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="miter" />
          <polygon points="5,14.5 7.5,17 5,19.5 2.5,17" fill={color} />
          <polygon points="9,6.5 11.5,9 9,11.5 6.5,9" fill={color} />
          <polygon points="15,11.5 17.5,14 15,16.5 12.5,14" fill={color} />
          <polygon points="19,3.5 21.5,6 19,8.5 16.5,6" fill={color} />
        </svg>
      );
    case 'spatial3d':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke={color} strokeWidth="2" fill={`${color}26`} strokeLinejoin="miter" />
          <path d="M12 12L20 7.5M12 12L4 7.5M12 12V21" stroke={color} strokeWidth="1.8" strokeLinejoin="miter" />
        </svg>
      );
    case 'sandbox':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M4 17L10 8L19 14" stroke={color} strokeWidth="2" strokeDasharray="2.8 2.2" />
          <polygon points="5,14.5 7.5,17 5,19.5 2.5,17" fill={color} />
          <polygon points="19,10 22.5,14 19,18 15.5,14" stroke={color} strokeWidth="2" fill={`${color}32`} />
        </svg>
      );
  }
}

export function CosmicMedalEmblem({
  shape,
  accentHex,
  earned,
  size = 56,
}: {
  shape: MedalShape;
  accentHex: string;
  earned: boolean;
  size?: number;
}) {
  const stroke = earned ? accentHex : '#3B4480';
  const fill = earned ? `${accentHex}30` : 'rgba(10, 14, 42, 0.72)';
  const core = earned ? accentHex : '#283063';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style={earned ? { filter: `drop-shadow(0 0 12px ${accentHex}75)` } : undefined}
    >
      {/* Faceted Octagonal Cosmic Seal Frame */}
      <polygon
        points="32,4 52,12 60,32 52,52 32,60 12,52 4,32 12,12"
        fill="#0A0E2B"
        stroke={stroke}
        strokeWidth={earned ? 2 : 1.3}
        strokeDasharray={earned ? undefined : '4 3'}
      />
      <polygon
        points="32,10 47,16 54,32 47,48 32,54 17,48 10,32 17,16"
        fill={fill}
        stroke={stroke}
        strokeWidth="1"
        strokeOpacity={earned ? 0.65 : 0.3}
      />

      {shape === 'prism' && (
        <g>
          <polygon points="32,14 48,43 16,43" stroke={stroke} strokeWidth="2.2" fill={fill} strokeLinejoin="miter" />
          <polygon points="32,26 37,34 32,41 27,34" fill={core} stroke="#FFFFFF" strokeWidth="1" />
        </g>
      )}
      {shape === 'compass' && (
        <g>
          <polygon points="32,11 36.5,27.5 53,32 36.5,36.5 32,53 27.5,36.5 11,32 27.5,27.5" stroke={stroke} strokeWidth="2" fill={fill} strokeLinejoin="miter" />
          <polygon points="32,27 37,32 32,37 27,32" fill={core} />
        </g>
      )}
      {shape === 'crescent' && (
        <g>
          <polygon points="39,14 27,22 22,32 27,42 39,50 30,40 28,32 30,24" fill={core} stroke={stroke} strokeWidth="1.8" strokeLinejoin="miter" />
          <polygon points="43,20 46,24 43,28 40,24" fill={stroke} />
          <polygon points="46,33 48.5,36 46,39 43.5,36" fill={stroke} />
        </g>
      )}
      {shape === 'comet' && (
        <g>
          <path d="M16 46L30 30L45 19" stroke={stroke} strokeWidth="2.6" strokeLinecap="square" />
          <path d="M21 49L33 36L43 27" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.65" />
          <polygon points="45,12 51,19 45,26 39,19" fill={core} stroke="#FFFFFF" strokeWidth="1.3" />
        </g>
      )}
      {shape === 'astrolabe' && (
        <g>
          <polygon points="32,13 49,32 32,51 15,32" stroke={stroke} strokeWidth="1.9" fill={fill} />
          <polygon points="13,32 32,20 51,32 32,44" stroke={stroke} strokeWidth="1.9" />
          <polygon points="32,27 37,32 32,37 27,32" fill={core} />
        </g>
      )}
      {shape === 'nexus' && (
        <g>
          <polygon points="32,13 48,22 48,42 32,51 16,42 16,22" stroke={stroke} strokeWidth="2.2" fill={fill} strokeLinejoin="miter" />
          <polygon points="32,23 40,32 32,41 24,32" stroke="#FFFFFF" strokeWidth="1.4" fill={core} />
        </g>
      )}
      {shape === 'tesseract' && (
        <g>
          <rect x="17" y="17" width="30" height="30" stroke={stroke} strokeWidth="2" fill={fill} />
          <rect x="24" y="24" width="16" height="16" stroke={stroke} strokeWidth="1.8" fill={core} fillOpacity="0.7" />
          <path d="M17 17L24 24M47 17L40 24M17 47L24 40M47 47L40 40" stroke={stroke} strokeWidth="1.5" />
        </g>
      )}
      {shape === 'nova' && (
        <g>
          <polygon points="32,22 42,32 32,42 22,32" fill={core} stroke="#FFFFFF" strokeWidth="1.5" />
          <path d="M32 10V20M32 44V54M10 32H20M44 32H54M17 17L24 24M40 40L47 47M47 17L40 24M24 40L17 47" stroke={stroke} strokeWidth="2.2" />
        </g>
      )}
    </svg>
  );
}

export function MedalVaultModal({
  age,
  earnedMedals,
  onClose,
}: {
  age: AgeGroup;
  earnedMedals: StageNumber[];
  onClose: () => void;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#040614]/88" />
        <Dialog.Content
          aria-label={`Age ${age} Medal Vault`}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-xl rounded-2xl cosmo-panel border border-[#FFD23F]/50 p-6 focus:outline-none"
        >
          <VisuallyHidden.Root>
            <Dialog.Title>Age {age} Medal Vault</Dialog.Title>
            <Dialog.Description>
              Collected cosmic medals: {earnedMedals.length} of {STAGE_DESCRIPTORS.length}
            </Dialog.Description>
          </VisuallyHidden.Root>

          <div className="flex items-center justify-between mb-5 pb-4 border-b border-indigo-300/20">
            <div className="flex items-center gap-3.5">
              <span
                className={`inline-flex items-center justify-center w-11 h-11 rounded-xl border text-xl font-extrabold tabular-nums ${
                  age === 9
                    ? 'bg-[#FFD23F]/15 border-[#FFD23F] text-[#FFD23F]'
                    : 'bg-[#22EBFF]/15 border-[#22EBFF] text-[#22EBFF]'
                }`}
              >
                {age}
              </span>
              <div className="flex items-center gap-1.5 text-xl font-extrabold text-white tabular-nums">
                <span className="text-[#FFD23F]">{earnedMedals.length}</span>
                <span className="text-indigo-400/50">/</span>
                <span className="text-indigo-200">{STAGE_DESCRIPTORS.length}</span>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close Medal Vault"
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#0C1236] hover:bg-[#162059] border border-indigo-300/35 hover:border-[#22EBFF] text-white transition-colors cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22EBFF]"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {STAGE_DESCRIPTORS.map((desc) => {
              const earned = earnedMedals.includes(desc.stage);
              return (
                <div
                  key={desc.stage}
                  style={
                    earned
                      ? {
                          borderColor: `${desc.accentHex}99`,
                          boxShadow: `0 0 24px ${desc.accentHex}2A`,
                        }
                      : undefined
                  }
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-transform ${
                    earned
                      ? 'bg-[#101746]'
                      : 'bg-[#080C26] border-[#1F2758] opacity-55'
                  }`}
                >
                  <CosmicMedalEmblem
                    shape={desc.medalShape}
                    accentHex={desc.accentHex}
                    earned={earned}
                    size={62}
                  />
                  <span className="text-xs font-extrabold tabular-nums text-indigo-100">
                    {desc.stage}
                  </span>
                </div>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
