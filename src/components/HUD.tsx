import React from 'react';
import { PORTRAIT_ZOE } from '../game/portrait-zoe.js';
import { PRINCESSES, NPC_ORDER } from '../game/quests.js';
import { PrincessId } from '../types';

interface HUDProps {
  stars: number;
  doneCount: number;
  totalLands: number;
  treasuresToday: number;
  treasuresTotal: number;
  activeNPC: PrincessId | null;
  questStep?: { current: number; total: number };
  interactPrompt: string | null;
  nextNPC?: PrincessId | null;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onInteract?: () => void;
  todayStarNPC?: PrincessId;
}

export const HUD: React.FC<HUDProps> = ({
  stars,
  doneCount,
  totalLands,
  treasuresToday,
  treasuresTotal,
  activeNPC,
  questStep,
  interactPrompt,
  nextNPC,
  muted,
  onToggleMute,
  onPause,
  onInteract,
}) => {
  const nextPrincess = nextNPC ? PRINCESSES[nextNPC] : null;

  return (
    <>
      {/* Top Bar HUD */}
      <header className="fixed top-0 left-0 right-0 z-20 flex flex-col items-center gap-1.5 p-2 sm:p-3 pointer-events-none">
        <div className="w-full flex items-center justify-between gap-2">
          {/* Left: Princess Zoe avatar & Stars */}
          <div className="flex items-center gap-2 pointer-events-auto bg-white/95 px-3 py-1.5 rounded-full border-2 border-[#ebd373] shadow-md shrink-0">
            <img
              src={PORTRAIT_ZOE}
              alt="Princess Zoe"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-[#ebd373]"
            />
            <div
              className="flex items-center gap-1 font-black text-amber-800 text-lg sm:text-xl tabular-nums"
              aria-label={`${stars} stars`}
            >
              <span>⭐</span>
              <span>{stars}</span>
            </div>
          </div>

          {/* Center: Kingdoms Progress & Labeled Gems Counter */}
          <div className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto min-w-0">
            {/* Kingdoms Progress Bar */}
            <div className="bg-white/95 px-3.5 py-1.5 rounded-full border-2 border-[#ebd373] shadow-md flex items-center gap-2 text-sm sm:text-base font-extrabold text-purple-950">
              {activeNPC && questStep ? (
                <span className="flex items-center gap-1.5">
                  <span>✨</span>
                  <span>{PRINCESSES[activeNPC]?.name}</span>
                  <span className="text-amber-800 tabular-nums">
                    · {questStep.current}/{questStep.total}
                  </span>
                </span>
              ) : (
                <div
                  className="flex items-center gap-1.5"
                  title={`${doneCount} of ${totalLands} kingdoms glowing`}
                >
                  <span className="text-sm font-black text-purple-950 hidden md:inline">
                    Kingdoms
                  </span>
                  <div className="flex items-center gap-0.5" aria-hidden="true">
                    {NPC_ORDER.map((id, i) => {
                      const filled = i < doneCount;
                      return (
                        <svg
                          key={id}
                          viewBox="0 0 20 20"
                          className="w-5 h-5 shrink-0"
                        >
                          <polygon
                            points="10,1.5 18.5,10 10,18.5 1.5,10"
                            fill={filled ? '#f59e0b' : '#f1f5f9'}
                            stroke={filled ? '#92400e' : '#64748b'}
                            strokeWidth="2"
                          />
                        </svg>
                      );
                    })}
                  </div>
                  <span className="text-sm sm:text-base font-black text-amber-900 tabular-nums ml-0.5">
                    {doneCount}/{totalLands}
                  </span>
                </div>
              )}
            </div>

            {/* Clearly Labeled Gems Counter */}
            <div
              className="hidden sm:flex items-center gap-1.5 bg-white/95 px-3.5 py-1.5 rounded-full border-2 border-[#ebd373] shadow-md text-sm sm:text-base font-extrabold text-teal-950 tabular-nums"
              title="Gems found across the kingdom today"
            >
              <span aria-hidden="true">💎</span>
              <span>Gems</span>
              <span className="font-black text-teal-800">
                {treasuresToday}/{treasuresTotal}
              </span>
            </div>
          </div>

          {/* Right: Sound & Pause Controls */}
          <div className="flex items-center gap-2 pointer-events-auto shrink-0">
            <button
              type="button"
              onClick={onToggleMute}
              className="min-w-[44px] min-h-[44px] sm:w-11 sm:h-11 rounded-full bg-white/95 border-2 border-[#ebd373] shadow-md flex items-center justify-center text-lg sm:text-xl hover:scale-105 active:scale-95 transition-transform"
              aria-label={muted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              type="button"
              onClick={onPause}
              className="min-w-[44px] min-h-[44px] sm:w-11 sm:h-11 rounded-full bg-white/95 border-2 border-[#ebd373] shadow-md flex items-center justify-center text-lg sm:text-xl hover:scale-105 active:scale-95 transition-transform font-black text-purple-900"
              aria-label="Pause Menu"
            >
              ⏸️
            </button>
          </div>
        </div>

        {/* Gentle Next-Destination Guidance Chip */}
        {!activeNPC && (
          <div className="pointer-events-none bg-white/95 px-4 py-1 rounded-full border-2 border-amber-300 shadow-sm text-sm sm:text-base font-extrabold text-purple-950 flex items-center gap-1.5">
            {nextPrincess ? (
              <>
                <span aria-hidden="true">🧭</span>
                <span>
                  Next: Visit <strong className="text-amber-900">{nextPrincess.name}</strong> at{' '}
                  {nextPrincess.landName}
                </span>
              </>
            ) : (
              <>
                <span aria-hidden="true">👑</span>
                <span>All {totalLands} kingdoms are glowing! Explore or replay any friend!</span>
              </>
            )}
          </div>
        )}
      </header>

      {/* Proximity Interaction Button (Bottom Center — Stationary, Large >= 56px Touch Target) */}
      {interactPrompt && (
        <div className="fixed bottom-20 sm:bottom-10 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={onInteract}
            className="min-w-[56px] min-h-[56px] bg-gradient-to-r from-amber-400 to-yellow-300 hover:brightness-105 text-amber-950 font-black px-6 py-3.5 rounded-full border-4 border-white shadow-xl ring-4 ring-amber-300/60 text-lg sm:text-xl flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
          >
            <span>{interactPrompt}</span>
          </button>
        </div>
      )}
    </>
  );
};
