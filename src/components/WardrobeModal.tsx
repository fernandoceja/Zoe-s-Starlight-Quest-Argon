import React from 'react';
import { OUTFIT } from '../game/save.js';
import { SoundFX } from '../game/audio.js';

interface WardrobeModalProps {
  stars: number;
  unlockedMilestones: string[];
  currentOutfit: {
    trail?: string;
    gem?: string;
    skirt?: string;
    buddy?: boolean;
  };
  onSelectOutfit: (newOutfit: any) => void;
  onBack: () => void;
}

const toHex = (n: number) => '#' + n.toString(16).padStart(6, '0');

const trailStyle = (c: any): React.CSSProperties => {
  if (c.rainbow) {
    return {
      background:
        'linear-gradient(90deg, #f472b6, #fbbf24, #34d399, #60a5fa, #a78bfa)',
    };
  }
  if (Array.isArray(c.trail) && c.trail.length >= 2) {
    return {
      background: `linear-gradient(135deg, ${toHex(c.trail[0])}, ${toHex(c.trail[1])})`,
    };
  }
  return { backgroundColor: toHex(c.color) };
};

export const WardrobeModal: React.FC<WardrobeModalProps> = ({
  stars,
  unlockedMilestones,
  currentOutfit,
  onSelectOutfit,
  onBack,
}) => {
  const has = (id: string) => unlockedMilestones.includes(id);

  const handleChoose = (category: string, value: any) => {
    SoundFX.pop();
    const updated = { ...currentOutfit, [category]: value };
    onSelectOutfit(updated);
  };

  const renderProgress = (req: number, unlocked: boolean) => {
    const clamped = Math.min(stars, req);
    const pct = Math.min(100, Math.round((clamped / req) * 100));
    return (
      <div className="mt-2">
        <div className="flex items-center justify-between text-sm font-bold text-slate-700 mb-1">
          <span>{unlocked ? 'Unlocked! 🔓' : `${clamped} of ${req} ⭐`}</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
          <div
            className={`h-full rounded-full transition-all ${
              unlocked ? 'bg-emerald-500' : 'bg-amber-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 pointer-events-auto overflow-y-auto">
      <div
        className="w-full max-w-lg bg-gradient-to-b from-[#fefbf6] to-[#f4f7fd] rounded-[32px] border-4 border-[#ebd373] p-5 sm:p-6 shadow-2xl my-auto flex flex-col max-h-[92vh]"
        role="dialog"
        aria-label="Zoe's Wardrobe"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl" aria-hidden="true">
              👗
            </span>
            <div>
              <h2 className="text-2xl font-black text-amber-950">
                Zoe&apos;s Wardrobe
              </h2>
              <p className="text-sm font-bold text-slate-700">
                You have <span className="font-black text-amber-900">⭐ {stars} stars</span>! Unlock royal styles as you play.
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

        {/* Categories */}
        <div className="flex flex-col gap-3.5 overflow-y-auto pr-1 flex-1 min-h-0">
          {/* Sparkle Trail (10 Stars) */}
          <div className="p-4 bg-white rounded-2xl border-2 border-amber-300 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-black text-base text-purple-950">✨ Sparkle Trail</span>
              <span className="text-sm font-extrabold text-amber-900">
                {has('trail-10') ? 'Unlocked 🔓' : 'Unlocks at 10 ⭐'}
              </span>
            </div>
            {has('trail-10') ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {OUTFIT.trail.choices.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleChoose('trail', c.id)}
                    className={`p-2 rounded-xl border-2 text-sm font-bold flex flex-col items-center gap-1.5 transition-all ${
                      (currentOutfit.trail || 'pinkgold') === c.id
                        ? 'border-purple-600 bg-purple-50 font-black text-purple-950 shadow-sm'
                        : 'border-slate-300 bg-slate-50 text-slate-800 hover:border-slate-400'
                    }`}
                  >
                    <span
                      className="w-10 h-4 rounded-full border border-white shadow-xs"
                      style={trailStyle(c)}
                    />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2" aria-label="Sparkle trail color previews">
                  {OUTFIT.trail.choices.map((c: any) => (
                    <span
                      key={c.id}
                      title={c.label}
                      className="w-9 h-4 rounded-full border-2 border-white shadow-xs"
                      style={trailStyle(c)}
                    />
                  ))}
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Earn 10 stars to pick sparkling magic trail colors behind Zoe!
                </p>
                {renderProgress(10, false)}
              </div>
            )}
          </div>

          {/* Tiara Gem Color (25 Stars) */}
          <div className="p-4 bg-white rounded-2xl border-2 border-amber-300 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-black text-base text-purple-950">💎 Tiara Gem</span>
              <span className="text-sm font-extrabold text-amber-900">
                {has('tiara-25') ? 'Unlocked 🔓' : 'Unlocks at 25 ⭐'}
              </span>
            </div>
            {has('tiara-25') ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {OUTFIT.gem.choices.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleChoose('gem', c.id)}
                    className={`p-2 rounded-xl border-2 text-sm font-bold flex flex-col items-center gap-1.5 transition-all ${
                      (currentOutfit.gem || 'pink') === c.id
                        ? 'border-purple-600 bg-purple-50 font-black text-purple-950 shadow-sm'
                        : 'border-slate-300 bg-slate-50 text-slate-800 hover:border-slate-400'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rotate-45 rounded-xs border-2 border-white shadow-xs"
                      style={{ backgroundColor: toHex(c.color) }}
                    />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-2" aria-label="Tiara gem color previews">
                  {OUTFIT.gem.choices.map((c: any) => (
                    <span
                      key={c.id}
                      title={c.label}
                      className="w-5 h-5 rotate-45 rounded-xs border-2 border-white shadow-xs inline-block"
                      style={{ backgroundColor: toHex(c.color) }}
                    />
                  ))}
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Earn 25 stars to choose sparkling gem colors for Zoe&apos;s tiara!
                </p>
                {renderProgress(25, false)}
              </div>
            )}
          </div>

          {/* Skirt Color (50 Stars) */}
          <div className="p-4 bg-white rounded-2xl border-2 border-amber-300 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-black text-base text-purple-950">👗 Skirt Color</span>
              <span className="text-sm font-extrabold text-amber-900">
                {has('skirt-50') ? 'Unlocked 🔓' : 'Unlocks at 50 ⭐'}
              </span>
            </div>
            {has('skirt-50') ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {OUTFIT.skirt.choices.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleChoose('skirt', c.id)}
                    className={`p-2 rounded-xl border-2 text-sm font-bold flex flex-col items-center gap-1.5 transition-all ${
                      (currentOutfit.skirt || 'rose') === c.id
                        ? 'border-purple-600 bg-purple-50 font-black text-purple-950 shadow-sm'
                        : 'border-slate-300 bg-slate-50 text-slate-800 hover:border-slate-400'
                    }`}
                  >
                    <span
                      className="w-7 h-7 rounded-full border-2 border-white shadow-xs"
                      style={{ backgroundColor: toHex(c.color) }}
                    />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2.5 mb-2" aria-label="Skirt color previews">
                  {OUTFIT.skirt.choices.map((c: any) => (
                    <span
                      key={c.id}
                      title={c.label}
                      className="w-7 h-7 rounded-full border-2 border-white shadow-xs inline-block"
                      style={{ backgroundColor: toHex(c.color) }}
                    />
                  ))}
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Earn 50 stars to unlock pastel royal dress colors for Zoe!
                </p>
                {renderProgress(50, false)}
              </div>
            )}
          </div>

          {/* Butterfly Companion (100 Stars) */}
          <div className="p-4 bg-white rounded-2xl border-2 border-amber-300 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-black text-base text-purple-950">🦋 Butterfly Friend</span>
              <span className="text-sm font-extrabold text-amber-900">
                {has('butterfly-100') ? 'Unlocked 🔓' : 'Unlocks at 100 ⭐'}
              </span>
            </div>
            {has('butterfly-100') ? (
              <button
                type="button"
                onClick={() => handleChoose('buddy', !currentOutfit.buddy)}
                className={`w-full py-3 rounded-xl border-2 text-base font-black transition-all ${
                  currentOutfit.buddy
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                    : 'border-slate-300 bg-slate-50 text-slate-800'
                }`}
              >
                {currentOutfit.buddy
                  ? '✨ Fluttering with Zoe (Active)'
                  : '🦋 Fly with Butterfly Friend'}
              </button>
            ) : (
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-200 via-purple-200 to-sky-200 border-2 border-amber-300 flex items-center justify-center text-2xl shadow-xs">
                    🦋
                  </span>
                  <p className="text-sm font-semibold text-slate-700">
                    Reach 100 stars to invite a magical butterfly friend to flutter beside Zoe!
                  </p>
                </div>
                {renderProgress(100, false)}
              </div>
            )}
          </div>
        </div>

        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="mt-4 w-full min-h-[52px] py-3 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950 font-black text-lg shadow-md active:scale-95 shrink-0"
        >
          Done ✨
        </button>
      </div>
    </div>
  );
};
