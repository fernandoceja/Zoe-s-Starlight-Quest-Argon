import React, { useState, useEffect, useRef } from 'react';
import { createWorld } from './game/world.js';
import {
  PRINCESSES,
  NPC_ORDER,
  QUESTS,
  buildRounds,
  setSchoolWords,
  setWeek,
} from './game/quests.js';
import { SoundFX, Narrator, setLang, installAudioCare } from './game/audio.js';
import { Save, checkMilestones } from './game/save.js';
import {
  todayKey,
  collectTreasure,
  rolloverTreasures,
  treasuresGotToday,
  landTreasureCount,
  TREASURES_PER_LAND,
  findsTotal,
  findsToday,
  TREASURE_LAND_NAMES,
  awardRowStar,
  ALL_SECRETS,
  foundSecret,
  createSecretTracker,
  clockLine,
  doublesLine,
  rhymeLine,
  shapeLine,
  storyLine,
  sentenceLine,
  tallyLine,
  wordLine,
  plantLine,
  spellLine,
} from './game/treasures.js';
import { Input } from './game/input.js';
import { builtSlotIds, shouldRunFinale, openLandIds } from './game/worldmap.js';
import { landState, recordQuest, today, pickTodayStar } from './game/ladder.js';

import { HUD } from './components/HUD';
import { TitleModal } from './components/TitleModal';
import { TutorialModal } from './components/TutorialModal';
import { DialogueModal } from './components/DialogueModal';
import { ChallengeModal } from './components/ChallengeModal';
import { CelebrationModal } from './components/CelebrationModal';
import { PauseMenu } from './components/PauseMenu';
import { WardrobeModal } from './components/WardrobeModal';
import { TreasureBookModal } from './components/TreasureBookModal';
import { ParentCorner } from './components/ParentCorner';
import { VirtualJoystick } from './components/VirtualJoystick';
import { PrincessId, Round } from './types';

const NPC_IDS = NPC_ORDER as PrincessId[];
const NPC_TO_LAND: Record<string, string> = {
  belle: 'library',
  elsa: 'frostfall',
  rapunzel: 'meadow',
  cinderella: 'village',
  ariel: 'cove',
  moana: 'isle',
  jasmine: 'garden',
  anna: 'harbor',
  tiana: 'bayou',
  aurora: 'glen',
};

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<any>(null);

  // Core Game State
  const [gameState, setGameState] = useState<
    | 'title'
    | 'tutorial'
    | 'roam'
    | 'dialogue'
    | 'challenge'
    | 'celebrate'
    | 'finale'
  >('title');

  const [paused, setPaused] = useState(false);
  const [pauseTab, setPauseTab] = useState<
    'menu' | 'wardrobe' | 'treasurebook' | 'tutorial' | 'parent'
  >('menu');

  const [activeNPC, setActiveNPC] = useState<PrincessId | null>(null);
  const [nearNPC, setNearNPC] = useState<PrincessId | null>(null);
  const [nextNPC, setNextNPC] = useState<PrincessId | null>('belle');
  const [interactPrompt, setInteractPrompt] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [todayStar, setTodayStar] = useState<PrincessId | undefined>(undefined);

  // Quest State
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundIdx, setRoundIdx] = useState(0);
  const [baseTotal, setBaseTotal] = useState(5);
  const [completedBaseCount, setCompletedBaseCount] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [requeued, setRequeued] = useState(0);
  const [celebrationData, setCelebrationData] = useState<{
    title: string;
    sub: string;
    isFinale?: boolean;
    afterAction: () => void;
  } | null>(null);

  // Progress State
  const [stars, setStars] = useState(0);
  const [doneLands, setDoneLands] = useState<string[]>([]);
  const [treasuresToday, setTreasuresToday] = useState(0);
  const [treasuresTotal, setTreasuresTotal] = useState(50);
  const [unlockedMilestones, setUnlockedMilestones] = useState<string[]>([]);
  const [currentOutfit, setCurrentOutfit] = useState<any>({});
  const [foundSecrets, setFoundSecrets] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [ladderState, setLadderState] = useState<Record<string, any>>({});
  const [schoolWords, setSchoolWordsState] = useState<string[]>([]);

  // Secret tracker ref
  const secretTrackerRef = useRef(createSecretTracker());

  // Latest state refs for global keyboard & world callbacks (never stale!)
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const pauseTabRef = useRef(pauseTab);
  pauseTabRef.current = pauseTab;
  const activeNPCRef = useRef(activeNPC);
  activeNPCRef.current = activeNPC;
  const pauseActionStampRef = useRef(0);

  const isPausableState = (s: typeof gameState) =>
    s === 'roam' ||
    s === 'dialogue' ||
    s === 'challenge' ||
    s === 'celebrate' ||
    s === 'finale';

  const showToast = (msg: string, duration = 3000) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, duration);
  };

  // 1. Initialize Game & 3D World
  useEffect(() => {
    Save.load();
    const day = todayKey();
    rolloverTreasures(Save.data, day);
    setSchoolWords(Save.data.schoolWords);
    setWeek(Save.data.week);
    setLang(Save.data.lang === 'ES' ? 'ES' : 'EN');
    Narrator.setMuted(!!Save.data.muted);
    installAudioCare();

    // Sync state from Save
    setStars(Save.data.stars || 0);
    setDoneLands(Save.data.done || []);
    setUnlockedMilestones(Save.data.milestones || []);
    setCurrentOutfit(Save.data.outfit || {});
    setFoundSecrets(Save.data.secrets || []);
    setMuted(!!Save.data.muted);
    setLadderState(Save.data.ladder || {});
    setSchoolWordsState(Save.data.schoolWords || []);

    const openLands = openLandIds();
    setTreasuresToday(findsToday(Save.data, day, openLands));
    setTreasuresTotal(findsTotal(openLands));

    try {
      const star = pickTodayStar(Save.data, today());
      setTodayStar(star as PrincessId);
    } catch (e) {}

    // Init Input and 3D Canvas
    Input.init();

    const buildInteractPrompt = (npcId: string | null) => {
      if (!npcId || !PRINCESSES[npcId]) return null;
      const name = PRINCESSES[npcId].name;
      if ((Save.data.done || []).includes(npcId)) {
        return `✨ ${name} is happy! Play again?`;
      }
      return `💬 Tap ${name} to talk ✨`;
    };

    if (containerRef.current) {
      const world = createWorld(containerRef.current, {
        onNearNPC(npcId: string) {
          const validId = npcId && PRINCESSES[npcId] ? (npcId as PrincessId) : null;
          setNearNPC(validId);
          setInteractPrompt(buildInteractPrompt(validId));
        },
        onInteractRequest(npcId: string) {
          if (!npcId || !QUESTS[npcId]) return;
          handleStartQuest(npcId as PrincessId);
        },
        onPauseRequest() {
          // Guard against double-toggle when React's keydown already handled P/Esc
          if (Date.now() - pauseActionStampRef.current < 160) return;
          handleTogglePauseRef.current();
        },
        onWorldTap() {
          SoundFX.chime();
        },
        onGateTap() {
          SoundFX.chime();
          showToast('A new kingdom will open here soon! ✨');
        },
        onSecretTap(part: string) {
          const id = secretTrackerRef.current.tap(part, Date.now());
          if (id) revealSecret(id);
        },
        treasuresGot() {
          return treasuresGotToday(Save.data, todayKey());
        },
        onTreasure(kind: string, landId: string, id: string) {
          const dayKey = todayKey();
          if (!collectTreasure(Save.data, id, kind, dayKey)) return;
          Save.save();
          SoundFX.chime();
          showToast(
            `You found a ${kind}! ${landTreasureCount(Save.data, landId, dayKey)} of ${TREASURES_PER_LAND} in this land today ✨`
          );

          if (awardRowStar(Save.data, landId, dayKey)) {
            Save.data.stars += 1;
            Save.save();
            setStars(Save.data.stars);
            showToast(`All ${TREASURES_PER_LAND} treasures in ${TREASURE_LAND_NAMES[landId]}! +1 ⭐`);
          }

          const openL = openLandIds();
          setTreasuresToday(findsToday(Save.data, dayKey, openL));
        },
      });

      worldRef.current = world;
      world.setInputEnabled(false);

      // Restore world saved state
      for (const id of Save.data.done || []) {
        if (NPC_IDS.includes(id as PrincessId)) {
          world.setNPCState(id, 'done');
        }
      }
      world.setCastleCrown(
        shouldRunFinale(Save.data.done, NPC_IDS, builtSlotIds().length)
      );
      world.setOutfit(Save.data.outfit);

      const initialNext =
        (world.getNearestUnvisited(Save.data.done || []) as PrincessId | null) ||
        NPC_IDS.find((id) => !(Save.data.done || []).includes(id)) ||
        null;
      setNextNPC(initialNext);
      world.setGuideTarget(initialNext);
    }

    return () => {
      if (worldRef.current) {
        worldRef.current.dispose();
      }
    };
  }, []);

  // Helper to update next-princess guidance (HUD + 3D golden arrow)
  const refreshGuidance = (doneList: string[]) => {
    const next =
      (worldRef.current?.getNearestUnvisited?.(doneList) as PrincessId | null) ||
      NPC_IDS.find((id) => !doneList.includes(id)) ||
      null;
    setNextNPC(next);
    if (worldRef.current?.setGuideTarget) {
      worldRef.current.setGuideTarget(next);
    }
  };

  // Reveal secrets & sticker rewards
  const revealSecret = (id: string) => {
    const def = ALL_SECRETS.find((x: any) => x.id === id);
    if (!def) return;
    let line: string;
    if (id === 'clock') {
      const c = clockLine();
      if (worldRef.current) worldRef.current.setClockTime(c.h, c.m);
      line = c.say;
    } else if (id === 'icetwins') line = doublesLine().say;
    else if (id === 'shellrhyme') line = rhymeLine().say;
    else if (id === 'shapestones') line = shapeLine().say;
    else if (id === 'storylanterns') line = storyLine().say;
    else if (id === 'sentenceflags') line = sentenceLine().say;
    else if (id === 'tallymarks') line = tallyLine().say;
    else if (id === 'wordgarden') line = wordLine().say;
    else if (id === 'bookstack') {
      const sp = spellLine(Save.data.week?.spelling);
      line = sp.say;
    } else line = plantLine().say;

    SoundFX.chime();
    Narrator.speakExact(def.npc, line);
    showToast(`${def.emoji} ${line}`);

    if (foundSecret(Save.data, id)) {
      Save.save();
      setFoundSecrets([...Save.data.secrets]);
      setTimeout(() => {
        showToast(`New sticker: ${def.label}! ${def.emoji}`);
      }, 1400);
    }
  };

  // Toggle Mute
  const handleToggleMute = () => {
    SoundFX.pop();
    const newMuted = !muted;
    Narrator.setMuted(newMuted);
    Save.data.muted = newMuted;
    Save.save();
    setMuted(newMuted);
  };

  // Pause Anywhere (works during roam, dialogue, challenge, celebrate, finale)
  const handlePause = () => {
    const curState = gameStateRef.current;
    if (!isPausableState(curState) || pausedRef.current) return;
    pauseActionStampRef.current = Date.now();
    Input.consumePause();
    Narrator.stop();
    setPaused(true);
    setPauseTab('menu');
    if (worldRef.current) {
      worldRef.current.setInputEnabled(false);
      worldRef.current.pause();
    }
  };

  // Resume returns Zoe to the exact state/question/line/celebration she was in
  const handleResume = () => {
    if (!pausedRef.current) return;
    pauseActionStampRef.current = Date.now();
    Input.consumePause();
    Input.clearInteract(250);
    setPaused(false);
    setPauseTab('menu');
    if (worldRef.current) {
      worldRef.current.resume();
      worldRef.current.setInputEnabled(gameStateRef.current === 'roam');
    }
  };

  const handleTogglePause = () => {
    if (pausedRef.current) {
      handleResume();
    } else {
      handlePause();
    }
  };

  // Leave a Princess Anytime (zero penalty, keeps all earned stars, steps Zoe safely away)
  const handleLeavePrincess = () => {
    const npcId = activeNPCRef.current;
    if (!npcId) return;
    const P = PRINCESSES[npcId];

    Narrator.stop();
    SoundFX.pop();
    setPaused(false);
    setPauseTab('menu');

    // Reset only the unfinished round; all earned stars are already saved!
    setRounds([]);
    setRoundIdx(0);
    setResults([]);
    setRequeued(0);
    setCompletedBaseCount(0);
    setActiveNPC(null);
    setNearNPC(null);
    setInteractPrompt(null);
    setGameState('roam');
    refreshGuidance(Save.data.done || []);

    if (worldRef.current) {
      worldRef.current.unfocus();
      worldRef.current.stepAwayFromNPC(npcId);
      worldRef.current.setInputEnabled(true);
      worldRef.current.resume();
    }

    if (P) {
      showToast(`💖 ${P.name}: "Come back anytime!"`, 3200);
      Narrator.speakExact(npcId, 'Come back anytime, Princess Zoe!');
    }
  };

  const handleTogglePauseRef = useRef(handleTogglePause);
  handleTogglePauseRef.current = handleTogglePause;
  const handleLeavePrincessRef = useRef(handleLeavePrincess);
  handleLeavePrincessRef.current = handleLeavePrincess;

  // Global Keyboard Shortcuts: Esc/P pause anywhere, Esc also closes dialogue
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Escape') {
        if (pausedRef.current) {
          pauseActionStampRef.current = Date.now();
          Input.consumePause();
          if (pauseTabRef.current !== 'menu') {
            setPauseTab('menu');
          } else {
            handleTogglePauseRef.current();
          }
          return;
        }
        if (gameStateRef.current === 'dialogue') {
          pauseActionStampRef.current = Date.now();
          Input.consumePause();
          handleLeavePrincessRef.current();
          return;
        }
        if (isPausableState(gameStateRef.current)) {
          handleTogglePauseRef.current();
        }
        return;
      }

      if (e.code === 'KeyP') {
        if (pausedRef.current || isPausableState(gameStateRef.current)) {
          handleTogglePauseRef.current();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Start Adventure from Title
  const handleStartTitle = () => {
    Narrator.unlock();
    SoundFX.ensure();
    SoundFX.chime();
    Save.data.started = true;
    Save.save();

    let seen = false;
    try {
      seen = !!window.localStorage.getItem('zsq_tutorial_seen_v1');
    } catch (e) {}

    if (seen) {
      enterWorld();
    } else {
      setGameState('tutorial');
    }
  };

  const enterWorld = () => {
    setGameState('roam');
    if (worldRef.current) {
      worldRef.current.setInputEnabled(true);
      worldRef.current.resume();
    }
    showToast('Walk to a princess and say hello! 👑');
    Narrator.speakText(
      'Welcome to Starlight Quest! Walk to a princess and tap her or press E to say hello.'
    );
  };

  // Start Quest with NPC
  const handleStartQuest = (npcId: PrincessId) => {
    setActiveNPC(npcId);
    setRoundIdx(0);
    setResults([]);
    setRequeued(0);
    setCompletedBaseCount(0);

    const built = buildRounds(npcId, Math.random, landState(Save.data.ladder[npcId]));
    setRounds(built);
    setBaseTotal(built.length || 5);

    if (worldRef.current) {
      worldRef.current.setInputEnabled(false);
      worldRef.current.focus(npcId);
    }
    setGameState('dialogue');
  };

  // Progress from Dialogue to Challenge rounds
  const handleDialogueDone = () => {
    setGameState('challenge');
  };

  // Correct Answer in Challenge
  const handleRoundCorrect = () => {
    const curRound = rounds[roundIdx];
    // Add star
    Save.data.stars += 1;
    if (activeNPC && !Save.data.done.includes(activeNPC)) {
      Save.data.shards[activeNPC] = (Save.data.shards[activeNPC] || 0) + 1;
    }
    Save.save();
    setStars(Save.data.stars);

    if (curRound && !curRound.requeued) {
      setCompletedBaseCount((c) => Math.min(baseTotal, c + 1));
    }

    // Bookkeeping
    const nextRoundIdx = roundIdx + 1;
    if (nextRoundIdx >= rounds.length) {
      completeQuest();
    } else {
      setRoundIdx(nextRoundIdx);
    }
  };

  // Missed round handling — re-queue with at least 2 other questions in between (never back-to-back)
  const handleRoundMiss = (missCount: number) => {
    const curRound = rounds[roundIdx];
    if (curRound && !curRound.requeued && missCount === 1) {
      if (results.length < baseTotal) {
        setResults((prev) => [...prev, { round: curRound, firstTry: false, hinted: true }]);
      }
      const remainingAfter = rounds.length - 1 - roundIdx;
      if (requeued < 2 && remainingAfter >= 2) {
        setRequeued((r) => r + 1);
        const copy = [...rounds];
        const insertAt = Math.min(copy.length, roundIdx + 3);
        copy.splice(insertAt, 0, { ...curRound, requeued: true });
        setRounds(copy);
      }
    }
  };

  // Complete Quest for active NPC
  const completeQuest = () => {
    if (!activeNPC) return;
    const npcId = activeNPC;
    const P = PRINCESSES[npcId];

    // Ladder bookkeeping
    Save.data.ladder[npcId] = recordQuest(landState(Save.data.ladder[npcId]), results);
    Save.data.lastPlay[npcId] = today();
    setLadderState({ ...Save.data.ladder });

    const isFirstTime = !Save.data.done.includes(npcId);
    if (isFirstTime) {
      Save.data.done.push(npcId);
      Save.data.stars += 3; // +3 bonus stars for first-time land star shard
      setDoneLands([...Save.data.done]);
    } else {
      Save.data.stars += 1; // +1 bonus star for practicing again
    }
    Save.save();
    setStars(Save.data.stars);

    if (worldRef.current) {
      worldRef.current.setNPCState(npcId, 'done');
      worldRef.current.celebrate(NPC_TO_LAND[npcId]);
    }

    // Check star milestones
    const freshMilestones = checkMilestones(Save.data);
    if (freshMilestones.length > 0) {
      Save.save();
      setUnlockedMilestones([...Save.data.milestones]);
    }

    // Update guidance to point toward the nearest unvisited princess
    refreshGuidance(Save.data.done);

    // Trigger Land Celebration (distinct reward copy on first completion vs repeat practice)
    setCelebrationData({
      title: isFirstTime ? `${P.name}'s land is glowing!` : `${P.name} is smiling! 🌟`,
      sub: isFirstTime
        ? `You earned the ${P.landName} star shard! ⭐ +3 stars`
        : `Bonus stars! +1 ⭐ for practicing in ${P.landName}!`,
      afterAction: () => {
        const allDone = isFirstTime && shouldRunFinale(Save.data.done, NPC_IDS, builtSlotIds().length);
        if (allDone) {
          triggerFinale();
        } else {
          returnToRoam(npcId);
        }
      },
    });
    setGameState('celebrate');
  };

  // Trigger Grand Finale
  const triggerFinale = () => {
    if (worldRef.current) {
      worldRef.current.setCastleCrown(true);
      NPC_IDS.forEach((id, i) =>
        setTimeout(() => worldRef.current?.celebrate(NPC_TO_LAND[id]), i * 150)
      );
    }

    setCelebrationData({
      title: 'The Starlight Crown is Restored! 👑',
      sub: 'All ten lands are glowing together across the kingdom! You did it, Princess Zoe!',
      isFinale: true,
      afterAction: () => {
        returnToRoam();
      },
    });
    setGameState('finale');
  };

  const returnToRoam = (finishedNpcId?: PrincessId) => {
    setActiveNPC(null);
    setGameState('roam');
    setCelebrationData(null);
    refreshGuidance(Save.data.done || []);
    // Update the talk prompt immediately if Zoe is still standing next to the finished princess
    if (finishedNpcId && nearNPC === finishedNpcId && PRINCESSES[finishedNpcId]) {
      setInteractPrompt(`✨ ${PRINCESSES[finishedNpcId].name} is happy! Play again?`);
    }
    if (worldRef.current) {
      worldRef.current.setInputEnabled(true);
      worldRef.current.unfocus();
      worldRef.current.resume();
    }
  };

  // Wardrobe Outfit Changed
  const handleSelectOutfit = (newOutfit: any) => {
    Save.data.outfit = newOutfit;
    Save.save();
    setCurrentOutfit(newOutfit);
    if (worldRef.current) {
      worldRef.current.setOutfit(newOutfit);
    }
  };

  // Save Custom Words (Parent Corner)
  const handleSaveCustomWords = (words: string[]) => {
    Save.data.schoolWords = words;
    Save.save();
    setSchoolWords(words);
    setSchoolWordsState(words);
  };

  const currentRound = rounds[roundIdx];

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#1a1033] font-['Nunito',sans-serif]">
      {/* 3D Three.js Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Floating HUD */}
      {gameState === 'roam' && !paused && (
        <>
          <HUD
            stars={stars}
            doneCount={doneLands.length}
            totalLands={NPC_ORDER.length}
            treasuresToday={treasuresToday}
            treasuresTotal={treasuresTotal}
            activeNPC={activeNPC}
            questStep={
              activeNPC ? { current: roundIdx + 1, total: rounds.length } : undefined
            }
            interactPrompt={interactPrompt}
            nextNPC={nextNPC}
            muted={muted}
            onToggleMute={handleToggleMute}
            onPause={handlePause}
            hidePauseButton={true}
            onInteract={() => {
              if (nearNPC) handleStartQuest(nearNPC);
            }}
            todayStarNPC={todayStar}
          />
          <VirtualJoystick />
        </>
      )}

      {/* Always-Visible Big Pause Button (>= 56px, Top-Right Corner) across roam, dialogue, quests, celebrations */}
      {!paused && isPausableState(gameState) && (
        <button
          type="button"
          onClick={handlePause}
          className="fixed top-2 right-2 sm:top-3 sm:right-3 z-[45] min-w-[56px] min-h-[56px] w-14 h-14 rounded-full bg-white/95 hover:bg-amber-50 border-3 border-[#ebd373] shadow-lg ring-2 ring-purple-900/15 flex items-center justify-center text-2xl font-black text-purple-950 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
          aria-label="Pause Menu"
          title="Pause (P or Esc)"
        >
          ⏸️
        </button>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-amber-400 text-amber-950 font-black text-base px-5 py-2.5 rounded-full border-2 border-white shadow-lg">
            {toastMsg}
          </div>
        </div>
      )}

      {/* Title Modal */}
      {gameState === 'title' && (
        <TitleModal
          onStart={handleStartTitle}
          hasSeenTutorial={true}
          onOpenTutorial={() => {
            Narrator.unlock();
            SoundFX.ensure();
            setGameState('tutorial');
          }}
        />
      )}

      {/* Tutorial Modal */}
      {gameState === 'tutorial' && (
        <TutorialModal
          onComplete={() => {
            try {
              window.localStorage.setItem('zsq_tutorial_seen_v1', '1');
            } catch (e) {}
            enterWorld();
          }}
        />
      )}

      {/* Dialogue Modal (kept mounted while paused so Resume returns to exact line) */}
      {gameState === 'dialogue' && activeNPC && (
        <DialogueModal
          npcId={activeNPC}
          lines={
            doneLands.includes(activeNPC)
              ? [
                  `Welcome back, Princess Zoe! My land is glowing because of you! 💖 Let's play another round of fun questions!`,
                ]
              : QUESTS[activeNPC]?.intro || ['Hello Princess Zoe! Will you help me?']
          }
          onDone={handleDialogueDone}
          onLeave={handleLeavePrincess}
          paused={paused}
          actionLabel="Start Quest! ⭐"
        />
      )}

      {/* Challenge Modal (kept mounted while paused so Resume returns to exact question & progress) */}
      {gameState === 'challenge' && activeNPC && currentRound && (
        <ChallengeModal
          npcId={activeNPC}
          round={currentRound}
          roundIdx={roundIdx}
          totalRounds={rounds.length}
          baseTotal={baseTotal}
          completedBaseCount={completedBaseCount}
          paused={paused}
          onCorrect={handleRoundCorrect}
          onMiss={handleRoundMiss}
          onLeave={handleLeavePrincess}
        />
      )}

      {/* Celebration & Finale Modal (kept mounted while paused so Resume returns cleanly) */}
      {(gameState === 'celebrate' || gameState === 'finale') && celebrationData && (
        <CelebrationModal
          title={celebrationData.title}
          sub={celebrationData.sub}
          isFinale={celebrationData.isFinale}
          paused={paused}
          onContinue={celebrationData.afterAction}
        />
      )}

      {/* Pause Menu & Secondary Modals */}
      {paused && (
        <>
          {pauseTab === 'menu' && (
            <PauseMenu
              onResume={handleResume}
              onOpenWardrobe={() => setPauseTab('wardrobe')}
              onOpenTreasureBook={() => setPauseTab('treasurebook')}
              onOpenTutorial={() => setPauseTab('tutorial')}
              onOpenParentCorner={() => setPauseTab('parent')}
            />
          )}

          {pauseTab === 'wardrobe' && (
            <WardrobeModal
              stars={stars}
              unlockedMilestones={unlockedMilestones}
              currentOutfit={currentOutfit}
              onSelectOutfit={handleSelectOutfit}
              onBack={() => setPauseTab('menu')}
            />
          )}

          {pauseTab === 'treasurebook' && (
            <TreasureBookModal
              foundSecrets={foundSecrets}
              treasuresToday={treasuresToday}
              treasuresTotal={treasuresTotal}
              onBack={() => setPauseTab('menu')}
              onResumeGame={handleResume}
            />
          )}

          {pauseTab === 'tutorial' && (
            <TutorialModal onComplete={() => setPauseTab('menu')} />
          )}

          {pauseTab === 'parent' && (
            <ParentCorner
              stars={stars}
              doneLands={doneLands}
              ladderState={ladderState}
              schoolWords={schoolWords}
              onSaveWords={handleSaveCustomWords}
              onBack={() => setPauseTab('menu')}
            />
          )}
        </>
      )}
    </div>
  );
};

export default App;
