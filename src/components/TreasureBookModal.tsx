import React from 'react';
import { ALL_SECRETS } from '../game/treasures.js';
import { PRINCESSES } from '../game/quests.js';

interface TreasureBookModalProps {
  foundSecrets: string[];
  treasuresToday: number;
  treasuresTotal: number;
  onBack: () => void;
}

export const TreasureBookModal: React.FC<TreasureBookModalProps> = ({
  foundSecrets,
  treasuresToday,
  treasuresTotal,
  onBack,
}) => {
  const foundCount = foundSecrets.length;
  const totalSecrets = ALL_SECRETS.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 pointer-events-auto overflow-y-auto">
      <div
        className="w-full max-w-xl bg-gradient-to-b from-[#fefbf6] to-[#f4f7fd] rounded-[32px] border-4 border-[#ebd373] p-5 sm:p-6 shadow-2xl my-auto flex flex-col max-h-[92vh]"
        role="dialog"
        aria-label="Treasure Book"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl" aria-hidden="true">
              📖
            </span>
            <div>
              <h2 className="text-2xl font-black text-amber-950">
                Treasure Book
              </h2>
              <p className="text-sm font-bold text-slate-700">
                Secret stickers: {foundCount} of {totalSecrets} found
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="min-w-[44px] min-h-[44px] rounded-full bg-slate-200 hover:bg-slate-300 font-black text-slate-800 flex items-center justify-center text-lg active:scale-95"
            aria-label="Back"
          >
            ✕
          </button>
        </div>

        {/* Daily Sparkles Counter (clearly distinct from HUD Gems badge) */}
        <div className="mb-3 p-3 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center justify-between gap-2 text-base font-extrabold text-amber-950 shrink-0">
          <span className="flex items-center gap-2">
            <span aria-hidden="true">✨</span>
            <span>Sparkles found today</span>
          </span>
          <span className="font-black text-lg text-amber-900 tabular-nums">
            {treasuresToday} / {treasuresTotal}
          </span>
        </div>

        {/* Sticker Album Grid — High contrast >= 16px labels, all 11 stickers reachable */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 overflow-y-auto pr-1 py-1 flex-1 min-h-0">
          {ALL_SECRETS.map((sec: any) => {
            const isFound = foundSecrets.includes(sec.id);
            const p = PRINCESSES[sec.npc];
            return (
              <div
                key={sec.id}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center text-center shadow-xs ${
                  isFound
                    ? 'bg-white border-amber-400'
                    : 'bg-slate-100 border-dashed border-slate-400'
                }`}
              >
                <div className="text-3xl sm:text-4xl mb-1 leading-none">
                  {isFound ? sec.emoji : '❓'}
                </div>
                <div className="font-black text-base text-slate-900 leading-snug">
                  {isFound ? sec.label : 'Secret Sticker'}
                </div>
                <div className="text-base font-bold text-slate-700 mt-0.5 leading-snug">
                  {p?.name || 'Kingdom'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Clear Scroll Hint */}
        <p className="mt-2 text-center text-sm font-bold text-slate-700 shrink-0">
          Scroll to see all {totalSecrets} kingdom stickers ✨
        </p>

        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="mt-3 w-full min-h-[52px] py-3 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950 font-black text-lg shadow-md active:scale-95 shrink-0"
        >
          Back to Quest 🌟
        </button>
      </div>
    </div>
  );
};
