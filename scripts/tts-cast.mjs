/**
 * Zoe's Starlight Quest — Gemini TTS Voice Cast & Sample Script
 * Build-time configuration ONLY (never imported by client code).
 *
 * All 11 characters use distinct official prebuilt voices from
 * `gemini-2.5-flash-preview-tts` with original, warm, kid-friendly
 * style prompts paced slightly slower for a 6-year-old first grader.
 */

export const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

export const VOICE_CAST = {
  narrator: {
    label: 'Storybook Narrator',
    voiceName: 'Sulafat',
    presetTone: 'Warm (Middle)',
    stylePrompt:
      'Speak as a warm, playful, wonder-filled storybook narrator reading to a 6-year-old child. Keep a gentle smile in your voice, clear enunciation, cozy bedtime-adventure magic, and slightly slower pacing.',
  },
  belle: {
    label: 'Belle (Whispering Library)',
    voiceName: 'Erinome',
    presetTone: 'Clear (Middle)',
    stylePrompt:
      'Speak as a bright, bookish, kind young storyteller who adores books and gentle teaching. Clear articulation, warm curiosity, encouraging and patient, slightly slower for a 6-year-old.',
  },
  elsa: {
    label: 'Elsa (Frostfall Peaks)',
    voiceName: 'Despina',
    presetTone: 'Smooth (Middle)',
    stylePrompt:
      'Speak as a calm, regal, serene snow queen who is cool-toned yet deeply gentle, reassuring, and warm-hearted. Smooth, poised, unhurried, clear and kid-friendly for a 6-year-old.',
  },
  rapunzel: {
    label: 'Rapunzel (Sunflower Meadows)',
    voiceName: 'Laomedeia',
    presetTone: 'Upbeat (Higher)',
    stylePrompt:
      'Speak as an excited, energetic, sunny artist full of bubbly curiosity and cheerful wonder. Bright, expressive, joyful, yet clearly enunciated and paced gently for a 6-year-old.',
  },
  cinderella: {
    label: 'Cinderella (Glass Slipper Village)',
    voiceName: 'Vindemiatrix',
    presetTone: 'Gentle (Middle)',
    stylePrompt:
      'Speak as a kind, graceful, tender storybook friend with a soft musical warmth. Patient, sweet, reassuring, and clearly paced for a 6-year-old.',
  },
  ariel: {
    label: 'Ariel (Seashell Cove)',
    voiceName: 'Leda',
    presetTone: 'Youthful (Higher)',
    stylePrompt:
      'Speak as a bubbly, curious, playful ocean explorer sparkling with excitement and friendliness. Youthful, upbeat, clear, and slightly slower for a 6-year-old.',
  },
  moana: {
    label: 'Moana (Wayfinder Isle)',
    voiceName: 'Autonoe',
    presetTone: 'Bright (Middle)',
    stylePrompt:
      'Speak as a bright, brave, warm-hearted island wayfinder with encouraging energy and sunny confidence. Friendly, open, clear, and gently paced for a 6-year-old.',
  },
  jasmine: {
    label: 'Jasmine (Moonlit Palace Garden)',
    voiceName: 'Kore',
    presetTone: 'Firm (Middle)',
    stylePrompt:
      'Speak as a poised, warm, thoughtful storyteller under a starry sky. Confident, kind, quietly adventurous, clear and unhurried for a 6-year-old.',
  },
  anna: {
    label: 'Anna (Sunny Fjord Harbor)',
    voiceName: 'Zephyr',
    presetTone: 'Bright (Higher)',
    stylePrompt:
      'Speak as an enthusiastic, warm, friendly sister-like adventurer bursting with cheerful encouragement. Upbeat, affectionate, clear, and slightly slower for a 6-year-old.',
  },
  tiana: {
    label: 'Tiana (Firefly Bayou)',
    voiceName: 'Callirrhoe',
    presetTone: 'Easy-going (Middle)',
    stylePrompt:
      'Speak as a warm, cozy, joyful bayou friend with easy-going charm, steady encouragement, and a welcoming smile. Clear, friendly, and gently paced for a 6-year-old.',
  },
  aurora: {
    label: 'Aurora (Rosewood Glen)',
    voiceName: 'Achernar',
    presetTone: 'Soft (Higher)',
    stylePrompt:
      'Speak as a dreamy, soft-spoken, melodic forest fairytale friend with gentle wonder and sweetness. Calm, airy, crystal clear, and unhurried for a 6-year-old.',
  },
};

/**
 * Sample-only lines (Step 2): generated first into assets/audio/tts-sample/
 * so the user can audition the voices before generating the full script.
 */
export const SAMPLE_LINES = [
  {
    id: 'narrator_intro',
    character: 'narrator',
    kind: 'intro',
    text: 'Welcome to Starlight Quest! Walk to a princess and tap her or press E to say hello.',
  },
  {
    id: 'belle_greeting',
    character: 'belle',
    kind: 'greeting',
    text: 'Oh no! My storybook blew apart. The pages are hiding in the library. Will you help me find them?',
  },
  {
    id: 'belle_question_01',
    character: 'belle',
    kind: 'question',
    text: "Which word says 'again'?",
  },
  {
    id: 'belle_cheer_01',
    character: 'belle',
    kind: 'cheer',
    text: 'Wonderful! You did it! You earned a golden star!',
  },
];
