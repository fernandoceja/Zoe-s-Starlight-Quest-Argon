/* Zoe's Starlight Quest — audio systems
 * SoundFX: gentle WebAudio oscillator chimes (never harsh, no buzzers).
 * Narrator: keeps existing recorded MP3 clips and enhances speechSynthesis
 * with smart female voice ranking, per-princess storybook personalities,
 * natural sentence/comma phrasing, emoji/symbol stripping, and gesture gating.
 * ES module, 100% offline, zero network requests.
 */

import { PRINCESSES, NO_CLIP_IDS, NPC_ORDER } from './quests.js';

export let LANG = 'EN';
export function setLang(l) {
  LANG = (l === 'ES') ? 'ES' : 'EN';
}

export const VOICE_STORAGE_KEY = 'zsq_voice_pref_v1';
export const NARRATOR_VOICE = { rate: 0.92, pitch: 1.12 };

/* ------------------------------ SoundFX ------------------------------ */

let _ctx = null;

function _master(ctx) {
  const g = ctx.createGain();
  g.gain.value = 0.22; // keep everything soft for little ears
  g.connect(ctx.destination);
  return g;
}

/** Soft plink of a single note. freq in Hz, delay in seconds. */
function _plink(ctx, master, freq, delay = 0, dur = 0.45) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // Gentle bell-ish envelope: quick soft attack, long warm decay.
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.9, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
  // Add a whisper of a harmonic shimmer on top.
  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = freq * 2;
  g2.gain.setValueAtTime(0.0001, t0);
  g2.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.7);
  osc2.connect(g2);
  g2.connect(master);
  osc2.start(t0);
  osc2.stop(t0 + dur);
}

// C-major pentatonic neighborhood — always sweet, never dissonant.
const NOTES = {
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98
};

export const SoundFX = {
  /** Create/resume the AudioContext. Call on first user gesture (Start button). */
  ensure() {
    _markUserGesture();
    try {
      if (!_ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        _ctx = new AC();
      }
      if (_ctx.state === 'suspended') {
        _ctx.resume().catch(() => {});
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  _ready() {
    return this.ensure() && !!_ctx;
  },

  /** One soft chime. */
  chime() {
    if (!this._ready()) return;
    _plink(_ctx, _master(_ctx), NOTES.E5);
  },

  /** Little rising major arpeggio for big wins. */
  fanfare() {
    if (!this._ready()) return;
    const m = _master(_ctx);
    [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6].forEach((f, i) =>
      _plink(_ctx, m, f, i * 0.11, 0.6)
    );
  },

  /** Short friendly blip for taps / button presses. */
  pop() {
    if (!this._ready()) return;
    _plink(_ctx, _master(_ctx), NOTES.G5, 0, 0.22);
  },

  /** Twinkly sparkle sweep for star rewards. */
  sparkle() {
    if (!this._ready()) return;
    const m = _master(_ctx);
    [NOTES.E5, NOTES.G5, NOTES.A5, NOTES.C6, NOTES.E6].forEach((f, i) =>
      _plink(_ctx, m, f, i * 0.06, 0.5)
    );
  }
};

/* ------------------------------ Narrator ----------------------------- */

let _muted = false;
let _currentAudio = null;   // in-flight MP3 element
let _speaking = false;      // true while an MP3 or TTS utterance is playing
let _pauseTimer = null;     // inter-chunk breath timer
let _userInteracted = false; // prevents autoplay before a real tap/click/key

function _markUserGesture() {
  _userInteracted = true;
}

if (typeof window !== 'undefined') {
  const unlockOnce = () => {
    _userInteracted = true;
  };
  ['pointerdown', 'click', 'touchend', 'keydown'].forEach((evt) => {
    try {
      window.addEventListener(evt, unlockOnce, { capture: true, passive: true });
    } catch (e) {}
  });
}

function _clearPauseTimer() {
  if (_pauseTimer != null) {
    clearTimeout(_pauseTimer);
    _pauseTimer = null;
  }
}

function _stopTTS() {
  _clearPauseTimer();
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch (e) {}
}

function _stopMP3() {
  try {
    if (_currentAudio) {
      _currentAudio.onended = _currentAudio.onerror = null;
      _currentAudio.pause();
      _currentAudio = null;
    }
  } catch (e) {}
}

/* ------------------------ Voice Scoring & Ranking --------------------- */

const NOVELTY_RX = /\b(bells|bad news|good news|whisper|zarvox|albert|bahh|boing|bubbles|cellos|deranged|hysterical|jester|organ|superstar|trinoids|wobble|fred|junior|kathy|ralph|bruce|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|princess|agnes|vicki|pipe organ|eloquence|robot|monotone)\b/i;
const MALE_RX = /\b(alex|daniel|aaron|arthur|gordon|oliver|rishi|tom|lee|martin|david|mark|george|james|guy|christopher|eric|andrew|brian|steffan|ryan|diego|jorge|juan|carlos|enrique|alvaro|pablo|edward|evan|nathan|nick|male|hombre)\b/i;
const COMPACT_RX = /\b(compact|espeak|festival|mbrola|flite)\b/i;

const QUALITY_PATTERNS = [
  { rx: /\bpremium\b/i, bonus: 125 },
  { rx: /\benhanced\b/i, bonus: 112 },
  { rx: /\b(neural|natural)\b/i, bonus: 108 },
];

const EN_VOICE_SCORES = [
  { rx: /\bava\b/i, score: 78 },
  { rx: /microsoft\s+aria/i, score: 76 },
  { rx: /microsoft\s+jenny/i, score: 75 },
  { rx: /\bsamantha\b/i, score: 74 },
  { rx: /\ballison\b/i, score: 70 },
  { rx: /\bsusan\b/i, score: 68 },
  { rx: /\bkaren\b/i, score: 66 },
  { rx: /\bmoira\b/i, score: 64 },
  { rx: /\bzoe\b/i, score: 63 },
  { rx: /google us english/i, score: 62 },
  { rx: /google uk english female/i, score: 58 },
  { rx: /\bnicky\b/i, score: 56 },
  { rx: /\bstephanie\b/i, score: 55 },
  { rx: /\btessa\b/i, score: 54 },
  { rx: /\bserena\b/i, score: 53 },
  { rx: /\bkate\b/i, score: 52 },
  { rx: /\bfiona\b/i, score: 50 },
  { rx: /\bvictoria\b/i, score: 48 },
  { rx: /\bveena\b/i, score: 46 },
  { rx: /microsoft\s+(sonia|libby|michelle|emma|ana|clara|zira)/i, score: 48 },
  { rx: /\bfemale\b/i, score: 35 },
];

const ES_VOICE_SCORES = [
  { rx: /\bpaulina\b/i, score: 78 },
  { rx: /microsoft\s+dalia/i, score: 76 },
  { rx: /microsoft\s+elvira/i, score: 74 },
  { rx: /\bm[oó]nica\b/i, score: 72 },
  { rx: /google espa[nñ]ol/i, score: 68 },
  { rx: /\bsof[ií]a\b/i, score: 64 },
  { rx: /\bmarisol\b/i, score: 62 },
  { rx: /\bjimena\b/i, score: 60 },
  { rx: /\belena\b/i, score: 58 },
  { rx: /\bluc[ií]a\b/i, score: 56 },
  { rx: /\bsabina\b/i, score: 54 },
  { rx: /\bpaloma\b/i, score: 52 },
  { rx: /\b(female|mujer|ni[nñ]a)\b/i, score: 35 },
];

function _isNoveltyVoice(voice) {
  const name = String(voice?.name || '');
  const uri = String(voice?.voiceURI || '');
  return NOVELTY_RX.test(name) || /\beloquence\b/i.test(uri);
}

function _isExplicitCompactVoice(voice) {
  const name = String(voice?.name || '');
  return COMPACT_RX.test(name);
}

function _isCompactURI(voice) {
  const uri = String(voice?.voiceURI || '');
  return /\.compact\./i.test(uri) || COMPACT_RX.test(uri);
}

/** Score a single SpeechSynthesisVoice for warmth, naturalness, and language fit. */
export function scoreVoice(voice, langPrefix = 'en') {
  if (!voice || !voice.name) return -999;
  if (voice.localService === false) return -999;
  const name = String(voice.name);
  const uri = String(voice.voiceURI || '');
  const lang = String(voice.lang || '').toLowerCase();
  const isES = langPrefix === 'es';
  let score = 0;

  // Reject novelty / gag / eloquence voices and clearly male voices
  if (_isNoveltyVoice(voice)) score -= 500;
  if (MALE_RX.test(name)) score -= 220;
  if (_isExplicitCompactVoice(voice)) score -= 85;
  else if (_isCompactURI(voice)) score -= 18;

  // Language & locale clarity
  if (lang.startsWith(langPrefix)) {
    score += 20;
    if (!isES && (lang === 'en-us' || lang.startsWith('en-us'))) score += 12;
    else if (!isES && /^en-(gb|au|ie|ca)/.test(lang)) score += 6;
    else if (isES && /^es-(mx|us|419)/.test(lang)) score += 12;
    else if (isES && lang.startsWith('es-es')) score += 8;
  } else {
    score -= 120;
  }

  // Quality keywords (Premium / Enhanced / Natural / Neural) in name or voiceURI
  let bestQuality = 0;
  for (const q of QUALITY_PATTERNS) {
    if ((q.rx.test(name) || q.rx.test(uri)) && q.bonus > bestQuality) bestQuality = q.bonus;
  }
  score += bestQuality;

  // Known warm female voices
  const table = isES ? ES_VOICE_SCORES : EN_VOICE_SCORES;
  for (const entry of table) {
    if (entry.rx.test(name)) {
      score += entry.score;
      break;
    }
  }

  // Offline-ready local voice bonus
  if (voice.localService) score += 5;

  return score;
}

/**
 * Rank a list of SpeechSynthesisVoice objects best-first for the given language.
 * Strictly excludes voices where localService is false so every option works offline,
 * and filters out novelty / explicit Compact voices whenever better local voices exist.
 */
export function rankVoices(voices, langPrefix = 'en') {
  if (!Array.isArray(voices) || voices.length === 0) return [];
  const prefix = langPrefix === 'es' ? 'es' : 'en';

  // Strictly exclude network-only voices so every option works offline.
  const localOnly = voices.filter((v) => v && v.name && v.localService !== false);
  if (!localOnly.length) return [];

  const inLang = localOnly.filter((v) => String(v.lang || '').toLowerCase().startsWith(prefix));
  const langPool = inLang.length ? inLang : localOnly;

  // Exclude novelty/eloquence voices whenever any non-novelty local voice exists
  const nonNovelty = langPool.filter((v) => !_isNoveltyVoice(v));
  const cleanPool = nonNovelty.length ? nonNovelty : langPool;

  // Exclude explicit Compact-named voices whenever any non-Compact local voice exists
  const nonCompact = cleanPool.filter((v) => !_isExplicitCompactVoice(v));
  const pool = nonCompact.length ? nonCompact : cleanPool;

  return pool
    .map((voice, idx) => ({ voice, score: scoreVoice(voice, prefix), idx }))
    .sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
}

// Ranked voice cache per language; cleared whenever voiceschanged fires.
const _rankedCache = {};
const _voiceListeners = new Set();

function _invalidateVoices() {
  for (const k of Object.keys(_rankedCache)) delete _rankedCache[k];
  _voiceListeners.forEach((cb) => {
    try { cb(); } catch (e) {}
  });
}

function _initVoiceDiscovery() {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Trigger initial voice list population in Safari/Chrome
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', _invalidateVoices);
    }
  } catch (e) {}
}
_initVoiceDiscovery();

/** Subscribe to browser voice list changes (returns unsubscribe function). */
export function onVoicesChanged(cb) {
  if (typeof cb !== 'function') return () => {};
  _voiceListeners.add(cb);
  return () => _voiceListeners.delete(cb);
}

function _getRanked(langPrefix) {
  const prefix = langPrefix === 'es' ? 'es' : 'en';
  if (_rankedCache[prefix] && _rankedCache[prefix].length) return _rankedCache[prefix];
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) return [];
    const ranked = rankVoices(voices, prefix);
    if (ranked.length) _rankedCache[prefix] = ranked;
    return ranked;
  } catch (e) {
    return [];
  }
}

/** Read parent's saved preferred voiceURI from localStorage ('' = Auto). */
export function getSelectedVoiceURI() {
  try {
    return window.localStorage.getItem(VOICE_STORAGE_KEY) || '';
  } catch (e) {
    return '';
  }
}

/** Save parent's preferred voiceURI to localStorage ('' = Auto). */
export function setSelectedVoiceURI(uri) {
  const val = typeof uri === 'string' ? uri : '';
  try {
    if (val) window.localStorage.setItem(VOICE_STORAGE_KEY, val);
    else window.localStorage.removeItem(VOICE_STORAGE_KEY);
  } catch (e) {}
  _invalidateVoices();
}

/** Return the top N ranked offline voices formatted for the Parent Corner picker. */
export function getTopVoices(lang = LANG, limit = 5) {
  const prefix = lang === 'ES' ? 'es' : 'en';
  const ranked = _getRanked(prefix);
  const seen = new Set();
  const out = [];
  for (const item of ranked) {
    const v = item.voice;
    if (!v || v.localService === false) continue;
    const key = v.voiceURI || v.name;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const uri = String(v.voiceURI || '');
    let tag = '';
    if (/\bpremium\b/i.test(v.name) || /\bpremium\b/i.test(uri)) tag = 'Premium';
    else if (/\benhanced\b/i.test(v.name) || /\benhanced\b/i.test(uri)) tag = 'Enhanced';
    else if (/\b(neural|natural)\b/i.test(v.name) || /\b(neural|natural)\b/i.test(uri)) tag = 'Natural';
    out.push({
      name: v.name,
      lang: v.lang || '',
      voiceURI: v.voiceURI || v.name,
      score: item.score,
      localService: v.localService !== false,
      tag,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Pick the best offline voice for the current language and optional princessId.
 * - Excludes voices where localService is false.
 * - If a parent picked a specific offline voice in Parent Corner, always use it.
 * - Narrator (princessId == null) always gets the #1 highest-ranked local voice
 *   (never novelty/Compact).
 * - Princesses get subtle variety across top qualifying local voices when 2+ exist.
 */
export function pickVoiceFor(langPrefix = 'en', princessId = null, overrideURI = null) {
  const ranked = _getRanked(langPrefix);
  if (!ranked.length) return null;

  const wantedURI = overrideURI != null ? overrideURI : getSelectedVoiceURI();
  if (wantedURI) {
    const exact = ranked.find(
      (r) => r.voice.localService !== false && (r.voice.voiceURI === wantedURI || r.voice.name === wantedURI)
    );
    if (exact) return exact.voice;
    // Also check all local browser voices in case saved voice belongs to another locale
    try {
      const all = window.speechSynthesis.getVoices();
      const found = all.find(
        (v) => v && v.localService !== false && (v.voiceURI === wantedURI || v.name === wantedURI)
      );
      if (found) return found;
    } catch (e) {}
  }

  // Narrator always gets the #1 best-ranked local voice
  if (!princessId) {
    return ranked[0].voice;
  }

  // Princesses: subtle variety across top high-quality local voices when 2+ strong voices exist.
  const topScore = ranked[0].score;
  const goodVoices = ranked
    .filter((r) => r.score >= 70 && r.score >= topScore - 22)
    .map((r) => r.voice)
    .slice(0, 4);

  if (goodVoices.length >= 2) {
    const idx = NPC_ORDER.indexOf(princessId);
    if (idx >= 0) {
      return goodVoices[idx % goodVoices.length];
    }
  }
  return ranked[0].voice;
}

/** Report the exact offline voice object currently resolved for the Narrator. */
export function getNarratorVoice(lang = LANG) {
  const prefix = lang === 'ES' ? 'es' : 'en';
  const v = pickVoiceFor(prefix, null);
  if (!v) return null;
  return {
    name: v.name,
    lang: v.lang || '',
    voiceURI: v.voiceURI || v.name,
    localService: v.localService !== false,
  };
}

function _voiceParams(princessId) {
  const p = (typeof PRINCESSES !== 'undefined' && PRINCESSES && PRINCESSES[princessId]) || null;
  const v = (p && p.voice) || {};
  return {
    pitch: (typeof v.pitch === 'number') ? v.pitch : NARRATOR_VOICE.pitch,
    rate: (typeof v.rate === 'number') ? v.rate : NARRATOR_VOICE.rate,
    princessId: princessId || null,
  };
}

/* ------------------ Storybook Text Cleaning & Phrasing ---------------- */

const EMOJI_RX = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\u20E3]/gu;
const DECOR_SYMBOL_RX = /[◆◇➔➜➡⬅⬆⬇•·★☆♥❤♪♫✓✔✖✕↶↷▲▼◀▶✨⭐🌟💫👑📖👗💎🦋🧭]/gu;

/**
 * Clean UI text for warm spoken delivery:
 * - Strip emojis and decorative symbols.
 * - Turn blank tiles ("_", "_ _", standalone "?") into "blank" while preserving
 *   normal question marks at the end of questions.
 * - Read arithmetic operators cleanly ("7 + 5" -> "7 plus 5", "9 - 4" -> "9 minus 4").
 */
export function cleanTextForSpeech(raw) {
  let s = String(raw == null ? '' : raw);
  // Remove emojis and decorative UI symbols
  s = s.replace(EMOJI_RX, ' ');
  s = s.replace(DECOR_SYMBOL_RX, ' ');

  // Convert math expressions & "+3 stars" rewards before touching single symbols
  s = s.replace(/(\d|\?)\s*\+\s*(\d|\?)/g, '$1 plus $2');
  s = s.replace(/(^|[\s(])\+\s*(\d+)/g, '$1plus $2');
  s = s.replace(/(\d|\?)\s*[-−]\s*(\d|\?)/g, '$1 minus $2');
  s = s.replace(/\s*=\s*/g, ' equals ');

  // Convert blank underscore sequences ("_ _", "_", "___") into "blank"
  s = s.replace(/(?:^|[\s"'(])_(?:\s+_)*(?=$|[\s"'.,!?):;])/g, (m) => {
    const lead = /^[\s"'(]/.test(m) ? m[0] : '';
    return `${lead}blank`;
  });

  // Convert standalone "?" blank tokens (e.g., "? plus 3", "equals ?", "the ? circle")
  // WITHOUT touching sentence-ending question marks like "How many?"
  s = s.replace(/(^|[\s"'(])\?(?=\s+[a-zA-Z0-9])/g, '$1blank');
  s = s.replace(/\b(plus|minus|equals|yellow|the)\s+\?(?=$|[\s.,!])/gi, '$1 blank');
  if (s.trim() === '?') s = 'blank';

  // Turn em/en dashes into soft pauses and collapse letter-spacing hyphens gently
  s = s.replace(/[—–]/g, ', ');
  s = s.replace(/\s+-\s+/g, ', ');

  // Clean leftover stray quotes/brackets/whitespace
  s = s.replace(/\s+([.,!?])/g, '$1');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

/**
 * Split cleaned speech into short, storybook-paced chunks at sentence endings
 * and (for longer sentences) at commas, tagging exclamation lines for a warm
 * pitch lift and adding tiny natural breath pauses between chunks.
 */
export function splitSpeechChunks(text) {
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return [];

  // 1) Split into sentences keeping terminal punctuation
  const rawSentences = cleaned.match(/[^.!?]+[.!?]*\s*/g) || [cleaned];
  const chunks = [];

  for (const rawSent of rawSentences) {
    const sent = rawSent.trim();
    if (!sent) continue;
    const isExclaim = /!$/.test(sent);

    // If short/medium sentence, speak as one smooth chunk
    if (sent.length <= 68 || !/[,;:]/.test(sent)) {
      chunks.push({ text: sent, isExclaim, pauseAfterMs: 210 });
      continue;
    }

    // Split longer sentences gently at commas/semicolons into natural phrases
    const parts = sent.split(/(?<=[,;:])\s+/);
    let buf = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;
      if (buf && (buf.length + part.length + 1) > 68) {
        chunks.push({ text: buf, isExclaim: false, pauseAfterMs: 110 });
        buf = part;
      } else {
        buf = buf ? `${buf} ${part}` : part;
      }
    }
    if (buf) {
      chunks.push({ text: buf, isExclaim, pauseAfterMs: 210 });
    }
  }

  if (chunks.length > 0) {
    chunks[chunks.length - 1].pauseAfterMs = 0;
  }
  return chunks;
}

// Each new speak bumps _seq; an onDone callback only fires if nothing newer
// has started (so a cancelled line never triggers its follow-up).
let _seq = 0;
function _once(onDone) {
  const my = _seq;
  let fired = false;
  return () => {
    if (fired || my !== _seq || typeof onDone !== 'function') return;
    fired = true;
    onDone();
  };
}

function _speakTTS(
  text,
  { pitch = NARRATOR_VOICE.pitch, rate = NARRATOR_VOICE.rate, princessId = null, overrideURI = null, allowBeforeGesture = false } = {},
  onDone
) {
  if (_muted || !text) { if (onDone) onDone(); return; }
  if (!_userInteracted && !allowBeforeGesture) { if (onDone) onDone(); return; }

  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onDone) onDone();
      return;
    }
    const chunks = splitSpeechChunks(text);
    if (!chunks.length) {
      if (onDone) onDone();
      return;
    }

    _stopTTS();
    const mySeq = _seq;
    const langPrefix = LANG === 'ES' ? 'es' : 'en';
    const voice = pickVoiceFor(langPrefix, princessId, overrideURI);
    const baseRate = Math.max(0.82, Math.min(0.98, rate));
    const basePitch = Math.max(1.0, Math.min(1.32, pitch));

    let idx = 0;
    const speakNext = () => {
      if (_muted || mySeq !== _seq) {
        _speaking = false;
        return;
      }
      if (idx >= chunks.length) {
        _speaking = false;
        if (onDone) onDone();
        return;
      }
      const chunk = chunks[idx++];
      const u = new SpeechSynthesisUtterance(chunk.text);
      u.lang = (voice && voice.lang) ? voice.lang : (LANG === 'ES' ? 'es-US' : 'en-US');
      u.rate = chunk.isExclaim ? Math.min(0.96, baseRate + 0.02) : baseRate;
      u.pitch = chunk.isExclaim ? Math.min(1.36, basePitch + 0.06) : basePitch;
      u.volume = 1;
      if (voice) u.voice = voice;

      _speaking = true;
      let finished = false;
      const onChunkDone = () => {
        if (finished) return;
        finished = true;
        if (_muted || mySeq !== _seq) {
          _speaking = false;
          return;
        }
        if (idx >= chunks.length) {
          _speaking = false;
          if (onDone) onDone();
        } else if (chunk.pauseAfterMs > 0) {
          _clearPauseTimer();
          _pauseTimer = setTimeout(() => {
            _pauseTimer = null;
            speakNext();
          }, chunk.pauseAfterMs);
        } else {
          speakNext();
        }
      };

      u.onend = onChunkDone;
      u.onerror = onChunkDone;
      window.speechSynthesis.speak(u);
    };

    speakNext();
  } catch (e) {
    _speaking = false;
    if (onDone) onDone();
  }
}

/**
 * Speak one princess line. Keeps existing ElevenLabs MP3s first; on any load
 * error (missing file, 404, decode failure) falls back to warm speechSynthesis
 * with that princess's pitch/rate. Cancels anything in flight first.
 */
function _speakPrincess(princessId, kind, text, onDone) {
  _stopTTS();
  _stopMP3();
  _speaking = false;
  _seq++;
  const done = _once(onDone);
  if (_muted || !_userInteracted) { done(); return; }
  const textStr = String(text || '');

  // Princesses without recorded clips: no MP3 lookup, speak right away.
  if (NO_CLIP_IDS.includes(princessId)) {
    _speakTTS(textStr, _voiceParams(princessId), done);
    return;
  }

  // NOTE: when deployed as starlight-quest/ inside Zoe's Princess Academy repo,
  // the voice MP3s live in the repo-root assets/audio/ folder (shared with the Academy).
  const url = '/assets/audio/' + LANG + '/princess_' + princessId + '_' + kind + '_01.mp3';
  let mp3Ok = false;

  try {
    if (typeof Audio === 'undefined') {
      _speakTTS(textStr, _voiceParams(princessId), done);
      return;
    }
    const a = new Audio();
    _currentAudio = a;
    let fellBack = false;

    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      _stopMP3();
      _speakTTS(textStr, _voiceParams(princessId), done);
    };

    a.onerror = fallback;
    a.onstalled = () => setTimeout(() => { if (!mp3Ok) fallback(); }, 2500);
    a.onended = () => { if (!fellBack) { _speaking = false; _currentAudio = null; done(); } };
    a.oncanplaythrough = () => {
      mp3Ok = true;
      _speaking = true;
      a.play().catch(fallback);
    };
    setTimeout(() => { if (!mp3Ok && !fellBack) fallback(); }, 3000);
    a.src = url;
    a.load();
  } catch (e) {
    _speakTTS(textStr, _voiceParams(princessId), done);
  }
}

export const Narrator = {
  get muted() { return _muted; },

  /** Mark speech unlocked from an explicit user tap/click. */
  unlock() {
    _markUserGesture();
  },

  /** Mute or unmute narration. Muting also stops anything playing. */
  setMuted(m) {
    _muted = !!m;
    if (_muted) this.stop();
  },

  /** Stop any in-flight MP3, TTS utterance, or pending phrase pause. */
  stop() {
    _seq++;
    _stopTTS();
    _stopMP3();
    _speaking = false;
  },

  /**
   * Speak a princess line: speak(princessId, kind, text).
   * kind is 'greeting' | 'praise' | 'encourage'.
   */
  speak(princessId, kind, text, onDone) {
    _speakPrincess(princessId, kind, text, onDone);
  },

  /**
   * Speak a princess line as exact text via TTS with her storybook voice shaping,
   * skipping the MP3. Use for quest-specific lines (story, questions) where the
   * spoken words must match the on-screen text.
   */
  speakExact(princessId, text, onDone) {
    _stopTTS();
    _stopMP3();
    _speaking = false;
    _seq++;
    _speakTTS(text, _voiceParams(princessId), _once(onDone));
  },

  /**
   * Speak a gentle encouragement/hint line using the warm Narrator tone
   * (rate 0.92, pitch 1.12).
   */
  speakHint(text, onDone) {
    _stopTTS();
    _stopMP3();
    _speaking = false;
    _seq++;
    _speakTTS(text, { ...NARRATOR_VOICE, princessId: null }, _once(onDone));
  },

  /**
   * Play one recorded clip by URL, then call onDone. Respects mute and cancels
   * anything in flight.
   */
  playClip(url, onDone, stopAt) {
    _stopTTS();
    _stopMP3();
    _speaking = false;
    _seq++;
    const done = _once(onDone);
    if (_muted || !_userInteracted) { done(); return; }
    try {
      if (typeof Audio === 'undefined') { done(); return; }
      const a = new Audio();
      _currentAudio = a;
      let over = false;
      const finish = () => {
        if (over) return;
        over = true;
        if (stopAt) { try { a.pause(); } catch (e) {} }
        if (_currentAudio === a) { _stopMP3(); _speaking = false; }
        done();
      };
      a.onerror = finish;
      a.onended = finish;
      if (stopAt) {
        a.addEventListener('timeupdate', () => { if (a.currentTime >= stopAt) finish(); });
        a.addEventListener('playing', () => {
          const t0 = Date.now();
          const chk = () => {
            if (over) return;
            const left = stopAt - a.currentTime;
            if (left <= 0.01 || Date.now() - t0 > stopAt * 1000 + 400) finish();
            else setTimeout(chk, Math.max(10, left * 1000));
          };
          setTimeout(chk, stopAt * 1000 * 0.9);
        }, { once: true });
      }
      a.oncanplaythrough = () => {
        _speaking = true;
        const p = a.play();
        if (p && p.catch) p.catch(finish);
      };
      setTimeout(() => { if (!_speaking) finish(); }, 3000);
      a.src = url;
      a.load();
    } catch (e) { done(); }
  },

  /** Speak a non-princess narrator line with warm default shaping (rate 0.92, pitch 1.12). */
  speakText(text, { pitch = NARRATOR_VOICE.pitch, rate = NARRATOR_VOICE.rate } = {}, onDone) {
    _stopTTS();
    _stopMP3();
    _speaking = false;
    _seq++;
    _speakTTS(text, { pitch, rate, princessId: null }, _once(onDone));
  },

  /** Test a specific voice URI (or Auto best voice) from Parent Corner. */
  testVoice(voiceURI = '') {
    _markUserGesture();
    _stopTTS();
    _stopMP3();
    _speaking = false;
    _seq++;
    const sample =
      LANG === 'ES'
        ? '¡Hola Princesa Zoe! ¿Lista para una aventura mágica?'
        : 'Hello Princess Zoe! Ready for a magical storybook adventure?';
    const prevMuted = _muted;
    if (prevMuted) _muted = false;
    _speakTTS(
      sample,
      { ...NARRATOR_VOICE, princessId: null, overrideURI: voiceURI || '', allowBeforeGesture: true },
      () => { if (prevMuted) _muted = true; }
    );
  },
};

/* --------------------------- iOS audio care --------------------------- */

/** True when the browser lets us opt out of the silent switch. */
export function canBypassSilentSwitch() {
  try { return !!(navigator.audioSession && 'type' in navigator.audioSession); } catch (e) { return false; }
}

export function isIOS() {
  try {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  } catch (e) { return false; }
}

function _setPlaybackSession() {
  try { if (canBypassSilentSwitch()) navigator.audioSession.type = 'playback'; } catch (e) {}
}

function _resumeAll() {
  _markUserGesture();
  _setPlaybackSession();
  try { if (_ctx && _ctx.state !== 'running') _ctx.resume().catch(() => {}); } catch (e) {}
  try {
    if (_currentAudio && _currentAudio.paused && !_currentAudio.ended && _currentAudio.currentTime > 0) {
      _currentAudio.play().catch(() => {});
    }
  } catch (e) {}
  try { if ('speechSynthesis' in window && window.speechSynthesis.paused) window.speechSynthesis.resume(); } catch (e) {}
}

let _audioCareOn = false;
export function installAudioCare() {
  if (_audioCareOn || typeof window === 'undefined') return;
  _audioCareOn = true;
  _setPlaybackSession();
  const onGesture = () => _resumeAll();
  ['touchend', 'pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, onGesture, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) _resumeAll(); });
  window.addEventListener('pageshow', _resumeAll);
  window.addEventListener('focus', _resumeAll);
}
