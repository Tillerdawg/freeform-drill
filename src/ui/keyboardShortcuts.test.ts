import { expect, it } from 'vitest';
import { SHORTCUTS } from './keyboardShortcuts';
import { SHAPES } from './Toolbar';
import guide from '../../docs/HOW-TO.md?raw';

const section = guide.slice(guide.indexOf('## Keyboard shortcuts\n'), guide.indexOf('\n## ', guide.indexOf('## Keyboard shortcuts\n') + 5));

it('the guide lists the same shortcuts as the ? cheat sheet, in the same groups and order', () => {
  const titles = [...section.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  expect(titles).toEqual(SHORTCUTS.map((g) => g.title));
  const rows = section.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Do this |'))
    .map((l) => l.slice(2, -2).split(' | '));
  expect(rows).toEqual(SHORTCUTS.flatMap((g) => g.rows));
});

it("the shape row names every shape's key", () => {
  const row = SHORTCUTS.flatMap((g) => g.rows).find(([what]) => what.startsWith('Shape the selection'))!;
  expect(row[1]).toBe(SHAPES.map(([, , k]) => k).join(', '));
});
