/**
 * Capitalised words in a piece of text that the rest of the CV does not contain (skills, employers,
 * names). Same rule as backend/app/services/suggestion_guard.py: the first word of each sentence or
 * bullet is skipped, and a spelled-out acronym the CV uses is not new (house-style rule 9).
 * Contract: docs/API_CONTRACT.md, "Name check while typing the Professional Summary".
 */
const WORD = /[A-Za-z][A-Za-z0-9+#./&-]*/g;
const SENTENCE_BREAK = /[.!?;:\n•]+/;
const EXPANSION = /((?:[A-Za-z][A-Za-z-]*\s+){1,8}[A-Za-z][A-Za-z-]*)\s*\(([A-Za-z]{2,8})\)/g;
const ACRONYM_FIRST = /\b([A-Za-z]{2,8})\s*\(((?:[A-Za-z][A-Za-z-]*\s+){1,8}[A-Za-z][A-Za-z-]*)\)/g;

const words = (text: string): string[] => text.match(WORD) ?? [];

/** `known` is the CV without the field being checked; `text` is the field's text. */
export function unlistedNames(text: string, known: unknown): string[] {
  const knownWords = new Set(words(JSON.stringify(known ?? {}).toLowerCase()));
  const expansions = new Set<string>();
  for (const m of text.matchAll(EXPANSION)) {
    if (knownWords.has(m[2].toLowerCase())) words(m[1]).forEach((w) => expansions.add(w));
  }
  for (const m of text.matchAll(ACRONYM_FIRST)) {
    if (knownWords.has(m[1].toLowerCase())) words(m[2]).forEach((w) => expansions.add(w));
  }
  const unlisted: string[] = [];
  for (const segment of text.split(SENTENCE_BREAK)) {
    for (const word of words(segment).slice(1)) {
      if (/^[A-Z]/.test(word) && word.length > 1 && !knownWords.has(word.toLowerCase())
          && !expansions.has(word) && !unlisted.includes(word)) {
        unlisted.push(word);
      }
    }
  }
  return unlisted;
}
