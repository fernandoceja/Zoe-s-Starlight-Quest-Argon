import React, { useState, useEffect } from 'react';
import { PRINCESSES } from '../game/quests.js';
import { Narrator } from '../game/audio.js';
import { PrincessId } from '../types';

interface DialogueModalProps {
  npcId: PrincessId;
  lines: string[];
  kind?: 'greeting' | 'praise' | 'encourage';
  onDone: () => void;
  onLeave?: () => void;
  paused?: boolean;
  actionLabel?: string;
}

export const DialogueModal: React.FC<DialogueModalProps> = ({
  npcId,
  lines,
  onDone,
  onLeave,
  paused = false,
  actionLabel = "Let's Go! ✨",
}) => {
  const [lineIdx, setLineIdx] = useState(0);
  const princess = PRINCESSES[npcId];
  const currentLine = lines[lineIdx] || '';

  useEffect(() => {
    setLineIdx(0);
  }, [npcId, lines]);

  useEffect(() => {
    if (currentLine) {
      Narrator.speakExact(npcId, currentLine);
    }
    return () => {
      Narrator.stop();
    };
  }, [lineIdx, currentLine, npcId]);

  const handleNext = () => {
    if (paused) return;
    if (lineIdx < lines.length - 1) {
      setLineIdx(lineIdx + 1);
    } else {
      Narrator.stop();
      onDone();
    }
  };

  const handleReplay = () => {
    if (paused) return;
    if (currentLine) {
      Narrator.speakExact(npcId, currentLine);
    }
  };

  const handleLeave = () => {
    if (paused) return;
    Narrator.stop();
    onLeave?.();
  };

  return (
    <div
      aria-hidden={paused}
      className={`fixed inset-0 z-40 flex items-end justify-center p-3 sm:p-5 pb-4 sm:pb-6 bg-slate-900/20 ${
        paused ? 'pointer-events-none' : 'pointer-events-auto'
      }`}
    >
      <div
        className="w-full max-w-xl bg-[#fffdf8] rounded-3xl border-4 border-[#ebd373] p-4 sm:p-6 shadow-2xl relative"
        role="dialog"
        aria-label={`${princess?.name || 'Princess'} dialogue`}
      >
        {/* Princess Info Header */}
        <div className="flex items-center gap-3.5 mb-3">
          <div
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden border-4 shadow-md shrink-0 bg-white"
            style={{ borderColor: princess?.color || '#ebd373' }}
          >
            <img
              src={princess?.portrait}
              alt={princess?.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 truncate">
              {princess?.name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-700 truncate">
                {princess?.landName}
              </p>
              {lines.length > 1 && (
                <span className="text-xs font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full tabular-nums">
                  {lineIdx + 1} / {lines.length}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleReplay}
            disabled={paused}
            className="min-w-[48px] min-h-[48px] rounded-full bg-amber-100 hover:bg-amber-200 border-2 border-amber-400 flex items-center justify-center text-xl shadow-sm active:scale-95 shrink-0 cursor-pointer"
            aria-label="Repeat speech"
            title="Listen again"
          >
            🔊
          </button>
        </div>

        {/* Fixed-height Speech Bubble so the Next button NEVER shifts between lines */}
        <div className="bg-white border-2 border-amber-200 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 mb-4 shadow-inner h-28 sm:h-32 overflow-y-auto flex items-center">
          <p className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
            &ldquo;{currentLine}&rdquo;
          </p>
        </div>

        {/* Footer: Friendly Leave button + Stationary Progression Button (both >= 56px) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {onLeave ? (
            <button
              type="button"
              onClick={handleLeave}
              disabled={paused}
              className="min-h-[56px] px-5 py-3 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-950 font-black text-base sm:text-lg border-2 border-purple-400 shadow-sm active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-1.5"
              aria-label="Bye for now — return to exploring"
            >
              <span>Bye for now</span>
              <span aria-hidden="true">👋</span>
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={paused}
            className="min-w-[176px] min-h-[56px] px-6 sm:px-8 py-3 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950 font-black text-lg shadow-md border-2 border-amber-600/30 hover:brightness-105 active:scale-95 transition-transform cursor-pointer"
          >
            {lineIdx < lines.length - 1 ? 'Next ➡️' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
