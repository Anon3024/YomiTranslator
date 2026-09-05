const SUBJECT = ["I", "you", "he", "she", "they", "we"];
const OBJECT = ["me", "you", "him", "her", "them", "us"];
const POSSESSIVE = ["my", "your", "his", "her", "their", "our"];
const POSSESSIVE_NOUN = ["mine", "yours", "his", "hers", "theirs", "ours"];

const CONTRACTIONS: Record<string, string[]> = {
  "i'm": ["I'm", "you're", "he's", "she's", "they're", "we're"],
  "you're": ["I'm", "you're", "he's", "she's", "they're", "we're"],
  "he's": ["I'm", "you're", "he's", "she's", "they're", "we're"],
  "she's": ["I'm", "you're", "he's", "she's", "they're", "we're"],
  "they're": ["I'm", "you're", "he's", "she's", "they're", "we're"],
  "we're": ["I'm", "you're", "he's", "she's", "they're", "we're"],
  "i'll": ["I'll", "you'll", "he'll", "she'll", "they'll", "we'll"],
  "you'll": ["I'll", "you'll", "he'll", "she'll", "they'll", "we'll"],
  "he'll": ["I'll", "you'll", "he'll", "she'll", "they'll", "we'll"],
  "she'll": ["I'll", "you'll", "he'll", "she'll", "they'll", "we'll"],
  "they'll": ["I'll", "you'll", "he'll", "she'll", "they'll", "we'll"],
  "we'll": ["I'll", "you'll", "he'll", "she'll", "they'll", "we'll"],
};

const SETS = [SUBJECT, OBJECT, POSSESSIVE, POSSESSIVE_NOUN];

function keyOf(word: string) {
  return word.trim().toLowerCase().replace(/’/g, "'");
}

export function isPronoun(word: string) {
  const key = keyOf(word);
  if (!key) return false;
  if (CONTRACTIONS[key]) return true;
  return SETS.some((set) => set.some((p) => p.toLowerCase() === key));
}

/** Other pronouns in the same grammatical slot, excluding the clicked word. */
export function pronounAlternatives(word: string): string[] {
  const key = keyOf(word);
  if (!key) return [];
  const contraction = CONTRACTIONS[key];
  if (contraction) {
    return contraction.filter((p) => p.toLowerCase() !== key);
  }
  for (const set of SETS) {
    if (set.some((p) => p.toLowerCase() === key)) {
      return set.filter((p) => p.toLowerCase() !== key);
    }
  }
  return [];
}

export function looksJapanese(text: string) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

/**
 * Pronoun-only English swaps (he → she, you → I) stay on this line.
 * Short Japanese person terms (奴, お前, a name) may still be remembered.
 * A whole-line source (来るな) is not a person term.
 */
export function shouldRememberAlt(
  from: string,
  to: string,
  japanese = "",
) {
  const source = from.trim();
  const next = to.trim();
  const line = japanese.trim();
  if (!source || !next || source === next) return false;
  if (isPronoun(next)) {
    if (!looksJapanese(source)) return false;
    if (line && source === line) return false;
  }
  if (isPronoun(source) && isPronoun(next)) return false;
  return true;
}
