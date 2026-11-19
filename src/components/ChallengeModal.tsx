import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  PRINCESSES,
  QUESTS,
  tileSound,
  BELLE_CLIP_DIR,
  getEscalatingHint,
  revealLines,
} from '../game/quests.js';
import { shapeSVG } from '../game/shapes.js';
import { tallyCardHtml } from '../game/tally.js';
import { Narrator, SoundFX } from '../game/audio.js';
import { PrincessId, Round } from '../types';

interface ChallengeModalProps {
  npcId: PrincessId;
  round: Round;
  roundIdx: number;
  totalRounds: number;
  baseTotal?: number;
  completedBaseCount?: number;
  onCorrect: () => void;
  onMiss: (missCount: number) => void;
}

const FLOWER_HEX: Record<string, { bg: string; label: string }> = {
  pink: { bg: '#ec4899', label: 'Pink' },
  yellow: { bg: '#eab308', label: 'Yellow' },
  purple: { bg: '#8b5cf6', label: 'Purple' },
  blue: { bg: '#3b82f6', label: 'Blue' },
};

export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  npcId,
  round,
  roundIdx,
  baseTotal = 5,
  completedBaseCount = 0,
  onCorrect,
  onMiss,
}) => {
  const princess = PRINCESSES[npcId];
  const quest = QUESTS[npcId];

  const [misses, setMisses] = useState(0);
  const [feedback, setFeedback] = useState<{
    type: 'correct' | 'wrong' | 'reveal' | null;
    message: string;
  }>({ type: null, message: '' });
  const [shuffledChoices, setShuffledChoices] = useState<string[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [dimmedChoices, setDimmedChoices] = useState<string[]>([]);
  const [highlightClue, setHighlightClue] = useState(false);
  const [disabled, setDisabled] = useState(false);

  // Blend tiles state (for Belle CVC)
  const [activeBlendLetter, setActiveBlendLetter] = useState<number | null>(null);

  // Tile builder state (for Belle spelling / dictation)
  const [placedTiles, setPlacedTiles] = useState<string[]>([]);
  const [tileWrongs, setTileWrongs] = useState(0);

  // Sorting state (for Aurora or Rapunzel sorting)
  const [sortedItems, setSortedItems] = useState<
    { name: string; pic?: string; naming?: boolean; living?: boolean; bin?: string }[]
  >([]);

  const speakQuestion = useCallback(() => {
    let text = round.replay || round.say || round.prompt;
    if (
      (npcId === 'cinderella' ||
        npcId === 'rapunzel' ||
        ((npcId === 'ariel' ||
          npcId === 'moana' ||
          npcId === 'jasmine' ||
          npcId === 'anna' ||
          npcId === 'tiana' ||
          npcId === 'aurora') &&
          !round.noChoiceSay)) &&
      !round.sort &&
      round.choices &&
      round.choices.length > 0
    ) {
      const labels = round.choices.map((c) =>
        round.choiceSay && round.choiceSay[c]
          ? round.choiceSay[c]
          : c.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim()
      );
      text +=
        ' Is it ' +
        labels.slice(0, -1).join(', ') +
        ', or ' +
        labels[labels.length - 1] +
        '?';
    }
    Narrator.speakExact(npcId, text);
  }, [npcId, round]);

  // Setup choices on new round
  useEffect(() => {
    setMisses(0);
    setFeedback({ type: null, message: '' });
    setSelectedChoice(null);
    setDimmedChoices([]);
    setHighlightClue(false);
    setDisabled(false);
    setPlacedTiles([]);
    setTileWrongs(0);

    if (round.sort?.items) {
      setSortedItems(round.sort.items.map((it: any) => ({ ...it, bin: undefined })));
    } else {
      setSortedItems([]);
    }

    if (round.choices && round.choices.length > 0) {
      const copy = [...round.choices];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      setShuffledChoices(copy);
    } else {
      setShuffledChoices([]);
    }

    speakQuestion();

    return () => {
      Narrator.stop();
    };
  }, [round, npcId, speakQuestion]);

  // Trigger celebration confetti
  const fireConfetti = () => {
    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#ebd373', '#f472b6', '#60a5fa', '#34c779', '#a78bfa'],
      });
    } catch {
      // Ignore confetti errors
    }
  };

  // Shared win celebration (used by choice cards, tile builders, and sorting bins)
  const triggerWin = () => {
    setDisabled(true);
    SoundFX.chime();
    fireConfetti();
    const praises = [
      'Wonderful! You did it!',
      'Amazing work, superstar!',
      'Yes! You are so smart!',
      'Beautiful! Keep shining!',
    ];
    const praise = praises[Math.floor(Math.random() * praises.length)];
    setFeedback({ type: 'correct', message: `⭐ +1 star! ${praise}` });
    Narrator.speakExact(npcId, praise);

    setTimeout(() => {
      onCorrect();
    }, 1500);
  };

  // Choice button pick
  const handleChoice = (choice: string) => {
    if (disabled || dimmedChoices.includes(choice)) return;
    setSelectedChoice(choice);

    if (choice === round.answer) {
      triggerWin();
      return;
    }

    // Missed pick — 3 escalating gentle hints, then gentle reveal on 4th miss
    const nextMisses = misses + 1;
    setMisses(nextMisses);
    onMiss(nextMisses);
    SoundFX.pop();

    if (nextMisses >= 4) {
      setDisabled(true);
      const rev = revealLines(round);
      setFeedback({ type: 'reveal', message: rev.shown });
      Narrator.speakExact(npcId, rev.say);
      setTimeout(() => {
        onCorrect();
      }, 2100);
      return;
    }

    const hintInfo = getEscalatingHint(round, nextMisses);
    if (hintInfo.highlight) {
      setHighlightClue(true);
    }

    if (hintInfo.dimWrong && shuffledChoices.length >= 2) {
      // Softly dim one wrong choice card (prefer the one just picked if it's wrong)
      const wrongCandidates = shuffledChoices.filter(
        (c) => c !== round.answer && !dimmedChoices.includes(c)
      );
      const toDim = wrongCandidates.includes(choice)
        ? choice
        : wrongCandidates[0];
      if (toDim) {
        setDimmedChoices((prev) => (prev.includes(toDim) ? prev : [...prev, toDim]));
      }
      const msg =
        shuffledChoices.length === 2
          ? "Let's try the other one! 💛"
          : hintInfo.text;
      setFeedback({ type: 'wrong', message: msg });
      Narrator.speakExact(npcId, msg);
      return;
    }

    setFeedback({ type: 'wrong', message: hintInfo.text });
    Narrator.speakExact(
      npcId,
      hintInfo.say,
      nextMisses === 1 && round.sound
        ? () => Narrator.playClip(BELLE_CLIP_DIR + round.sound)
        : undefined
    );
  };

  // Render Visible Blanked Word / Clue Strip (Task 2 — Sound-off Accessibility)
  const renderShowAndClue = () => {
    const hasShow = Boolean(round.show);
    const hasClue = Boolean(round.clue);
    const hasStandalonePic =
      Boolean(round.pic) && !round.visual && !round.clock;

    if (!hasShow && !hasClue && !hasStandalonePic) return null;

    const tokens = round.show ? round.show.split(/\s+/).filter(Boolean) : [];
    const hasBlank = tokens.some((t) => t === '_');

    return (
      <div
        className={`my-2 px-3 py-2.5 rounded-2xl border-2 flex flex-wrap items-center justify-center gap-3 transition-colors ${
          highlightClue
            ? 'bg-amber-100 border-amber-400 shadow-sm'
            : 'bg-amber-50/90 border-amber-200'
        }`}
      >
        {round.pic && (
          <span
            className="text-4xl sm:text-5xl leading-none select-none"
            aria-hidden="true"
          >
            {round.pic}
          </span>
        )}

        {hasShow && (
          <div
            className="flex items-center justify-center gap-1.5"
            aria-label={hasBlank ? `Blanked word: ${round.show}` : `Word: ${round.show}`}
          >
            {hasBlank ? (
              tokens.map((tok, i) => {
                const isBlank = tok === '_';
                return (
                  <span
                    key={i}
                    className={`min-w-[40px] h-12 px-2.5 rounded-xl border-2 font-black text-2xl sm:text-3xl flex items-center justify-center ${
                      isBlank
                        ? 'bg-amber-200 border-dashed border-amber-600 text-amber-950'
                        : 'bg-white border-purple-300 text-slate-900 shadow-xs'
                    }`}
                  >
                    {isBlank ? '?' : tok}
                  </span>
                );
              })
            ) : (
              <span className="px-4 py-1.5 rounded-xl bg-white border-2 border-purple-300 font-black text-2xl sm:text-3xl text-slate-900 shadow-xs">
                {round.show}
              </span>
            )}
          </div>
        )}

        {hasClue && (
          <span className="text-base font-extrabold text-slate-800 bg-white/95 px-3 py-1 rounded-xl border border-amber-300">
            {round.clue}
          </span>
        )}
      </div>
    );
  };

  // Render Visual Helpers
  const renderVisual = () => {
    // Clock SVG (Cinderella)
    if (npcId === 'cinderella' && round.clock) {
      const { hour, minute } = round.clock;
      const ha = ((hour % 12) + minute / 60) * 30;
      const ma = minute * 6;
      const hr = (ha * Math.PI) / 180;
      const mr = (ma * Math.PI) / 180;
      const hx = 50 + 16 * Math.sin(hr);
      const hy = 50 - 16 * Math.cos(hr);
      const mx = 50 + 25 * Math.sin(mr);
      const my = 50 - 25 * Math.cos(mr);

      return (
        <div className="my-2 flex justify-center">
          <svg
            viewBox="0 0 100 100"
            className={`w-32 h-32 sm:w-36 sm:h-36 drop-shadow-md rounded-full ${
              highlightClue ? 'ring-4 ring-amber-400' : ''
            }`}
            role="img"
            aria-label={`Clock showing ${hour}:${minute === 0 ? '00' : '30'}`}
          >
            <circle cx="50" cy="50" r="46" fill="#fffbe8" stroke="#ebd373" strokeWidth="5" />
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i * 30 * Math.PI) / 180;
              return (
                <line
                  key={i}
                  x1={50 + 36 * Math.sin(a)}
                  y1={50 - 36 * Math.cos(a)}
                  x2={50 + 43 * Math.sin(a)}
                  y2={50 - 43 * Math.cos(a)}
                  stroke="#785a28"
                  strokeWidth={i % 3 === 0 ? 3 : 1.5}
                />
              );
            })}
            {Array.from({ length: 12 }, (_, i) => {
              const num = i + 1;
              const a = (num * 30 * Math.PI) / 180;
              return (
                <text
                  key={num}
                  x={50 + 30.5 * Math.sin(a)}
                  y={50 - 30.5 * Math.cos(a)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontWeight="900"
                  fontSize="11"
                  fill="#1e293b"
                >
                  {num}
                </text>
              );
            })}
            <line x1="50" y1="50" x2={hx} y2={hy} stroke="#5b4a8a" strokeWidth="5" strokeLinecap="round" />
            <line x1="50" y1="50" x2={mx} y2={my} stroke="#d9532f" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="50" cy="50" r="5" fill="#ebd373" />
          </svg>
        </div>
      );
    }

    // Shapes SVG (Moana)
    if (npcId === 'moana' && round.visual && round.visual.kind === 'shape') {
      const svgStr = shapeSVG(round.visual);
      return (
        <div
          className={`my-2 flex justify-center rounded-2xl p-1 ${
            highlightClue ? 'bg-amber-100 ring-2 ring-amber-400' : ''
          }`}
          dangerouslySetInnerHTML={{ __html: svgStr }}
        />
      );
    }

    // Tally Cards (Tiana)
    if (
      npcId === 'tiana' &&
      round.visual &&
      (round.visual.kind === 'tally' || round.visual.kind === 'tallychart')
    ) {
      const htmlStr = tallyCardHtml(round.visual);
      return (
        <div
          className="my-2 flex justify-center max-w-full overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: htmlStr }}
        />
      );
    }

    // Jasmine Story Cards
    if (npcId === 'jasmine' && round.visual && round.visual.kind === 'story') {
      const cards = round.visual.cards || [];
      return (
        <div className="my-2 flex items-center justify-center gap-2 max-w-full overflow-x-auto p-1">
          {cards.map((c: any, i: number) => (
            <React.Fragment key={i}>
              <div className="flex-1 min-w-[84px] max-w-[130px] bg-white border-2 border-indigo-300 rounded-2xl p-2 text-center shadow-xs">
                <div className="text-3xl leading-none mb-1">{c.e}</div>
                <div className="text-sm font-black text-indigo-950 leading-tight">{c.t}</div>
              </div>
              {i < cards.length - 1 && (
                <span className="text-indigo-700 font-black text-lg">➔</span>
              )}
            </React.Fragment>
          ))}
          {round.visual.more && (
            <>
              <span className="text-indigo-700 font-black text-lg">➔</span>
              <div className="flex-1 min-w-[76px] max-w-[110px] bg-indigo-50 border-2 border-dashed border-indigo-400 rounded-2xl p-2 text-center">
                <div className="text-3xl">❓</div>
                <div className="text-sm font-black text-indigo-900">Next?</div>
              </div>
            </>
          )}
        </div>
      );
    }

    // Anna Harbor Sign
    if (npcId === 'anna' && round.visual && round.visual.kind === 'sentence') {
      return (
        <div
          className={`my-2 mx-auto max-w-md bg-white border-4 rounded-2xl p-3 sm:p-4 text-center shadow-sm ${
            highlightClue ? 'border-amber-400 bg-amber-50' : 'border-red-300'
          }`}
        >
          <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-normal">
            {round.visual.text}
          </p>
        </div>
      );
    }

    // Elsa Count-on Number Line, Doubles, Snowflakes, Tens/Ones, 3-Addends
    if (npcId === 'elsa' && round.visual) {
      if (round.visual.kind === 'counton') {
        const { start, hop } = round.visual;
        return (
          <div className="my-2 p-2.5 bg-sky-50 rounded-2xl border-2 border-sky-300 flex flex-col items-center">
            <div className="text-base font-bold text-sky-950 mb-1">
              Start at <span className="text-lg font-black text-sky-700">{start}</span>, count on{' '}
              <span className="text-lg font-black text-rose-700">+{hop}</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 py-1">
              {Array.from({ length: hop + 2 }, (_, i) => {
                const val = start + i;
                const isStart = i === 0;
                const isEnd = i === hop;
                return (
                  <div key={i} className="flex flex-col items-center">
                    {i > 0 && i <= hop && (
                      <span className="text-xs font-black text-rose-700 mb-0.5">+1 ↷</span>
                    )}
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-black text-base sm:text-lg border-2 ${
                        isStart
                          ? 'bg-sky-700 text-white border-white shadow-sm'
                          : isEnd
                          ? 'bg-amber-300 text-amber-950 border-amber-600 shadow-md'
                          : 'bg-white text-sky-950 border-sky-300'
                      }`}
                    >
                      {isEnd ? '?' : val}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      if (round.visual.kind === 'doubles') {
        const n = round.visual.n;
        return (
          <div className="my-2 flex items-center justify-center gap-3">
            <div className="bg-sky-50 border-2 border-sky-300 rounded-2xl p-2 sm:p-3 flex flex-wrap gap-1 max-w-[130px] justify-center text-2xl">
              {Array.from({ length: n }, (_, i) => (
                <span key={i}>❄️</span>
              ))}
            </div>
            <span className="text-2xl font-black text-sky-800">➕</span>
            <div className="bg-sky-50 border-2 border-sky-300 rounded-2xl p-2 sm:p-3 flex flex-wrap gap-1 max-w-[130px] justify-center text-2xl">
              {Array.from({ length: n }, (_, i) => (
                <span key={i}>❄️</span>
              ))}
            </div>
          </div>
        );
      }

      if (round.visual.tens != null) {
        const { tens, ones } = round.visual;
        return (
          <div className="my-2 flex flex-wrap items-center justify-center gap-3 p-2 bg-sky-50 rounded-2xl border-2 border-sky-300">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: tens }, (_, i) => (
                <div
                  key={i}
                  className="px-2.5 py-1.5 rounded-xl bg-sky-600 text-white font-black text-base border-2 border-white shadow-xs"
                >
                  10 ❄️
                </div>
              ))}
            </div>
            {ones > 0 && (
              <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border-2 border-sky-300 text-xl">
                {Array.from({ length: ones }, (_, i) => (
                  <span key={i}>❄️</span>
                ))}
              </div>
            )}
          </div>
        );
      }

      if (Array.isArray(round.visual.parts)) {
        const parts: number[] = round.visual.parts;
        return (
          <div className="my-2 flex flex-wrap items-center justify-center gap-2">
            {parts.map((p, idx) => (
              <React.Fragment key={idx}>
                <div className="bg-sky-50 border-2 border-sky-300 rounded-2xl px-2.5 py-1.5 flex flex-wrap gap-0.5 max-w-[110px] justify-center text-xl">
                  {Array.from({ length: p }, (_, i) => (
                    <span key={i}>❄️</span>
                  ))}
                </div>
                {idx < parts.length - 1 && (
                  <span className="text-xl font-black text-sky-800">➕</span>
                )}
              </React.Fragment>
            ))}
          </div>
        );
      }

      if (round.visual.a != null) {
        const { a, b } = round.visual;
        return (
          <div className="my-2 flex items-center justify-center gap-3">
            <div className="bg-sky-50 border-2 border-sky-300 rounded-2xl p-2 sm:p-2.5 flex flex-wrap gap-1 max-w-[155px] justify-center text-xl sm:text-2xl">
              {Array.from({ length: a }, (_, i) => (
                <span key={i}>❄️</span>
              ))}
            </div>
            {b > 0 && (
              <>
                <span className="text-2xl font-black text-sky-800">
                  {round.visual.op === '-' ? '➖' : '➕'}
                </span>
                <div className="bg-sky-50 border-2 border-sky-300 rounded-2xl p-2 sm:p-2.5 flex flex-wrap gap-1 max-w-[155px] justify-center text-xl sm:text-2xl">
                  {Array.from({ length: b }, (_, i) => (
                    <span key={i}>❄️</span>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      }
    }

    // Rapunzel Flower Measuring
    if (npcId === 'rapunzel' && round.visual?.kind === 'flowers') {
      const heights: number[] = round.visual.heights || [3, 5, 2];
      const colorKeys: string[] = round.visual.colors || ['pink', 'yellow', 'purple'];
      return (
        <div className="my-2 flex items-end justify-center gap-6 sm:gap-9 h-36 border-b-4 border-emerald-400 pb-1">
          {heights.map((h, i) => {
            const key = colorKeys[i] || 'pink';
            const cfg = FLOWER_HEX[key] || FLOWER_HEX.pink;
            return (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="w-9 h-9 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-base"
                  style={{ backgroundColor: cfg.bg }}
                  aria-label={`${cfg.label} flower, height ${h}`}
                >
                  🌸
                </div>
                <div
                  className="w-3 bg-emerald-600 rounded-t-xs"
                  style={{ height: `${h * 11}px` }}
                />
                <span className="text-xs font-black text-slate-800 mt-0.5">
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    // Rapunzel Petal Units Measuring (Tier 3)
    if (npcId === 'rapunzel' && round.visual?.kind === 'units') {
      const len = round.visual.length || 4;
      return (
        <div className="my-2 flex items-center justify-center gap-5 p-2 bg-emerald-50 rounded-2xl border-2 border-emerald-300">
          <div className="flex flex-col items-center">
            <span className="text-3xl leading-none">🌻</span>
            <div
              className="w-3 bg-emerald-600 rounded-b-sm"
              style={{ height: `${len * 18}px` }}
            />
          </div>
          <div className="flex flex-col-reverse items-center gap-0.5">
            {Array.from({ length: len }, (_, i) => (
              <div
                key={i}
                className="w-7 h-4 rounded-md bg-pink-200 border border-pink-400 flex items-center justify-center text-xs leading-none"
              >
                🌸
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  // Tap-to-blend letters (for Belle CVC phonics)
  const renderBlendLetters = () => {
    if (!round.tiles || round.tiles.length === 0) return null;
    const letters = round.tiles;

    const playSound = (l: string, idx: number) => {
      setActiveBlendLetter(idx);
      const s = tileSound(l);
      if (s) {
        if (s.tts) {
          Narrator.speakExact(npcId, s.tts, () => setActiveBlendLetter(null));
        } else {
          Narrator.playClip(s.url, () => setActiveBlendLetter(null), s.stopAt);
        }
      } else {
        Narrator.speakExact(npcId, l, () => setActiveBlendLetter(null));
      }
    };

    const blendAll = () => {
      let i = 0;
      const step = () => {
        if (i >= letters.length) {
          setActiveBlendLetter(null);
          Narrator.speakExact(npcId, letters.join(''));
          return;
        }
        playSound(letters[i], i);
        i++;
        setTimeout(step, 450);
      };
      step();
    };

    return (
      <div className="my-2 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          {letters.map((l, i) => (
            <button
              key={i}
              type="button"
              onClick={() => playSound(l, i)}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-4 font-black text-2xl sm:text-3xl flex items-center justify-center shadow-md active:scale-95 transition-all ${
                activeBlendLetter === i || highlightClue
                  ? 'bg-amber-300 text-amber-950 border-amber-500 shadow-lg'
                  : 'bg-white text-purple-950 border-purple-300 hover:border-purple-400'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={blendAll}
          className="px-4 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-sm active:scale-95 flex items-center gap-1.5"
        >
          <span>🔊</span>
          <span>Blend it!</span>
        </button>
      </div>
    );
  };

  // Interactive Tile Builder (Belle spelling / dictation)
  const renderTileBuilder = () => {
    const builder = round.spell || round.build;
    if (!builder) return null;
    const target: string[] =
      builder.target || (builder.word ? String(builder.word).split('') : []);
    const tiles: string[] = builder.tiles || [];
    if (target.length === 0) return null;

    const handleTileTap = (tile: string) => {
      if (disabled) return;
      const nextExpected = target[placedTiles.length];
      if (tile === nextExpected) {
        SoundFX.pop();
        const next = [...placedTiles, tile];
        setPlacedTiles(next);
        if (next.length === target.length) {
          triggerWin();
        }
      } else {
        SoundFX.pop();
        const nextWrong = tileWrongs + 1;
        setTileWrongs(nextWrong);
        onMiss(nextWrong);
        const isFirst = placedTiles.length === 0;
        const isLast = placedTiles.length === target.length - 1;
        let msg = round.hint || 'Good try! Which one comes next?';
        if (builder.hints?.first && isFirst) {
          msg = builder.hints.first;
        } else if (builder.hints?.last && isLast) {
          msg = builder.hints.last;
        } else if (nextWrong >= 2) {
          msg = `Look closely! The next tile is "${nextExpected}". Tap it to keep going! 💛`;
        }
        setFeedback({ type: 'wrong', message: msg });
        Narrator.speakExact(npcId, msg);
      }
    };

    const handleUndo = () => {
      if (placedTiles.length > 0) {
        setPlacedTiles(placedTiles.slice(0, -1));
      }
    };

    const handleClear = () => {
      setPlacedTiles([]);
    };

    return (
      <div className="my-2 flex flex-col items-center gap-2.5">
        {/* Target Slots */}
        <div className="flex flex-wrap items-center justify-center gap-2 p-2 bg-amber-50 rounded-2xl border-2 border-amber-300 min-h-[3.75rem] max-w-full">
          {target.map((_, i) => (
            <div
              key={i}
              className={`min-w-[44px] h-12 px-3 rounded-xl border-2 flex items-center justify-center font-black text-lg ${
                placedTiles[i]
                  ? 'bg-white border-amber-500 text-amber-950 shadow-xs'
                  : i === placedTiles.length
                  ? 'bg-amber-200/80 border-dashed border-amber-600 text-amber-900'
                  : 'bg-slate-100 border-dashed border-slate-400'
              }`}
            >
              {placedTiles[i] || ''}
            </div>
          ))}
        </div>

        {/* Tile Bank */}
        <div className="flex flex-wrap justify-center gap-2">
          {tiles.map((t, i) => {
            const timesPlaced = placedTiles.filter((p) => p === t).length;
            const timesInTiles = tiles.slice(0, i + 1).filter((x) => x === t).length;
            const isUsed = timesInTiles <= timesPlaced;
            return (
              <button
                key={i}
                type="button"
                disabled={isUsed || disabled}
                onClick={() => handleTileTap(t)}
                className={`min-w-[48px] min-h-[48px] px-4 py-2 rounded-xl border-2 font-black text-lg shadow-sm transition-all active:scale-95 ${
                  isUsed
                    ? 'opacity-30 bg-slate-200 border-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-white border-purple-400 text-purple-950 hover:border-purple-600 shadow-sm'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>

        {/* Undo / Clear controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleUndo}
            disabled={placedTiles.length === 0 || disabled}
            className="px-4 py-1.5 rounded-full bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-sm font-black text-slate-800 active:scale-95"
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={placedTiles.length === 0 || disabled}
            className="px-4 py-1.5 rounded-full bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-sm font-black text-slate-800 active:scale-95"
          >
            ✖ Clear
          </button>
        </div>
      </div>
    );
  };

  // Sorting Bins (Aurora naming/action AND Rapunzel living/not-living)
  const renderWordSort = () => {
    if (!round.sort) return null;
    const bins = round.choices || ['Naming', 'Action'];

    const handleSortItem = (itemIdx: number, bin: string) => {
      if (disabled) return;
      const item = sortedItems[itemIdx];
      const lowerBin = bin.toLowerCase();
      let isCorrectBin = false;
      if (typeof item.living === 'boolean') {
        const pickedNotLiving = lowerBin.includes('not');
        isCorrectBin = pickedNotLiving ? !item.living : item.living;
      } else {
        const pickedNaming = lowerBin.includes('nam');
        isCorrectBin = pickedNaming ? !!item.naming : !item.naming;
      }

      if (isCorrectBin) {
        SoundFX.pop();
        const updated = sortedItems.map((it, idx) =>
          idx === itemIdx ? { ...it, bin } : it
        );
        setSortedItems(updated);
        if (updated.every((it) => it.bin != null)) {
          triggerWin();
        }
      } else {
        SoundFX.pop();
        const nextWrong = misses + 1;
        setMisses(nextWrong);
        onMiss(nextWrong);
        const hintInfo = getEscalatingHint(round, nextWrong);
        setFeedback({ type: 'wrong', message: hintInfo.text });
        Narrator.speakExact(npcId, hintInfo.say);
      }
    };

    return (
      <div className="my-2 flex flex-col items-center gap-2">
        <div className="flex flex-wrap justify-center gap-2">
          {sortedItems.map((item, i) => (
            <div
              key={i}
              className={`px-3 py-2 rounded-xl border-2 font-black text-base flex items-center gap-2 ${
                item.bin
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                  : 'bg-white border-purple-300 text-purple-950 shadow-xs'
              }`}
            >
              <span>
                {item.pic ? `${item.pic} ` : ''}
                {item.name}
              </span>
              {!item.bin ? (
                <div className="flex gap-1.5">
                  {bins.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => handleSortItem(i, b)}
                      className="min-h-[38px] px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 border border-purple-300 text-sm font-extrabold text-purple-950 active:scale-95"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-sm font-bold text-emerald-800">✓ {item.bin}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const activeDotIdx = round.requeued
    ? Math.min(baseTotal - 1, completedBaseCount)
    : Math.min(baseTotal - 1, roundIdx);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center p-2.5 sm:p-4 pb-3 sm:pb-5 bg-slate-900/25 pointer-events-auto">
      <div
        className="w-full max-w-xl bg-[#fffdf7] rounded-[28px] border-4 border-[#ebd373] p-4 sm:p-5 shadow-2xl relative"
        role="dialog"
        aria-label={`${princess?.name || 'Princess'} quest question`}
      >
        {/* Top Header: Progress Dots (fixed 5) & Princess Kicker */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 shadow-sm shrink-0 bg-white"
              style={{ borderColor: princess?.color || '#ebd373' }}
            >
              <img
                src={princess?.portrait}
                alt={princess?.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-900 block truncate">
                {quest?.title}
              </span>
              <span className="text-sm font-bold text-slate-700 truncate block">
                {princess?.landName}
              </span>
            </div>
          </div>

          {/* Fixed 5 Progress Dots + Retry Badge */}
          <div className="flex items-center gap-2 shrink-0">
            {round.requeued && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-200 border border-amber-400 text-xs font-black text-amber-950">
                Try again 💛
              </span>
            )}
            <div
              className="flex items-center gap-1.5"
              aria-label={`Question ${Math.min(completedBaseCount + 1, baseTotal)} of ${baseTotal}`}
            >
              {Array.from({ length: baseTotal }, (_, i) => (
                <span
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-colors ${
                    i < completedBaseCount
                      ? 'bg-amber-500'
                      : i === activeDotIdx
                      ? 'bg-amber-400 ring-2 ring-amber-600'
                      : 'bg-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Question Prompt */}
        <div className="bg-white border-2 border-amber-300 rounded-2xl p-3 sm:p-3.5 mb-2 shadow-xs flex items-center justify-between gap-3">
          <p className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
            {round.prompt}
          </p>
          <button
            type="button"
            onClick={speakQuestion}
            className="min-w-[48px] min-h-[48px] rounded-full bg-amber-100 hover:bg-amber-200 border-2 border-amber-400 flex items-center justify-center text-xl shrink-0 active:scale-95 shadow-xs"
            aria-label="Read question again"
            title="Listen again"
          >
            🔊
          </button>
        </div>

        {/* Visible Blanked Word / Picture Clue + Specialized Visual Aids */}
        {renderShowAndClue()}
        {renderVisual()}
        {renderBlendLetters()}
        {renderTileBuilder()}
        {renderWordSort()}

        {/* Standard 3 Choice Cards (if not tile builder / sort) */}
        {!round.spell && !round.build && !round.sort && shuffledChoices.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mt-3">
            {shuffledChoices.map((choice, i) => {
              const isSelected = selectedChoice === choice;
              const isCorrect = choice === round.answer;
              const isDimmed = dimmedChoices.includes(choice);

              let btnStyle =
                'bg-white text-slate-900 border-amber-300 hover:border-amber-500 hover:bg-amber-50/40';

              if (feedback.type === 'correct' && isSelected) {
                btnStyle = 'bg-emerald-500 text-white border-emerald-700 shadow-lg';
              } else if (feedback.type === 'reveal' && isCorrect) {
                btnStyle = 'bg-emerald-500 text-white border-emerald-700 shadow-lg';
              } else if (isDimmed) {
                btnStyle =
                  'bg-slate-100 text-slate-400 border-slate-200 opacity-45 cursor-default';
              } else if (feedback.type === 'wrong' && isSelected) {
                btnStyle = 'bg-amber-100 text-amber-950 border-amber-500';
              }

              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled || isDimmed}
                  onClick={() => handleChoice(choice)}
                  aria-disabled={disabled || isDimmed}
                  className={`min-h-[64px] sm:min-h-[76px] p-3 rounded-2xl border-2 font-black text-lg sm:text-xl flex items-center justify-center text-center shadow-sm active:scale-95 transition-colors select-none ${btnStyle}`}
                >
                  <span className="leading-snug break-words">{choice}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Fixed-Height Reserved Hint / Feedback Slot (Zero Layout Shift!) */}
        <div
          aria-live="polite"
          className={`mt-3 h-20 sm:h-[84px] px-3.5 py-2 rounded-2xl border-2 flex items-center justify-center text-center font-extrabold text-base leading-snug transition-colors overflow-y-auto ${
            !feedback.message
              ? 'bg-transparent border-transparent text-transparent select-none'
              : feedback.type === 'correct'
              ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
              : feedback.type === 'reveal'
              ? 'bg-amber-100 border-amber-400 text-amber-950'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <span>{feedback.message || '\u00A0'}</span>
        </div>
      </div>
    </div>
  );
};
