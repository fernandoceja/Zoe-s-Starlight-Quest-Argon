import React from 'react';

interface PauseMenuProps {
  onResume: () => void;
  onOpenWardrobe: () => void;
  onOpenTreasureBook: () => void;
  onOpenTutorial: () => void;
  onOpenParentCorner: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onOpenWardrobe,
  onOpenTreasureBook,
  onOpenTutorial,
  onOpenParentCorner,
}) => {
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
        <p className="text-sm font-bold text-slate-700 mb-5">
          Take a break or explore your treasures!
        </p>

        {/* Buttons List */}
        <div className="flex flex-col gap-2.5">
          {/* Resume */}
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[52px] py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950 font-black text-lg shadow-md border-2 border-amber-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <span>▶️</span>
            <span>Resume Adventure</span>
          </button>

          {/* Wardrobe */}
          <button
            type="button"
            onClick={onOpenWardrobe}
            className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 text-purple-950 font-extrabold text-base shadow-xs border-2 border-purple-200 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <span>👗</span>
            <span>Princess Wardrobe</span>
          </button>

          {/* Treasure Book */}
          <button
            type="button"
            onClick={onOpenTreasureBook}
            className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 text-teal-950 font-extrabold text-base shadow-xs border-2 border-teal-200 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <span>📖</span>
            <span>Treasure Book &amp; Stickers</span>
          </button>

          {/* Replay Tutorial */}
          <button
            type="button"
            onClick={onOpenTutorial}
            className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 text-indigo-950 font-extrabold text-base shadow-xs border-2 border-indigo-200 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <span>❓</span>
            <span>How to Play</span>
          </button>

          {/* Parent Corner — visually quiet for kids, >=14px & >=4.5:1 contrast for parents */}
          <button
            type="button"
            onClick={onOpenParentCorner}
            className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-1.5 mt-2"
          >
            <span>📊</span>
            <span>Parent Corner</span>
          </button>
        </div>
      </div>
    </div>
  );
};
