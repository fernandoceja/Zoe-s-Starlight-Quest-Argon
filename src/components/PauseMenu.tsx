import React, { useState } from 'react';
import { Narrator, SoundFX } from '../game/audio.js';

interface PauseMenuProps {
  onResume: () => void;
  onOpenWardrobe: () => void;
  onOpenTreasureBook: () => void;
  onOpenTutorial: () => void;
  onOpenParentCorner: () => void;
}

type PauseBtnId = 'resume' | 'wardrobe' | 'treasurebook' | 'tutorial' | 'parent';

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onOpenWardrobe,
  onOpenTreasureBook,
  onOpenTutorial,
  onOpenParentCorner,
}) => {
  const [selectedId, setSelectedId] = useState<PauseBtnId | null>(null);

  const handleSelect = (id: PauseBtnId, action: () => void) => {
    setSelectedId(id);
    Narrator.stop();
    SoundFX.pop();
    // Open immediately on next animation frame so the selected state visibly flashes with zero stall
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => action());
    } else {
      action();
    }
  };

  const selectedRing =
    'ring-4 ring-amber-400 bg-amber-100 border-amber-500 text-amber-950 scale-[0.98]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 pointer-events-auto">
      <div
        className="w-full max-w-sm bg-gradient-to-b from-[#fefbf5] to-[#f4f7fd] rounded-[32px] border-4 border-[#ebd373] p-6 text-center shadow-2xl"
        role="dialog"
        aria-label="Adventure Paused"
      >
        {/* Title */}
        <div className="text-4xl mb-2" aria-hidden="true">
          ⏸️
        </div>
        <h2 className="text-2xl font-black text-amber-950 mb-1">Adventure Paused</h2>
        <p className="text-base font-bold text-slate-800 mb-5">
          Take a break or explore your treasures!
        </p>

        {/* Buttons List — instant visual selected feedback & zero narration delay */}
        <div className="flex flex-col gap-2.5">
          {/* Resume */}
          <button
            type="button"
            onPointerDown={() => setSelectedId('resume')}
            onClick={() => handleSelect('resume', onResume)}
            aria-pressed={selectedId === 'resume'}
            className={`w-full min-h-[56px] py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950 font-black text-lg shadow-md border-2 border-amber-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedId === 'resume' ? 'ring-4 ring-amber-500 brightness-105' : ''
            }`}
          >
            <span>▶️</span>
            <span>Resume Adventure</span>
          </button>

          {/* Wardrobe */}
          <button
            type="button"
            onPointerDown={() => setSelectedId('wardrobe')}
            onClick={() => handleSelect('wardrobe', onOpenWardrobe)}
            aria-pressed={selectedId === 'wardrobe'}
            className={`w-full min-h-[52px] py-3 px-4 rounded-2xl font-extrabold text-base shadow-xs border-2 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedId === 'wardrobe'
                ? selectedRing
                : 'bg-white hover:bg-purple-50 text-purple-950 border-purple-300'
            }`}
          >
            <span>👗</span>
            <span>Princess Wardrobe</span>
            {selectedId === 'wardrobe' && <span className="text-sm font-black">✓</span>}
          </button>

          {/* Treasure Book */}
          <button
            type="button"
            onPointerDown={() => setSelectedId('treasurebook')}
            onClick={() => handleSelect('treasurebook', onOpenTreasureBook)}
            aria-pressed={selectedId === 'treasurebook'}
            className={`w-full min-h-[52px] py-3 px-4 rounded-2xl font-extrabold text-base shadow-xs border-2 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedId === 'treasurebook'
                ? selectedRing
                : 'bg-white hover:bg-teal-50 text-teal-950 border-teal-300'
            }`}
          >
            <span>📖</span>
            <span>Treasure Book &amp; Stickers</span>
            {selectedId === 'treasurebook' && <span className="text-sm font-black">✓</span>}
          </button>

          {/* Replay Tutorial */}
          <button
            type="button"
            onPointerDown={() => setSelectedId('tutorial')}
            onClick={() => handleSelect('tutorial', onOpenTutorial)}
            aria-pressed={selectedId === 'tutorial'}
            className={`w-full min-h-[52px] py-3 px-4 rounded-2xl font-extrabold text-base shadow-xs border-2 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedId === 'tutorial'
                ? selectedRing
                : 'bg-white hover:bg-indigo-50 text-indigo-950 border-indigo-300'
            }`}
          >
            <span>❓</span>
            <span>How to Play</span>
            {selectedId === 'tutorial' && <span className="text-sm font-black">✓</span>}
          </button>

          {/* Parent Corner — visually quiet for kids, >=14px & >=4.5:1 contrast for parents */}
          <button
            type="button"
            onPointerDown={() => setSelectedId('parent')}
            onClick={() => handleSelect('parent', onOpenParentCorner)}
            aria-pressed={selectedId === 'parent'}
            className={`w-full min-h-[48px] py-2.5 px-4 rounded-2xl border font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 mt-2 cursor-pointer ${
              selectedId === 'parent'
                ? selectedRing
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            <span>📊</span>
            <span>Parent Corner</span>
            {selectedId === 'parent' && <span className="text-xs font-black">✓</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
