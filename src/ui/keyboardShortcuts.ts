// Every editor keyboard shortcut, in one list: the ? cheat sheet shows it, and keyboardShortcuts.test.ts checks that the guide's
// Keyboard shortcuts tables (docs/HOW-TO.md) say the same thing, row for row, so neither goes stale.
// Each row: [what it does, the keys]. Written for both Mac and Windows, as in the guide.

export interface ShortcutGroup { title: string; rows: [string, string][] }

export const SHORTCUTS: ShortcutGroup[] = [
  { title: 'Tools', rows: [
    ['Select tool', 'V'],
    ['Add performer tool', 'A'],
    ['Text note tool', 'T'],
    ['Shape the selection (2 or more): Line, Arc, cUrve, Bézier, circle (O), Polygon, star (X), Spiral, blocK, Letters (W, for word)', 'L, R, U, B, O, P, X, S, K, W'],
    ['Close a menu; back to Select from any other tool; then clear the selection', 'Esc'],
  ] },
  { title: 'Selecting and moving', rows: [
    ['Select everyone', '⌘A (Ctrl+A on Windows)'],
    ['Lasso: select everyone inside an outline you draw', 'Option-drag (Alt-drag) on open field'],
    ['Move the selection 1 step', '← → ↑ ↓'],
    ['Move the selection 4 steps', 'Shift + arrow'],
    ['Move the selection half a step', 'Option (Alt) + arrow'],
    ['Move the picked prop 1, 4, or half a step', 'Arrow, Shift + arrow, Option (Alt) + arrow'],
    ["Copy or paste the selection's spots", '⌘C or ⌘V (Ctrl+C or Ctrl+V)'],
    ['Delete the selection (asks first)', 'Delete'],
  ] },
  { title: 'Shape handles, turns, and path points', rows: [
    ['With a shape open, or a follow-the-leader group or custom path selected: step through its handles, turns, or points', 'Tab, or Shift+Tab to go back'],
    ["Move the handle you're on 1, 4, or half a step", 'Arrow, Shift + arrow, Option (Alt) + arrow'],
    ['Keep the handle where it is, or put it back', 'Enter, or Esc'],
  ] },
  { title: 'Playing and the timeline', rows: [
    ['Play or pause', 'Space'],
    ['Back or forward one count (no one selected)', '← or →'],
    ['Move the playhead by keyboard', 'Tab to the timeline, then ← or → (Home and End for the start and end)'],
  ] },
  { title: 'The field', rows: [
    ['Zoom the field in or out', '⌘+ or ⌘− (Ctrl on Windows), with the mouse over the field'],
    ['Fit the whole field', 'F, or ⌘0 (Ctrl+0) with the mouse over the field'],
    ['Move around the field', 'Scroll, or right-drag'],
    ['Zoom', 'Pinch, or ⌘/Ctrl + scroll'],
  ] },
  { title: 'The show', rows: [
    ['Save', '⌘S (Ctrl+S on Windows)'],
    ['Undo', '⌘Z (Ctrl+Z on Windows)'],
    ['Redo', '⇧⌘Z (Ctrl+Y or Ctrl+Shift+Z on Windows)'],
    ['Show this list of shortcuts', '?'],
  ] },
];
