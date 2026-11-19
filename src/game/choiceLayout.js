/* Zoe's Starlight Quest — responsive answer-card layout & per-choice audio rules.
 * Pure, dependency-free helper so every princess's question types can be verified
 * at desktop/tablet (1024x768) and narrow phone (360-390px) widths.
 */

const EMOJI_RX = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\u20E3]/gu;

/** Strip emojis to measure visible text length cleanly. */
export function stripEmojiText(str) {
  return String(str == null ? '' : str)
    .replace(EMOJI_RX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when a choice string includes leading/embedded emoji art. */
export function choiceHasArt(str) {
  EMOJI_RX.lastIndex = 0;
  return EMOJI_RX.test(String(str == null ? '' : str));
}

/**
 * Determine whether each choice card should show a per-choice speaker button.
 * - Belle's reading/decoding choices (sight words, CVC, digraphs, blends, dictation)
 *   intentionally omit per-choice read-aloud so hearing a card doesn't give away
 *   which written word says the target word.
 * - Rounds with `noChoiceSay: true` (e.g. Anna's capitalization comparison where all
 *   three choices sound identical, or Ariel's single-letter blanks) also omit it.
 * - All other princesses (Rapunzel, Cinderella, Elsa, Ariel rhymes/pairs, Moana,
 *   Jasmine, Anna punctuation/word, Tiana, Aurora) keep per-choice audio buttons.
 */
export function shouldShowChoiceAudio(npcId, round) {
  if (!round || round.sort || round.spell || round.build) return false;
  if (round.noChoiceSay) return false;
  if (npcId === 'belle') return false;
  return Array.isArray(round.choices) && round.choices.length > 0;
}

/** Spoken text for a single choice button (respects round.choiceSay if provided). */
export function spokenChoiceText(round, choice) {
  if (round && round.choiceSay && round.choiceSay[choice]) {
    return round.choiceSay[choice];
  }
  return stripEmojiText(choice) || String(choice || '');
}

/**
 * Estimate horizontal pixel width needed for one choice card to keep its text
 * comfortably on a single horizontal line (art + text + optional speaker button + padding).
 */
export function estimateChoiceWidthPx(choice, hasChoiceAudio) {
  const hasArt = choiceHasArt(choice);
  const text = stripEmojiText(choice);
  const paddingPx = 28; // horizontal padding + border
  const artPx = hasArt ? 32 : 0; // emoji glyph + gap
  const speakerPx = hasChoiceAudio ? 56 : 0; // 44px button + 12px gap
  // Bold 18-20px Nunito averages ~11.5px/char; give a small safety buffer
  const textPx = text.length > 0 ? Math.ceil(text.length * 11.5) + 12 : 24;
  return paddingPx + artPx + speakerPx + textPx;
}

/**
 * Pick column counts for narrow phones (~340px inner card width) and
 * tablet/desktop (>=640px, e.g. 1024x768 with ~620px inner card width)
 * from the actual space each choice needs.
 *
 * Returns { mobileCols: 1|2|3, desktopCols: 1|2|3, gridClass: string, isRowLayout: boolean }.
 */
export function getChoiceGridConfig(choices, hasChoiceAudio) {
  const list = Array.isArray(choices) ? choices : [];
  const count = list.length;
  if (count === 0) {
    return { mobileCols: 1, desktopCols: 1, gridClass: 'grid-cols-1', isRowLayout: true };
  }

  const maxNeeded = Math.max(...list.map((c) => estimateChoiceWidthPx(c, hasChoiceAudio)));

  // Desktop/tablet modal (max-w-2xl = 672px, inner width ~620px, gap 12px):
  //   3 cols => ~198px per card
  //   2 cols => ~304px per card
  //   1 col  => ~620px per card (full-width rows)
  let desktopCols = 1;
  if (count === 2) {
    desktopCols = maxNeeded <= 290 ? 2 : 1;
  } else if (count >= 3) {
    // Only use 3 columns when every choice fits comfortably on one horizontal line.
    // Otherwise use full-width rows (1 column) rather than awkward 2+1 orphan rows.
    desktopCols = maxNeeded <= 190 ? 3 : 1;
  }

  // Narrow phone (360-390px viewport, inner width ~316px, gap 10px):
  //   3 cols => ~98px per card
  //   2 cols => ~153px per card
  //   1 col  => ~316px per card (full-width rows)
  let mobileCols = 1;
  if (count === 2) {
    mobileCols = maxNeeded <= 145 ? 2 : 1;
  } else if (count >= 3) {
    mobileCols = maxNeeded <= 96 ? 3 : 1;
  }

  // Never allow more columns on mobile than desktop
  if (mobileCols > desktopCols) mobileCols = desktopCols;

  const mobileClass =
    mobileCols === 3 ? 'grid-cols-3' : mobileCols === 2 ? 'grid-cols-2' : 'grid-cols-1';
  const desktopClass =
    desktopCols === 3 ? 'sm:grid-cols-3' : desktopCols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1';

  return {
    mobileCols,
    desktopCols,
    gridClass: `${mobileClass} ${desktopClass}`,
    isRowLayout: desktopCols === 1,
    maxNeededPx: maxNeeded,
  };
}
