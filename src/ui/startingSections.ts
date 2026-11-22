import { DEFAULT_SECTIONS, validSectionList, type SectionList, type Show } from '../engine/show';
import { sameList } from './SectionListEditor';

// A director's own starting section list, kept in this browser. New shows start with it instead of FreeFORM's.
const KEY = 'freeform:starting-sections';

export function startingSections(): SectionList {
  try { return validSectionList(JSON.parse(localStorage.getItem(KEY) ?? 'null')) ?? DEFAULT_SECTIONS; } catch { return DEFAULT_SECTIONS; }
}
export const hasOwnStartingSections = () => { try { return localStorage.getItem(KEY) !== null; } catch { return false; } };
/** Returns false if the browser won't store it. */
export function saveStartingSections(show: Show): boolean {
  return saveStartingList(show.sections.map(({ name, letter, color }) => ({ name, letter, ...(color ? { color } : {}) })));
}
/** Keep `list` for new shows; FreeFORM's own list is kept as no list at all. Returns false if the browser won't store it. */
export function saveStartingList(list: SectionList): boolean {
  if (sameList(list, DEFAULT_SECTIONS)) { clearStartingSections(); return true; }
  try { localStorage.setItem(KEY, JSON.stringify(list.map(({ name, letter, color }) => ({ name, letter, ...(color ? { color } : {}) })))); return true; } catch { return false; }
}
export function clearStartingSections() { try { localStorage.removeItem(KEY); } catch { /* nothing stored */ } }
