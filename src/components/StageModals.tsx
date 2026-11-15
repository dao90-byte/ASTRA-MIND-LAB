import { Dialog, VisuallyHidden } from 'radix-ui';
import { ArrowRight, Map, Play, RotateCcw } from 'lucide-react';
import { STAGE_DESCRIPTORS, TOTAL_STAGES } from '../game/progression';
import { AgeGroup, StageNumber } from '../game/types';
import { CosmicMedalEmblem } from './CosmicMedals';

export function PauseModal({
  onResume,
  onRestart,
  onMap,
}: {
  onResume: () => void;
  onRestart: () => void;
  onMap: () => void;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onResume();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#040614]/86" />
        <Dialog.Content
          aria-label="Paused"
          onEscapeKeyDown={(e) => e.stopPropagation()}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl cosmo-panel border border-[#22EBFF]/50 p-6 flex items-center gap-4 focus:outline-none"
        >
          <VisuallyHidden.Root>
            <Dialog.Title>Paused</Dialog.Title>
            <Dialog.Description>Resume, restart stage, or return to map</Dialog.Description>
          </VisuallyHidden.Root>

          <button
            type="button"
            onClick={onResume}
            aria-label="Resume"
            className="w-15 h-15 rounded-xl bg-gradient-to-br from-[#22EBFF] to-[#2DF59A] hover:brightness-110 text-[#050819] flex items-center justify-center shadow-[0_0_32px_oklch(0.87_0.16_196_/_0.52)] transition-transform cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Play className="w-7 h-7 fill-current translate-x-0.5" />
          </button>
          <button
            type="button"
            onClick={onRestart}
            aria-label="Restart Stage"
            className="w-15 h-15 rounded-xl bg-[#0C1236] hover:bg-[#162059] border border-[#FFD23F]/60 text-[#FFD23F] flex items-center justify-center transition-transform cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD23F]"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={onMap}
            aria-label="Back to Galaxy Map"
            className="w-15 h-15 rounded-xl bg-[#0C1236] hover:bg-[#162059] border border-[#B378FF]/60 text-[#B378FF] flex items-center justify-center transition-transform cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B378FF]"
          >
            <Map className="w-6 h-6" />
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function VictoryModal({
  age,
  stage,
  onNextStage,
  onReplay,
  onMap,
}: {
  age: AgeGroup;
  stage: StageNumber;
  onNextStage: () => void;
  onReplay: () => void;
  onMap: () => void;
}) {
  const desc = STAGE_DESCRIPTORS.find((d) => d.stage === stage) ?? STAGE_DESCRIPTORS[0];
  const hasNext = stage < TOTAL_STAGES;

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#040614]/88" />
        <Dialog.Content
          aria-label={`Stage ${stage} Complete`}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-sm rounded-2xl cosmo-panel border border-[#FFD23F]/60 p-7 flex flex-col items-center gap-6 overflow-hidden focus:outline-none"
        >
          <VisuallyHidden.Root>
            <Dialog.Title>Stage {stage} Complete</Dialog.Title>
            <Dialog.Description>Cosmic medal awarded for Age {age} Stage {stage}</Dialog.Description>
          </VisuallyHidden.Root>

          <div className="flex items-center gap-2.5 tabular-nums text-xl font-extrabold">
            <span className={age === 9 ? 'text-[#FFD23F]' : 'text-[#22EBFF]'}>{age}</span>
            <span className="text-indigo-400/50">/</span>
            <span className="text-white">{stage}</span>
          </div>

          <div className="relative flex items-center justify-center animate-medal-forge">
            <div
              className="absolute w-44 h-44 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, ${desc.accentHex}4D 0%, transparent 70%)`,
              }}
              aria-hidden="true"
            />
            <CosmicMedalEmblem
              shape={desc.medalShape}
              accentHex={desc.accentHex}
              earned={true}
              size={132}
            />
          </div>

          <div className="flex items-center gap-2" aria-hidden="true">
            {STAGE_DESCRIPTORS.map((d) => (
              <span
                key={d.stage}
                style={d.stage <= stage ? { backgroundColor: d.accentHex } : undefined}
                className={`h-2 transition-all rotate-45 ${
                  d.stage <= stage ? 'w-2.5' : 'w-1.5 bg-[#242C60]'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3.5 pt-1">
            <button
              type="button"
              onClick={onMap}
              aria-label="Back to Galaxy Map"
              className="w-13 h-13 rounded-xl bg-[#0C1236] hover:bg-[#162059] border border-[#B378FF]/60 text-[#B378FF] flex items-center justify-center transition-transform cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B378FF]"
            >
              <Map className="w-5.5 h-5.5" />
            </button>
            <button
              type="button"
              onClick={onReplay}
              aria-label="Replay Stage"
              className="w-13 h-13 rounded-xl bg-[#0C1236] hover:bg-[#162059] border border-[#FFD23F]/60 text-[#FFD23F] flex items-center justify-center transition-transform cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD23F]"
            >
              <RotateCcw className="w-5.5 h-5.5" />
            </button>
            {hasNext && (
              <button
                type="button"
                data-start="true"
                onClick={onNextStage}
                aria-label="Next Stage"
                className="w-15 h-15 rounded-xl bg-gradient-to-br from-[#22EBFF] to-[#2DF59A] hover:brightness-110 text-[#050819] flex items-center justify-center shadow-[0_0_32px_oklch(0.87_0.16_196_/_0.52)] transition-transform cursor-pointer cosmo-btn-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ArrowRight className="w-7 h-7 stroke-[2.8]" />
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
