import { Separator, Toggle } from 'radix-ui';
import { useCallback, useEffect, useState } from 'react';
import { Map, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { GalaxyMap } from './components/GalaxyMap';
import { MedalVaultModal, PillarIcon } from './components/CosmicMedals';
import { InhibitoryBoard } from './components/InhibitoryBoard';
import { MemoryMazeBoard } from './components/MemoryMazeBoard';
import { SandboxBoard } from './components/SandboxBoard';
import { Spatial3DBoard } from './components/Spatial3DBoard';
import { PauseModal, VictoryModal } from './components/StageModals';
import { SystemBoard } from './components/SystemBoard';
import { ThreeBackdrop } from './components/ThreeBackdrop';
import { TitleScreen } from './components/TitleScreen';
import {
  STAGE_DESCRIPTORS,
  TOTAL_STAGES,
  completeStageInProgress,
  loadProgress,
  saveProgress,
} from './game/progression';
import { cosmicSound } from './game/sound';
import { AgeGroup, AllProgress, GameScreenState, StageNumber } from './game/types';

function shouldAutostart(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

export default function App() {
  const [progress, setProgress] = useState<AllProgress>(() => {
    const loaded = loadProgress();
    cosmicSound.setMuted(loaded.muted);
    return loaded;
  });
  const [selectedAge, setSelectedAge] = useState<AgeGroup>(7);
  const [activeStage, setActiveStage] = useState<StageNumber>(1);
  const [screen, setScreen] = useState<GameScreenState>(() =>
    shouldAutostart() ? 'playing' : 'title'
  );
  const [vaultOpen, setVaultOpen] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  useEffect(() => {
    const stateAttr =
      screen === 'title'
        ? 'title'
        : screen === 'paused'
        ? 'paused'
        : screen === 'victory'
        ? 'gameover'
        : 'playing';
    document.body.dataset.state = stateAttr;
  }, [screen]);

  const toggleMute = useCallback(() => {
    setProgress((prev) => {
      const next = { ...prev, muted: !prev.muted };
      cosmicSound.setMuted(next.muted);
      saveProgress(next);
      return next;
    });
  }, []);

  const handleStartFromTitle = useCallback(() => {
    cosmicSound.playClick();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setScreen('map');
  }, []);

  const handleSelectStage = useCallback((stage: StageNumber) => {
    cosmicSound.playClick();
    setActiveStage(stage);
    setResetSignal((n) => n + 1);
    setScreen('playing');
  }, []);

  const handleStageWin = useCallback(() => {
    setProgress((prev) => {
      const updated = completeStageInProgress(prev, selectedAge, activeStage);
      saveProgress(updated);
      return updated;
    });
    setScreen('victory');
  }, [selectedAge, activeStage]);

  const handleNextStage = useCallback(() => {
    cosmicSound.playClick();
    if (activeStage < TOTAL_STAGES) {
      const next = (activeStage + 1) as StageNumber;
      setActiveStage(next);
      setResetSignal((n) => n + 1);
      setScreen('playing');
    } else {
      setScreen('map');
    }
  }, [activeStage]);

  const handleRestartStage = useCallback(() => {
    cosmicSound.playClick();
    setResetSignal((n) => n + 1);
    setScreen('playing');
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || vaultOpen) return;

      if (screen === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        const activeTag = document.activeElement?.getAttribute('role');
        if (activeTag === 'radio') return;
        e.preventDefault();
        handleStartFromTitle();
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        toggleMute();
        return;
      }

      if (screen === 'playing') {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          setScreen('paused');
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          handleRestartStage();
        }
      } else if (screen === 'paused') {
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          setScreen('playing');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, vaultOpen, handleStartFromTitle, handleRestartStage, toggleMute]);

  const stageDesc =
    STAGE_DESCRIPTORS.find((d) => d.stage === activeStage) ?? STAGE_DESCRIPTORS[0];

  return (
    <main className="relative h-screen w-screen overflow-hidden cosmo-main-depth text-slate-100">
      <ThreeBackdrop showHero={screen === 'title'} selectedAge={selectedAge} />

      {screen === 'title' && (
        <TitleScreen
          selectedAge={selectedAge}
          progress={progress}
          onSelectAge={(age) => {
            if (age !== selectedAge) {
              cosmicSound.playClick();
              setSelectedAge(age);
            }
          }}
          onStart={handleStartFromTitle}
          onToggleMute={toggleMute}
          onOpenVault={() => {
            cosmicSound.playClick();
            setVaultOpen(true);
          }}
        />
      )}

      {screen === 'map' && (
        <GalaxyMap
          selectedAge={selectedAge}
          progress={progress}
          onSelectAge={(age) => {
            if (age !== selectedAge) {
              cosmicSound.playClick();
              setSelectedAge(age);
            }
          }}
          onSelectStage={handleSelectStage}
          onBackTitle={() => {
            cosmicSound.playClick();
            setScreen('title');
          }}
          onOpenVault={() => {
            cosmicSound.playClick();
            setVaultOpen(true);
          }}
          onToggleMute={toggleMute}
        />
      )}

      {(screen === 'playing' || screen === 'paused' || screen === 'victory') && (
        <div className="relative z-10 h-full w-full flex flex-col p-3 md:p-5">
          {/* Crisp Crystalline HUD */}
          <div className="flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  cosmicSound.playClick();
                  setScreen('map');
                }}
                aria-label="Back to Galaxy Map"
                className="w-11 h-11 rounded-xl cosmo-panel border border-[#22EBFF]/35 hover:border-[#22EBFF] text-[#22EBFF] flex items-center justify-center transition-all cursor-pointer cosmo-btn-3d"
              >
                <Map className="w-5 h-5" />
              </button>

              <div className="h-11 px-3.5 rounded-xl cosmo-panel border border-indigo-300/25 flex items-center gap-2.5 select-none" aria-hidden="true">
                <span className={`tabular-nums text-base font-extrabold ${selectedAge === 9 ? 'text-[#FFD23F]' : 'text-[#22EBFF]'}`}>
                  {selectedAge}
                </span>
                <Separator.Root
                  orientation="vertical"
                  className="w-px h-4 bg-indigo-300/30"
                />
                <span className="tabular-nums text-base font-extrabold text-white">
                  {activeStage}
                </span>
                <PillarIcon
                  pillar={stageDesc.pillar}
                  className="w-5 h-5 ml-0.5"
                  color={stageDesc.accentHex}
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleRestartStage();
                }}
                aria-label="Reset stage"
                className="w-11 h-11 rounded-xl cosmo-panel border border-[#FFD23F]/35 hover:border-[#FFD23F] text-[#FFD23F] flex items-center justify-center transition-all cursor-pointer cosmo-btn-3d"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <Toggle.Root
                tabIndex={-1}
                pressed={progress.muted}
                onPressedChange={() => toggleMute()}
                aria-label={progress.muted ? 'Unmute audio' : 'Mute audio'}
                className="w-11 h-11 rounded-xl cosmo-panel border border-[#22EBFF]/35 hover:border-[#22EBFF] data-[state=on]:border-[#FF4EC6] data-[state=on]:text-[#FF4EC6] text-[#22EBFF] flex items-center justify-center transition-all cursor-pointer cosmo-btn-3d"
              >
                {progress.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Toggle.Root>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  cosmicSound.playClick();
                  setScreen('paused');
                }}
                aria-label="Pause"
                className="w-11 h-11 rounded-xl cosmo-panel border border-[#B378FF]/35 hover:border-[#B378FF] text-[#B378FF] flex items-center justify-center transition-all cursor-pointer cosmo-btn-3d"
              >
                <Pause className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Active Stage Board */}
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            {(activeStage === 1 || activeStage === 5 || activeStage === 9 || activeStage === 14) && (
              <SystemBoard
                age={selectedAge}
                stageNumber={activeStage}
                resetSignal={resetSignal}
                onWin={handleStageWin}
              />
            )}
            {(activeStage === 2 || activeStage === 6 || activeStage === 10 || activeStage === 15) && (
              <InhibitoryBoard
                age={selectedAge}
                stageNumber={activeStage}
                resetSignal={resetSignal}
                onWin={handleStageWin}
              />
            )}
            {(activeStage === 3 || activeStage === 11 || activeStage === 16) && (
              <MemoryMazeBoard
                age={selectedAge}
                stageNumber={activeStage}
                resetSignal={resetSignal}
                onWin={handleStageWin}
              />
            )}
            {(activeStage === 7 || activeStage === 12 || activeStage === 17) && (
              <Spatial3DBoard
                age={selectedAge}
                stageNumber={activeStage}
                resetSignal={resetSignal}
                onWin={handleStageWin}
              />
            )}
            {(activeStage === 4 || activeStage === 8 || activeStage === 13 || activeStage === 18) && (
              <SandboxBoard
                age={selectedAge}
                stageNumber={activeStage}
                resetSignal={resetSignal}
                onWin={handleStageWin}
              />
            )}
          </div>
        </div>
      )}

      {screen === 'paused' && (
        <PauseModal
          onResume={() => {
            cosmicSound.playClick();
            setScreen('playing');
          }}
          onRestart={handleRestartStage}
          onMap={() => {
            cosmicSound.playClick();
            setScreen('map');
          }}
        />
      )}

      {screen === 'victory' && (
        <VictoryModal
          age={selectedAge}
          stage={activeStage}
          onNextStage={handleNextStage}
          onReplay={handleRestartStage}
          onMap={() => {
            cosmicSound.playClick();
            setScreen('map');
          }}
        />
      )}

      {vaultOpen && (
        <MedalVaultModal
          age={selectedAge}
          earnedMedals={progress[selectedAge].earnedMedals}
          onClose={() => {
            cosmicSound.playClick();
            setVaultOpen(false);
          }}
        />
      )}
    </main>
  );
}
