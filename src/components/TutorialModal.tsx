import React, { useState, useEffect } from 'react';
import { Narrator } from '../game/audio.js';
import { Input } from '../game/input.js';

interface TutorialModalProps {
  onComplete: () => void;
}

interface Step {
  id: string;
  title: string;
  emoji: string;
  text: string;
  touchText?: string;
  speech: string;
}

const STEPS: Step[] = [
  {
    id: 'move',
    title: 'How to Move',
    emoji: '🧭',
    text: 'Press the arrow keys (or W A S D) to walk Princess Zoe around the kingdom!',
    touchText: 'Drag the glowing circle on your screen with your finger to walk Princess Zoe!',
    speech:
      'Welcome to Starlight Quest! Walk Princess Zoe around the kingdom using arrow keys, WASD, or drag the circle on your screen.',
  },
  {
    id: 'talk',
    title: 'Talk to Friends',
    emoji: '👑',
    text: 'Walk up to any princess and press E, Space, or tap her to say hello and start her quest!',
    speech:
      'Walk up to any princess and tap her or press E to say hello and start her quest!',
  },
  {
    id: 'answer',
    title: 'Answer Questions',
    emoji: '⭐',
    text: 'Pick an answer from the big cards. Wrong answers get gentle hints and second chances — no losing ever!',
    speech:
      'Answer five fun questions. Tap the cards to answer! If you miss, a gentle hint helps you try again.',
  },
  {
    id: 'stars',
    title: 'Collect Stars',
    emoji: '✨',
    text: 'Earn stars with every quest! Completing all ten lands brings the golden Starlight Crown back to the castle.',
    speech:
      'Earn stars and star shards! Restoring all ten lands brings the magical Starlight Crown back to the castle.',
  },
  {
    id: 'pause',
    title: 'Pause & Dress Up',
    emoji: '👗',
    text: 'Tap the big Pause button anytime to change your dress, check your stickers, or visit the Parent Corner.',
    speech:
      'Tap the pause button anytime to dress up Zoe with unlocked rewards, or view the Parent Corner.',
  },
];

/** Offline inline SVG illustration of Princess Zoe happily stepping with sparkle footprints */
const ZoeSteppingGraphic: React.FC = () => (
  <svg
    viewBox="0 0 112 96"
    className="w-24 h-20 sm:w-28 sm:h-24 shrink-0"
    role="img"
    aria-label="Princess Zoe walking forward"
  >
    {/* Soft ground shadow & sparkle footprints */}
    <ellipse cx="64" cy="84" rx="22" ry="6" fill="#f3d5e5" />
    <circle cx="18" cy="79" r="3.5" fill="#f59e0b" />
    <circle cx="30" cy="83" r="4.5" fill="#fbbf24" />
    <circle cx="42" cy="78" r="3" fill="#f472b6" />
    {/* Motion lines */}
    <line x1="12" y1="48" x2="26" y2="48" stroke="#c084fc" strokeWidth="3" strokeLinecap="round" />
    <line x1="8" y1="58" x2="22" y2="58" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
    {/* Stepping legs & little pink shoes */}
    <line x1="58" y1="68" x2="50" y2="81" stroke="#f7c8a8" strokeWidth="4.5" strokeLinecap="round" />
    <line x1="68" y1="68" x2="78" y2="79" stroke="#f7c8a8" strokeWidth="4.5" strokeLinecap="round" />
    <ellipse cx="48" cy="82" rx="6" ry="3.5" fill="#db2777" />
    <ellipse cx="80" cy="80" rx="6" ry="3.5" fill="#db2777" />
    {/* Princess Zoe wavy hair back */}
    <ellipse cx="62" cy="36" rx="16" ry="15" fill="#6b4430" />
    {/* Princess Zoe pink skirt */}
    <path d="M54 46 L72 46 L82 71 Q63 76 44 71 Z" fill="#f472b6" stroke="#be185d" strokeWidth="2" />
    {/* Lavender sash */}
    <path d="M53 50 Q63 54 73 50" fill="none" stroke="#c4b5fd" strokeWidth="4" strokeLinecap="round" />
    {/* Friendly waving arms */}
    <line x1="54" y1="50" x2="43" y2="57" stroke="#f7c8a8" strokeWidth="4" strokeLinecap="round" />
    <line x1="72" y1="50" x2="84" y2="44" stroke="#f7c8a8" strokeWidth="4" strokeLinecap="round" />
    {/* Head & smiling face */}
    <circle cx="63" cy="32" r="12" fill="#fce1cb" stroke="#d49e7e" strokeWidth="1.5" />
    <path d="M51 30 Q63 17 75 30 Q70 23 63 24 Q56 23 51 30 Z" fill="#6b4430" />
    <circle cx="59" cy="32" r="1.8" fill="#1e293b" />
    <circle cx="67" cy="32" r="1.8" fill="#1e293b" />
    <path d="M59 37 Q63 40 67 37" fill="none" stroke="#be185d" strokeWidth="2" strokeLinecap="round" />
    {/* Silver tiara with pink gem */}
    <path d="M55 21 L59 13 L63 18 L67 13 L71 21 Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />
    <circle cx="63" cy="17.5" r="2.2" fill="#ec4899" />
  </svg>
);

/** Big tactile Arrow Keys picture (+ optional Touch Joystick graphic on touch screens) */
const MoveVisualIllustration: React.FC<{ isTouch: boolean }> = ({ isTouch }) => (
  <div className="flex items-center justify-center gap-4 sm:gap-6 py-2 px-3 bg-white/95 rounded-2xl border-2 border-amber-300 shadow-inner">
    {isTouch ? (
      <div className="flex flex-col items-center gap-1" aria-label="Touch joystick circle">
        <svg viewBox="0 0 88 88" className="w-20 h-20" role="img" aria-label="Drag joystick circle">
          <circle cx="44" cy="44" r="38" fill="#fef3c7" stroke="#d97706" strokeWidth="3.5" strokeDasharray="6 4" />
          <path d="M44 12 L50 20 L38 20 Z" fill="#b45309" />
          <path d="M44 76 L50 68 L38 68 Z" fill="#b45309" />
          <path d="M12 44 L20 38 L20 50 Z" fill="#b45309" />
          <path d="M76 44 L68 38 L68 50 Z" fill="#b45309" />
          <circle cx="52" cy="40" r="15" fill="#fbbf24" stroke="#92400e" strokeWidth="3" />
          <text x="52" y="45" textAnchor="middle" fontSize="14" fontWeight="900" fill="#451a03">
            👆
          </text>
        </svg>
        <span className="text-xs font-black text-amber-950 uppercase tracking-wide">
          Drag Circle
        </span>
      </div>
    ) : (
      <div className="flex flex-col items-center gap-1.5" aria-label="Arrow keys on keyboard">
        <div className="flex justify-center">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-100 border-2 border-amber-600 border-b-4 flex items-center justify-center text-2xl font-black text-amber-950 shadow-sm">
            ↑
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-100 border-2 border-amber-600 border-b-4 flex items-center justify-center text-2xl font-black text-amber-950 shadow-sm">
            ←
          </div>
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-100 border-2 border-amber-600 border-b-4 flex items-center justify-center text-2xl font-black text-amber-950 shadow-sm">
            ↓
          </div>
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-100 border-2 border-amber-600 border-b-4 flex items-center justify-center text-2xl font-black text-amber-950 shadow-sm">
            →
          </div>
        </div>
        <span className="text-xs font-extrabold text-slate-800">
          Arrow Keys (or W A S D)
        </span>
      </div>
    )}

    <ZoeSteppingGraphic />
  </div>
);

export const TutorialModal: React.FC<TutorialModalProps> = ({ onComplete }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const isTouch = Input.isTouchDevice();

  const step = STEPS[stepIdx];
  const displayText = isTouch && step.touchText ? step.touchText : step.text;

  useEffect(() => {
    Narrator.speakText(step.speech);
    return () => {
      Narrator.stop();
    };
  }, [stepIdx, step.speech]);

  const handleNext = () => {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      Narrator.stop();
      onComplete();
    }
  };

  const handleSkip = () => {
    Narrator.stop();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65">
      <div
        className="relative w-full max-w-lg bg-gradient-to-b from-[#fdfcfe] via-[#fbf7eb] to-[#eef6ff] rounded-[32px] border-4 border-[#ebd373] p-5 sm:p-7 text-center shadow-2xl"
        role="dialog"
        aria-label={`How to Play — Step ${stepIdx + 1} of ${STEPS.length}: ${step.title}`}
      >
        {/* Clearly separated Progress Header: Step label + Numbered/Checkmarked Shape Indicators */}
        <div className="mb-4 pb-3 border-b-2 border-amber-200">
          <div className="text-sm sm:text-base font-black text-purple-950 uppercase tracking-wide mb-2 tabular-nums">
            Step {stepIdx + 1} of {STEPS.length}
          </div>
          <ol
            className="flex items-center justify-center gap-2"
            aria-label={`Tutorial progress: step ${stepIdx + 1} of ${STEPS.length}`}
          >
            {STEPS.map((s, i) => {
              const isCurrent = i === stepIdx;
              const isDone = i < stepIdx;
              return (
                <li
                  key={s.id}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`h-8 rounded-full font-black text-sm flex items-center justify-center border-2 transition-all tabular-nums ${
                    isCurrent
                      ? 'w-12 bg-amber-500 text-white border-purple-900 ring-2 ring-amber-300 shadow-sm'
                      : isDone
                      ? 'w-8 bg-emerald-600 text-white border-emerald-800'
                      : 'w-8 bg-white text-slate-800 border-slate-400'
                  }`}
                >
                  {isDone ? '✓' : i + 1}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Distinct Step Visual Area (clearly separated from step indicators above) */}
        <div className="mb-3 flex items-center justify-center min-h-[112px]">
          {step.id === 'move' ? (
            <MoveVisualIllustration isTouch={isTouch} />
          ) : (
            <div className="w-24 h-24 rounded-3xl bg-white border-2 border-amber-300 shadow-inner flex items-center justify-center text-5xl">
              <span aria-hidden="true">{step.emoji}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-black text-amber-950 mb-2">
          {step.title}
        </h2>

        {/* Description (fixed height so Next button stays stationary across all 5 steps) */}
        <p className="text-base sm:text-lg font-extrabold text-slate-900 mb-5 min-h-[5.25rem] px-2 flex items-center justify-center leading-snug">
          {displayText}
        </p>

        {/* Audio Replay Button */}
        <button
          type="button"
          onClick={() => Narrator.speakText(step.speech)}
          className="mb-5 min-h-[48px] inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-amber-50 border-2 border-amber-500 text-base font-black text-amber-950 shadow-sm active:scale-95 cursor-pointer"
          aria-label="Read again"
        >
          <span aria-hidden="true">🔊</span>
          <span>Listen again</span>
        </button>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="min-h-[52px] px-6 py-3 rounded-full bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-base font-black text-slate-900 transition-colors cursor-pointer"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="min-w-[168px] min-h-[56px] px-8 py-3.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950 font-black text-lg shadow-lg border-2 border-amber-600/30 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
          >
            {stepIdx === STEPS.length - 1 ? "Let's Play! 👑" : 'Next ➡️'}
          </button>
        </div>
      </div>
    </div>
  );
};
