// "Is my work safe?" in one place: the save status at the bottom of the sidebar and the panel it opens. Three layers, each said in words
// (never color alone): this browser's autosave, a .freeform file, and the phones.

export interface SaveState {
  /** This browser's autosave worked on the last change. */
  browserOk: boolean;
  /** When the show first changed after it was last saved to a file (or opened from one); null if no changes since. */
  unexported: number | null;
  /** When the show was last saved to a file from here, if ever. */
  fileSavedAt: number | null;
  /** The last revision sent out (published, or a locked file downloaded to post), if any. Phones that haven't been online since may have an older one. */
  revision?: number;
  /** The drill changed after that revision went out (revisionLabel's "+ changes"). */
  changedSincePublish: boolean;
  /** "2:14 PM" today, "Nov 5" before. */
  when: (ms: number) => string;
}

export interface SaveStatus {
  /** Its three parts, joined with " · " (the sidebar shows a line each), like "Browser ✓ · File: 2:14 PM · Phones: rev 6". */
  label: string;
  /** True when something isn't saved somewhere it could be (the box gets an outline as well as its words). */
  attention: boolean;
  /** A word or two for the top bar, next to the show's name: the most urgent thing, or "Saved". The menu has the rest. */
  short: string;
  browser: string;
  file: string;
  phones: string;
}

export function saveStatus(s: SaveState): SaveStatus {
  const file = s.unexported ? 'unsaved changes' : s.fileSavedAt ? s.when(s.fileSavedAt) : 'no changes';
  const phones = s.revision ? `rev ${s.revision}${s.changedSincePublish ? ' + changes' : ''}` : 'not published';
  return {
    label: `${s.browserOk ? 'Browser ✓' : 'Browser: not saved'} · File: ${file} · Phones: ${phones}`,
    attention: !s.browserOk || !!s.unexported || s.changedSincePublish,
    short: !s.browserOk ? '⚠ Not saved' : s.unexported ? 'Unsaved changes' : s.changedSincePublish ? 'Phones behind' : '✓ Saved',
    browser: s.browserOk
      ? 'Saved in this browser as you work. It stays here until this browser\'s data is cleared, and only this computer has it.'
      : "This browser couldn't save your last changes (its storage may be full or turned off). Save a file now so you don't lose them.",
    file: s.unexported
      ? `Changes since ${s.fileSavedAt ? `you last saved a file (${s.when(s.fileSavedAt)})` : `${s.when(s.unexported)}, not saved to a file yet`}. Save a file to keep a copy off this browser.`
      : s.fileSavedAt ? `Saved to a file at ${s.when(s.fileSavedAt)}, with no changes since.` : 'No changes to save to a file.',
    phones: !s.revision
      ? 'Not published to phones yet. Share sends it to your performers.'
      : s.changedSincePublish
        ? `Revision ${s.revision} is the last one you sent out, and you've changed the drill since. Publish again to send the changes.`
        : `Revision ${s.revision} is the last one you sent out (published, or downloaded for you to post), and it's the drill as it is now. Each phone shows which revision it has: one that hasn't been online since may still have an older one.`,
  };
}
