import React, { useState, useEffect } from 'react';
import { PRINCESSES } from '../game/quests.js';
import { Narrator } from '../game/audio.js';
import { PrincessId } from '../types';

interface DialogueModalProps {
  npcId: PrincessId;
  lines: string[];
  kind?: 'greeting' | 'praise' | 'encourage';
  onDone: () => void;
  actionLabel?: string;
}

export const DialogueModal: React.FC<DialogueModalProps> = ({
  npcId,
  lines,
  onDone,
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
    if (lineIdx < lines.length - 1) {
      setLineIdx(lineIdx + 1);
    } else {
      Narrator.stop();
      onDone();
    }
  };

  const handleReplay = () => {
    if (currentLine) {
      Narrator.speakExact(npcId, currentLine);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center p-3 sm:p-5 pb-4 sm:pb-6 bg-slate-900/20 pointer-events-auto">
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
            <p className="text-sm font-bold text-slate-700 truncate">
              {princess?.landName}
            </p>
          </div>
          <button
            type="button"
            onClick={handleReplay}
            className="min-w-[48px] min-h-[48px] rounded-full bg-amber-100 hover:bg-amber-200 border-2 border-amber-400 flex items-center justify-center text-xl shadow-sm active:scale-95 shrink-0"
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

        {/* Footer / Stationary Progression Button */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-extrabold text-slate-700 tabular-nums">
            {lines.length > 1 ? `Line ${lineIdx + 1} of ${lines.length}` : ''}
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="min-w-[176px] min-h-[56px] px-6 sm:px-8 py-3 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950 font-black text-lg shadow-md border-2 border-amber-600/30 hover:brightness-105 active:scale-95 transition-transform"
          >
            {lineIdx < lines.length - 1 ? 'Next ➡️' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
