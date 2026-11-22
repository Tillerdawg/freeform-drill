// Retakes every screenshot in the docs (docs/img/) from the sample show in src/engine/sample.ts (the warnings: its practice show).
// Run after a UI change the screenshots show:  node scripts/screenshots.mjs [name...]
// Needs Playwright's Chromium once:  npm i --no-save playwright && npx playwright install chromium
import { createServer } from 'vite';
import { createRequire } from 'node:module';

const { chromium, devices } = createRequire(import.meta.url)('playwright'); // require: also finds a global install

const OUT = new URL('../docs/img/', import.meta.url).pathname;
const only = process.argv.slice(2);
const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const URL_ = 'http://localhost:5199/app/'; // the editor; the front page is at /
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {}); // CHROME: use an installed Chrome instead

/** A fresh editor (1440 × 900, at 2× for sharp images) with the sample show loaded (`practice`: the practice show, for the warnings). */
async function editor({ practice = false, ...opts } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark', ...opts }); // dark: the app follows the device's setting
  const page = await ctx.newPage();
  await page.goto(URL_);
  await page.evaluate(async (practice) => {
    const { sampleShow, practiceShow } = await import('/src/engine/sample.ts');
    localStorage.clear();
    localStorage.setItem('freeform:autosave', JSON.stringify(practice ? practiceShow() : sampleShow()));
  }, practice);
  await page.reload();
  await page.waitForSelector('canvas');
  await page.waitForTimeout(500);
  return page;
}
/** Screen (CSS px) spot of a field point, from the editor's starting zoom (the field fitted to the canvas). */
const spot = (page, p) => page.evaluate(async (p) => {
  const { fitView, toScreen } = await import('/src/field/drawField.ts');
  const c = document.querySelector('canvas'), r = c.getBoundingClientRect(), d = devicePixelRatio;
  const s = toScreen(fitView(c.width, c.height), p);
  return { x: r.left + s.x / d, y: r.top + s.y / d };
}, p);
const goSet = (page, n) => page.getByRole('button', { name: `Go to set ${n}`, exact: true }).click();
/** Drag a box from field point a to b (selects what's inside). */
async function box(page, a, b) {
  const p = await spot(page, a), q = await spot(page, b);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(q.x, q.y, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(150);
}
/** Clip around field points (steps), padded in CSS px. */
async function fieldClip(page, a, b, pad = 30) {
  const p = await spot(page, a), q = await spot(page, b);
  return { x: Math.min(p.x, q.x) - pad, y: Math.min(p.y, q.y) - pad, width: Math.abs(q.x - p.x) + 2 * pad, height: Math.abs(q.y - p.y) + 2 * pad };
}
const shots = {};
const shot = (name, f) => { shots[name] = f; };
const save = (page, name, clip) => page.screenshot({ path: `${OUT}${name}.png`, ...(clip ? { clip } : {}) });

const menu = (page, name) => page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click().then(() => page.waitForTimeout(200));
const W = 1440, H = 900;
const sidebar = { x: 1095, y: 125, width: W - 1095, height: 600 };
/** Clip around an element, padded. */
const showMenu = (page) => page.getByRole('button', { name: /^Show: / }).first().click().then(() => page.waitForTimeout(250));
/** Clip around a menu's button and its open panel together. */
const withPanel = async (page, button, pad = 12) => {
  const a = await button.boundingBox(), b = await page.locator('.tb-menu-panel').boundingBox();
  const x = Math.min(a.x, b.x) - pad, y = Math.min(a.y, b.y) - pad;
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) + pad - x, height: Math.max(a.y + a.height, b.y + b.height) + pad - y };
};
const around = async (loc, pad = 16) => { const b = await loc.boundingBox(); return { x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad }; };
/** From an element's top down to the bottom of the window, in the sidebar. */
const fromHere = async (loc) => { // down to the save status pinned at the sidebar's bottom (it's pictured on its own)
  await loc.evaluate((h) => { // first scroll the sidebar so this heading is near its top, leaving the most room under it
    let el = h.parentElement;
    while (el && !(el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== 'visible')) el = el.parentElement;
    el?.scrollBy(0, h.getBoundingClientRect().top - el.getBoundingClientRect().top - 24);
  });
  await loc.page().waitForTimeout(200);
  const b = await loc.boundingBox(); // the sidebar runs to the bottom of the window (the save status is in the top bar now)
  return { ...sidebar, y: b.y - 12, height: H - b.y + 12 };
};
const bottom = { x: 0, y: 700, width: W, height: H - 700 };

shot('editor', async () => {
  const page = await editor();
  await goSet(page, 2);
  await save(page, 'editor');
});
shot('white-field', async () => {
  // Layout → White field, set 2 with part of the arc selected.
  const page = await editor();
  await page.getByRole('button', { name: /^Layout/ }).click();
  await page.getByRole('button', { name: 'White field' }).click();
  await goSet(page, 2);
  await box(page, { x: -24, y: 40 }, { x: -2, y: 22 });
  await page.waitForTimeout(300);
  await save(page, 'white-field', { x: 0, y: 125, width: 1095, height: 620 });
});
shot('add-performers', async () => {
  const page = await editor();
  await page.getByRole('button', { name: /^Add.*: choose$/ }).click(); await page.waitForTimeout(200); // the Add button's ▾ part
  await save(page, 'add-performers', { x: 0, y: 0, width: 720, height: 560 });
});
shot('select-frame', async () => {
  const page = await editor();
  await goSet(page, 2);
  await box(page, { x: -26, y: 47 }, { x: 26, y: 24 });
  await save(page, 'select-frame', await fieldClip(page, { x: -32, y: 54 }, { x: 32, y: 18 }));
});
shot('shape-arc', async () => {
  const page = await editor();
  await box(page, { x: -13, y: 51 }, { x: 13, y: 29 });
  await menu(page, 'Shape');
  await page.getByRole('radio', { name: 'Arc' }).click();
  await page.waitForTimeout(200);
  await save(page, 'shape-arc', { x: 240, y: 110, width: 660, height: 450 });
});
shot('shape-bezier', async () => {
  const page = await editor({ ...devices['iPad Pro 11 landscape'] });
  await box(page, { x: -42, y: 50 }, { x: -10, y: 28 });
  await menu(page, 'Shape');
  await page.getByRole('radio', { name: 'Bézier' }).tap();
  await page.getByRole('button', { name: '+ Segment', exact: true }).tap();
  await page.getByRole('button', { name: 'Independent handles' }).tap();
  await page.waitForTimeout(350);
  await save(page, 'shape-bezier');
});
shot('shape-spiral', async () => {
  const page = await editor();
  await box(page, { x: -13, y: 51 }, { x: 13, y: 29 });
  await page.keyboard.press('s'); // the Spiral shortcut
  await menu(page, 'Shape');
  await page.waitForTimeout(200);
  await save(page, 'shape-spiral', { x: 240, y: 110, width: 700, height: 640 });
});
shot('shape-star', async () => {
  const page = await editor();
  await box(page, { x: -13, y: 51 }, { x: 13, y: 29 });
  await page.keyboard.press('x'); // the Star shortcut
  await page.mouse.move(1000, 600); await page.mouse.wheel(0, -260); // pan down so the top point's handles clear the panel
  await menu(page, 'Shape');
  await page.waitForTimeout(200);
  await save(page, 'shape-star', { x: 240, y: 110, width: 700, height: 640 });
});
shot('start', async () => {
  // A blank show: the note that offers a first step.
  const page = await editor();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);
  await save(page, 'start', await around(page.locator('.getting-started')));
});
shot('section-counts', async () => {
  // A blank show's Enter section counts: how many in each section, with each letter and name there to change. Clarinet
  // is being given C, which Cymbals has, so the rule shows: a letter belongs to one section.
  const page = await editor();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Enter section counts/ }).click(); await page.waitForTimeout(300);
  const d = page.getByRole('dialog', { name: 'Enter section counts' });
  for (const [name, n] of [['Flute', 4], ['Clarinet', 6], ['Alto Saxophone', 3], ['Trumpet', 8]]) await d.getByLabel(`How many in ${name}`).fill(String(n));
  await d.getByLabel('Letter for Clarinet').fill('C');
  await page.waitForTimeout(200);
  await save(page, 'section-counts', await around(d.locator('form'), 12));
});
shot('new-show', async () => {
  // New: the title and the surface come first. A custom floor, so its size shows too.
  const page = await editor();
  await showMenu(page); await page.getByRole('button', { name: 'New show…' }).click(); await page.waitForTimeout(300);
  await page.getByLabel('New show title').fill('Winter Guard 2027');
  await page.getByRole('dialog').getByRole('combobox', { name: 'Field' }).selectOption('floor');
  await page.waitForTimeout(200);
  await save(page, 'new-show', await around(page.locator('[role=dialog] > form'), 12));
});
shot('getting-started', async () => {
  // A blank show, the checklist turned on, four performers placed, and a second set added: two steps in.
  const page = await editor();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);
  await menu(page, 'Help'); await page.getByRole('button', { name: 'Getting started checklist' }).click();
  await page.getByRole('button', { name: 'Or place them one at a time' }).click();
  for (const x of [-6, -2, 2, 6]) { const q = await spot(page, { x, y: 30 }); await page.mouse.click(q.x, q.y); await page.waitForTimeout(80); }
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /: choose$/ }).first().click(); await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Set', exact: true }).click();
  await page.waitForTimeout(400);
  await save(page, 'getting-started', await around(page.locator('.getting-started'), 12));
});
shot('save-status', async () => {
  // Published as revision 6, then edited: the save status beside the show's name says what isn't saved; the show menu, opened.
  const page = await editor();
  await page.evaluate(async () => {
    const { sampleShow } = await import('/src/engine/sample.ts');
    const { nextRevision, placeInSet } = await import('/src/engine/show.ts');
    let s = sampleShow(); for (let k = 0; k < 6; k++) s = nextRevision(s);
    const id = s.performers[0].id, q = s.sets[1].pos[id];
    localStorage.setItem('freeform:autosave', JSON.stringify(placeInSet(s, 1, { [id]: { x: q.x + 1, y: q.y } })));
  });
  await page.reload();
  await page.waitForTimeout(500);
  await showMenu(page);
  const clip = await withPanel(page, page.locator('.save-short').locator('..'));
  await save(page, 'save-status', clip);
});
shot('send-band', async () => {
  // Help, then Send it to your band, on the sample (Review clean), after opening Share: the message step.
  const page = await editor();
  await page.getByRole('button', { name: /^Help/ }).click(); await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Send it to your band' }).click(); await page.waitForTimeout(300);
  await page.locator('.getting-started button', { hasText: 'Open Share' }).click(); await page.waitForTimeout(500);
  await page.locator('[role=dialog] button', { hasText: 'Close' }).last().click(); await page.waitForTimeout(400);
  await save(page, 'send-band', await around(page.locator('.getting-started'), 12));
});
shot('recover', async () => {
  const page = await editor();
  await page.getByRole('button', { name: /^Help/ }).click(); await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Get a show back' }).click(); await page.waitForTimeout(300);
  await save(page, 'recover', await around(page.locator('[role=dialog] > div').first()));
});
shot('shortcuts', async () => {
  // The ? cheat sheet: every keyboard shortcut on one page.
  const page = await editor();
  await page.mouse.move(700, 400);
  await page.keyboard.press('Shift+Slash'); await page.waitForTimeout(300);
  await save(page, 'shortcuts', await around(page.locator('[role=dialog] > div').first()));
});
shot('shows', async () => {
  // The show library with three shows, as a director might keep them.
  const page = await editor();
  await page.evaluate(async () => {
    const { keepShow } = await import('/src/ui/showStore.ts');
    const { sampleShow } = await import('/src/engine/sample.ts');
    const { newShowId } = await import('/src/engine/show.ts');
    const { BACKUP_AGE, DAY, unexportedKey, writeTime } = await import('/src/ui/backupReminder.ts');
    const t = Date.now();
    await keepShow({ ...sampleShow(), id: newShowId(), title: 'Ballad' }, t - 86_400_000);
    const closer = { ...sampleShow(), id: newShowId(), title: 'Closer' };
    await keepShow(closer, t - BACKUP_AGE - DAY);
    writeTime(unexportedKey(closer.id), t - BACKUP_AGE - DAY);
  });
  await showMenu(page); await page.getByRole('button', { name: 'Show settings…' }).click();
  await page.getByLabel('Show title').fill('Opener');
  await page.getByRole('button', { name: 'Done' }).click();
  await showMenu(page); await page.getByRole('button', { name: 'My shows…' }).click();
  await page.getByText('Backup due', { exact: true }).waitFor();
  await page.waitForTimeout(400);
  await save(page, 'shows', await around(page.locator('[role=dialog] > div').first()));
});
shot('version-preview', async () => {
  const page = await editor();
  await page.evaluate(async () => {
    const { addVersion, AUTOSAVE } = await import('/src/ui/showStore.ts');
    const show = JSON.parse(localStorage.getItem(AUTOSAVE));
    await addVersion(show, Date.now() - 15 * 60_000);
  });
  await showMenu(page); await page.getByRole('button', { name: 'My shows…' }).click();
  await page.getByRole('button', { name: /^Versions of/ }).click();
  await page.getByRole('button', { name: /^Preview version saved/ }).first().click();
  const preview = page.getByRole('dialog', { name: 'Preview earlier version' });
  await preview.getByRole('button', { name: 'Next set' }).click();
  await preview.getByRole('img', { name: 'Field preview of Set 2' }).waitFor();
  await save(page, 'version-preview', await around(preview.locator(':scope > div')));
});
shot('too-close', async () => {
  // The practice show: two trumpets in the arc swap spots into set 3 and cut past F1; then the timeline's warning is clicked.
  const page = await editor({ practice: true });
  await page.getByRole('button', { name: /too close/ }).first().click();
  await page.waitForTimeout(300);
  await save(page, 'too-close', { x: 0, y: 40, width: 1110, height: H - 40 });
});
shot('coordinates', async () => {
  const page = await editor();
  await goSet(page, 2);
  const g = await spot(page, { x: -20, y: 14 });
  await page.mouse.click(g.x, g.y);
  await page.waitForTimeout(200);
  await page.getByText('All sets').first().evaluate((b) => { // scroll the sidebar until the readout clears the save-status panel pinned at its bottom
    let el = b.parentElement;
    while (el && !(el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== 'visible')) el = el.parentElement;
    el?.scrollBy(0, b.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom + 160);
  });
  await page.waitForTimeout(200);
  await save(page, 'coordinates', { ...sidebar, y: sidebar.y + 46, height: 580 }); // the selection box, down to the coordinate
});
shot('step-warnings', async () => {
  const page = await editor({ practice: true }); // set 4 in only 8 counts
  await goSet(page, 4);
  await save(page, 'step-warnings', await fieldClip(page, { x: -32, y: 54 }, { x: 32, y: 22 }));
});
shot('review', async () => {
  // The practice show's Review list over the field; its first item clicked, so they're ringed and selected, and checked.
  const page = await editor({ practice: true });
  await menu(page, 'Review');
  await page.locator('section[aria-label=Review] li button').first().click();
  await page.locator('section[aria-label=Review] li input[type=checkbox]').first().check(); // shows a checked box and the Dismiss count
  await page.waitForTimeout(300);
  await save(page, 'review', { x: 380, y: 128, width: 730, height: 610 });
});
shot('ftl', async () => {
  const page = await editor();
  await goSet(page, 3);
  await box(page, { x: -24, y: 26 }, { x: 36, y: 6 });
  await menu(page, 'Path');
  await save(page, 'ftl', { x: 360, y: 110, width: 720, height: 600 });
});
shot('move', async () => {
  // The battery's line gate-turns on its Side 1 end into set 2, marching arcs, and the Move menu shows it.
  const page = await editor();
  await goSet(page, 2);
  await box(page, { x: -17, y: 50 }, { x: 19, y: 54 });
  await menu(page, 'Rotate');
  await page.getByRole('combobox', { name: 'Rotate around' }).selectOption({ label: 'S1' });
  await page.getByRole('spinbutton', { name: 'Rotation in degrees' }).fill('90');
  await page.getByRole('spinbutton', { name: 'Rotation in degrees' }).press('Enter');
  await page.getByTitle('Rotate counterclockwise').click();
  await page.keyboard.press('Escape');
  await menu(page, 'Move');
  await page.getByRole('button', { name: 'Turn as a group' }).click();
  await page.getByRole('spinbutton', { name: 'Counts to hold before stepping off' }).fill('4');
  await page.getByRole('spinbutton', { name: 'Counts to hold before stepping off' }).press('Tab');
  await page.getByRole('spinbutton', { name: 'Counts to move' }).fill('12');
  await page.getByRole('spinbutton', { name: 'Counts to move' }).press('Tab');
  await page.getByRole('button', { name: 'Apply', exact: true }).last().click();
  await page.waitForTimeout(200);
  await save(page, 'move', { x: 120, y: 60, width: 1000, height: 560 });
});
shot('props', async () => {
  // The platform picked on the field in set 3, with the Props list open in the sidebar.
  const page = await editor();
  await goSet(page, 3);
  const p = await spot(page, { x: 24, y: 70 });
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(200);
  const add = page.getByRole('button', { name: '+ Prop' });
  await add.evaluate((b) => { // scroll the sidebar until the whole prop box clears the save-status panel pinned at its bottom
    let el = b.parentElement;
    while (el && !(el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== 'visible')) el = el.parentElement;
    el?.scrollBy(0, b.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom + 160);
  });
  await page.waitForTimeout(200);
  const list = await add.boundingBox();
  await save(page, 'props', { x: 1095, y: list.y + list.height + 12 - 380, width: W - 1095, height: 380 }); // the field's picture is in the editor shot
});
shot('letters', async () => {
  // The winds and battery spell GO in set 4 (Letters, W).
  const page = await editor();
  await goSet(page, 4);
  await box(page, { x: -16, y: 58 }, { x: 16, y: 30 });
  await page.keyboard.press('w');
  await page.getByRole('textbox', { name: 'Letters to spell' }).fill('GO');
  await page.getByRole('button', { name: 'Done (Esc)' }).click();
  await page.waitForTimeout(300);
  await save(page, 'letters', await fieldClip(page, { x: -18, y: 58 }, { x: 18, y: 26 }, 20));
});
shot('trace', async () => {
  // A practice "logo" (drawn here, original) under the field, with the Picture to trace panel open.
  const page = await editor();
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const x = c.getContext('2d'); x.lineWidth = 28; x.strokeStyle = '#c8102e'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(40, 260); x.lineTo(200, 40); x.lineTo(360, 260); x.closePath(); x.stroke(); // a triangle to trace
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    const { putAudio } = await import('/src/ui/audioStore.ts');
    await putAudio('trace-sample', blob);
    const show = JSON.parse(localStorage.getItem('freeform:autosave'));
    show.trace = { id: 'trace-sample', x: -30, y: 42, w: 32, opacity: 0.6 };
    localStorage.setItem('freeform:autosave', JSON.stringify(show));
  });
  await page.reload(); await page.waitForSelector('canvas'); await page.waitForTimeout(600);
  await page.getByText('Picture to trace').click();
  await page.waitForTimeout(200);
  await save(page, 'trace', { x: 0, y: 125, width: W, height: 640 });
});
shot('court', async () => {
  // An indoor show on a basketball court: two arcs of guard.
  const page = await editor();
  await page.evaluate(async () => {
    const { newShow, addPerformer } = await import('/src/engine/show.ts');
    const { COURT } = await import('/src/engine/coords.ts');
    let show = { ...newShow(), title: 'Indoor Sample', surface: COURT };
    const g = show.sections.find((x) => x.letter === 'G').id;
    for (let k = 0; k < 16; k++) { const a = (Math.PI * (k % 8)) / 7, r = k < 8 ? 9 : 5; show = addPerformer(show, g, { x: Math.round(-r * Math.cos(a) * 4) / 4, y: Math.round((6 + r * Math.sin(a)) * 4) / 4 }).show; }
    localStorage.setItem('freeform:autosave', JSON.stringify(show));
  });
  await page.reload(); await page.waitForSelector('canvas'); await page.waitForTimeout(500);
  await save(page, 'court', { x: 0, y: 125, width: W, height: 640 });
});
shot('route', async () => {
  // One trumpet's custom, smooth path into set 2, out around the front of the block (Path, Custom, two points, Smooth).
  const page = await editor();
  await goSet(page, 2);
  const s = await page.evaluate(() => { const sh = JSON.parse(localStorage.getItem('freeform:autosave')); const t = sh.sections.find((x) => x.letter === 'P').id; const id = sh.performers.find((p) => p.section === t && p.number === 1).id; return sh.sets[1].pos[id]; });
  const at = await spot(page, s);
  await page.mouse.click(at.x, at.y);
  await menu(page, 'Path');
  await page.getByRole('radio', { name: 'Custom' }).click();
  for (const q of [{ x: s.x - 5, y: s.y - 5 }, { x: s.x + 3, y: s.y - 7 }]) { const c = await spot(page, q); await page.mouse.click(c.x, c.y); }
  await page.keyboard.press('Escape');
  await menu(page, 'Path');
  await page.getByLabel(/Smooth/).check();
  await page.waitForTimeout(300);
  await save(page, 'route', { x: 120, y: 60, width: 1000, height: 640 });
});
shot('sections', async () => {
  const page = await editor();
  const head = page.getByText('Sections', { exact: true });
  await head.click();
  await page.waitForTimeout(200);
  await save(page, 'sections', await fromHere(head));
});
shot('roster', async () => {
  const page = await editor();
  const head = page.getByText('Roster', { exact: true });
  await head.click();
  await page.waitForTimeout(200);
  await save(page, 'roster', await fromHere(head));
});
shot('timeline', async () => {
  const page = await editor();
  await goSet(page, 2);
  await save(page, 'timeline', { x: 0, y: 715, width: 1080, height: H - 715 });
});
shot('set-name', async () => { // Set 2 ▾: renaming a set, and Renumber sets
  const page = await editor();
  await goSet(page, 2);
  await page.getByRole('button', { name: /^Set 2: rename, color, or renumber/ }).click(); await page.waitForTimeout(300);
  await page.getByRole('textbox', { name: 'Set name' }).fill('12');
  await save(page, 'set-name', await withPanel(page, page.getByRole('button', { name: /^Set 2: rename, color, or renumber/ })));
});
shot('music', async () => {
  const page = await editor();
  await menu(page, 'Music');
  await save(page, 'music', { x: 0, y: 430, width: 760, height: H - 430 });
});
shot('music-sync', async () => {
  const page = await editor();
  await page.evaluate(async () => {
    const { sampleShow } = await import('/src/engine/sample.ts');
    const show = sampleShow();
    show.sets = show.sets.slice(0, 4).map((set, i) => i === 1 ? { ...set, counts: 8, measures: '2–3' }
      : i === 2 ? { ...set, counts: 9, measures: '5' } : set);
    localStorage.setItem('freeform:autosave', JSON.stringify(show));
  });
  await page.reload();
  await menu(page, 'Music');
  const measure = '<measure><note><rest/><duration>4</duration></note></measure>';
  const xml = `<score-partwise><part id="P1">${measure.repeat(12)}</part></score-partwise>`;
  await page.locator('input[accept*=".musicxml"]').setInputFiles({ name: 'Opener.musicxml', mimeType: 'application/xml', buffer: Buffer.from(xml) });
  const length = 24 * 8000;
  const wav = Buffer.alloc(44 + length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(length * 2, 40);
  await page.locator('input[accept^="audio/*"]').setInputFiles({ name: 'Opener.wav', mimeType: 'audio/wav', buffer: wav });
  const preview = page.getByRole('dialog', { name: 'Preview music sync' });
  await preview.getByRole('checkbox', { name: /^Add hold 1A/ }).check();
  await save(page, 'music-sync', await around(preview.locator(':scope > div'), 16));
});
shot('music-lineup', async () => {
  // A band recording paired with its score: the tap screen for beat 1 of each bar, partway through.
  const page = await editor();
  await menu(page, 'Music');
  const measure = '<measure><note><rest/><duration>4</duration></note></measure>';
  await page.locator('input[accept*=".musicxml"]').setInputFiles({ name: 'Opener.musicxml', mimeType: 'application/xml', buffer: Buffer.from(`<score-partwise><part id="P1">${measure.repeat(16)}</part></score-partwise>`) });
  const length = 40 * 8000, wav = Buffer.alloc(44 + length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(length * 2, 40);
  await page.locator('input[accept^="audio/*"]').setInputFiles({ name: 'Opener (band).wav', mimeType: 'audio/wav', buffer: wav });
  await page.getByRole('dialog', { name: 'Preview music sync' }).getByRole('button', { name: 'Line up the downbeats…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Line up the recording with the score' });
  await dialog.getByRole('button', { name: /^Start at bar/ }).click();
  for (let k = 0; k < 3; k++) { await page.waitForTimeout(250); await page.keyboard.press('Space'); }
  await dialog.getByRole('button', { name: 'Pause' }).click();
  await save(page, 'music-lineup', await around(dialog.locator(':scope > div'), 16));
});
shot('movements', async () => {
  const page = await editor();
  await menu(page, 'Movements');
  await save(page, 'movements', { x: 0, y: 430, width: 760, height: H - 430 });
});
shot('print', async () => {
  const page = await editor();
  await menu(page, 'Export'); await page.getByRole('button', { name: 'Print…' }).click();
  await page.waitForTimeout(400);
  await save(page, 'print', await around(page.locator('[role=dialog] > div').first()));
});
shot('print-changed', async () => {
  // Published as revision 6 (a copy kept to compare with), then two flutes' spots in set 3 change.
  const page = await editor();
  await page.evaluate(async () => {
    const { nextRevision, placeInSet } = await import('/src/engine/show.ts');
    const { keepPublished } = await import('/src/ui/showStore.ts');
    let s = JSON.parse(localStorage.getItem('freeform:autosave'));
    for (let k = 0; k < 6; k++) s = nextRevision(s);
    await keepPublished(s, new Date('2026-11-18T19:05:00').getTime());
    const two = s.performers.filter((p) => p.section === s.sections[0].id).slice(0, 2);
    localStorage.setItem('freeform:autosave', JSON.stringify(placeInSet(s, 2, Object.fromEntries(two.map((p) => [p.id, { x: s.sets[2].pos[p.id].x + 2, y: s.sets[2].pos[p.id].y }])))));
  });
  await page.reload();
  await page.waitForTimeout(500);
  await menu(page, 'Export'); await page.getByRole('button', { name: 'Print…' }).click();
  await page.getByLabel(/Only what changed since/).check();
  await page.waitForTimeout(300);
  await save(page, 'print-changed', await around(page.locator('[role=dialog] > div').first()));
});
/** A small OpenMarch file made with Node's own SQLite: six trumpets, three pages, one too-big move, one marcher who
 * starts with no spot, and midsets (which FreeFORM doesn't bring in). For the import summary. */
async function openMarchFile() {
  const [{ DatabaseSync }, fs, os, path] = await Promise.all([import('node:sqlite'), import('node:fs'), import('node:os'), import('node:path')]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'freeform-dots-')), file = path.join(dir, 'Closer.dots');
  const db = new DatabaseSync(file), PX = 11.25, px = (x, y) => [x * PX + 80 * PX, 85.33 * PX - y * PX];
  db.exec(`CREATE TABLE beats (id integer PRIMARY KEY, duration real NOT NULL, position integer NOT NULL);
    CREATE TABLE pages (id integer PRIMARY KEY, is_subset integer DEFAULT 0, notes text, start_beat integer NOT NULL);
    CREATE TABLE marchers (id integer PRIMARY KEY, name text, section text NOT NULL, drill_prefix text NOT NULL, drill_order integer NOT NULL);
    CREATE TABLE marcher_pages (id integer PRIMARY KEY, marcher_id integer, page_id integer, x real, y real, path_data_id integer, path_start_position real, path_end_position real);
    CREATE TABLE pathways (id integer PRIMARY KEY, path_data text); CREATE TABLE measures (id integer PRIMARY KEY, start_beat integer);
    CREATE TABLE field_properties (id integer PRIMARY KEY, json_data text, image blob); CREATE TABLE utility (id integer PRIMARY KEY, last_page_counts integer);
    CREATE TABLE workspace_settings (id integer PRIMARY KEY, json_data text); CREATE TABLE audio_files (id integer PRIMARY KEY, path text, nickname text, data blob, selected integer);
    CREATE TABLE midsets (id integer PRIMARY KEY, marcher_page_id integer); INSERT INTO midsets (marcher_page_id) VALUES (1);
    INSERT INTO utility (id, last_page_counts) VALUES (0, 8); INSERT INTO workspace_settings (id, json_data) VALUES (1, '{}');`);
  const field = { name: 'HS', isCustom: false, useHashes: true, stepSizeInches: 22.5,
    xCheckpoints: Array.from({ length: 21 }, (_, k) => ({ id: k, name: `${k} line`, axis: 'x', stepsFromCenterFront: (k - 10) * 8, useAsReference: true })),
    yCheckpoints: [['front sideline', 0], ['HS front hash', -28], ['HS back hash', -56], ['real back sideline', -85.33]].map(([name, st], k) => ({ id: 100 + k, name, axis: 'y', stepsFromCenterFront: st, useAsReference: true })) };
  db.prepare('INSERT INTO field_properties (id, json_data) VALUES (1, ?)').run(JSON.stringify(field));
  for (let k = 0; k <= 40; k++) db.prepare('INSERT INTO beats (id, duration, position) VALUES (?, 0.5, ?)').run(k + 100, k);
  db.exec("INSERT INTO pages (id, start_beat, notes) VALUES (0, 100, 'Opener'); INSERT INTO pages (id, start_beat) VALUES (2, 101); INSERT INTO pages (id, start_beat) VALUES (3, 109)");
  for (let m = 1; m <= 6; m++) db.prepare("INSERT INTO marchers (id, section, drill_prefix, drill_order) VALUES (?, 'Trumpet', 'T', ?)").run(m, m);
  const at = (m, pg, x, y) => { const [a, b] = px(x, y); db.prepare('INSERT INTO marcher_pages (marcher_id, page_id, x, y) VALUES (?, ?, ?, ?)').run(m, pg, a, b); };
  for (let m = 1; m <= 5; m++) at(m, 0, -20 + m * 4, 28);
  for (let m = 1; m <= 6; m++) at(m, 2, -20 + m * 4, 36);
  for (let m = 1; m <= 6; m++) at(m, 3, -20 + m * 4, 36 + (m === 1 ? 40 : 0)); // T1 runs 40 steps in 8 counts
  db.close();
  const bytes = fs.readFileSync(file); fs.rmSync(dir, { recursive: true, force: true });
  return bytes;
}
shot('import-summary', async () => {
  const page = await editor();
  await page.locator('input[type=file][accept*=".dots"]').setInputFiles({ name: 'Closer.dots', mimeType: 'application/octet-stream', buffer: await openMarchFile() });
  const d = page.getByRole('dialog', { name: 'Import summary' });
  await d.waitFor();
  await save(page, 'import-summary', await around(d.locator(':scope > div')));
});
shot('video', async () => {
  const page = await editor();
  await menu(page, 'Export'); await page.getByRole('button', { name: 'Video…' }).click();
  await page.waitForTimeout(400);
  await save(page, 'video', await around(page.locator('[role=dialog] > div').first()));
});
shot('share', async () => {
  const page = await editor();
  await page.getByRole('button', { name: 'Share…' }).click();
  await page.waitForTimeout(800);
  // Show the published app's address in the link box, not this local test server's.
  await page.evaluate(async () => {
    const { qrSvg } = await import('/src/engine/qr.ts');
    const t = document.querySelector('[role=dialog] textarea');
    t.value = t.value.replace(location.origin + '/', 'https://freeformdrill.org/');
    const svg = document.querySelector('[role=dialog] svg')?.parentElement;
    if (svg) svg.innerHTML = qrSvg(t.value); // so the pictured code scans to the real address too
  });
  await save(page, 'share', await around(page.locator('[role=dialog] > div').first()));
});
shot('share-update', async () => {
  const page = await editor();
  await page.getByRole('button', { name: 'Share…' }).click();
  await page.getByRole('button', { name: 'Keep phones up to date' }).click();
  await page.waitForTimeout(300);
  await save(page, 'share-update', await around(page.locator('[role=dialog] > div').first()));
});
shot('ipad', async () => {
  const page = await editor({ ...devices['iPad Pro 11 landscape'] });
  await goSet(page, 2);
  await save(page, 'ipad');
});
shot('phone', async () => {
  const ed = await editor();
  const link = await ed.evaluate(async () => {
    const { encodeShow, SHARE_PREFIX } = await import('/src/engine/share.ts');
    return SHARE_PREFIX + await encodeShow(JSON.parse(localStorage.getItem('freeform:autosave')));
  });
  const ctx = await browser.newContext({ ...devices['iPhone 15'], colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(URL_ + link);
  await page.waitForTimeout(1500);
  await page.locator('.who-button').click();
  await page.getByRole('searchbox').fill('P1');
  await page.waitForTimeout(200);
  await save(page, 'phone-who');
  await page.keyboard.press('Enter');
  // Upright: My dots, one set at a time, on set 2 (picked from the Set picker on the card).
  await page.getByRole('combobox', { name: 'Set', exact: true }).selectOption({ label: '2' });
  await page.waitForTimeout(400);
  await save(page, 'phone');
  // All sets: the whole list, like the printed dot sheet.
  await page.getByRole('button', { name: 'All sets' }).click();
  await page.waitForTimeout(400);
  await save(page, 'phone-all');
  await page.getByRole('button', { name: /One set at a time/ }).click();
  // On its side: the field and playback.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(800);
  await save(page, 'phone-field');
  // Back upright, the Field switch: the field is drawn sideways (turn the phone to read it), then Loop.
  await page.setViewportSize({ width: 393, height: 659 });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Field', exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Loop', exact: true }).click();
  await page.getByRole('combobox', { name: 'Loop from set' }).selectOption({ label: '2' });
  await page.getByRole('combobox', { name: 'Loop to set' }).selectOption({ label: '3' });
  await page.waitForTimeout(200);
  await save(page, 'phone-loop');
});
shot('phone-changed', async () => {
  // P1 has the show; then an update moves their spot in set 3, changes the counts into set 4, and adds a note for them.
  const ed = await editor();
  const [first, update] = await ed.evaluate(async () => {
    const { encodeShow, SHARE_PREFIX } = await import('/src/engine/share.ts');
    const { nextRevision, placeInSet, setCounts, setCue } = await import('/src/engine/show.ts');
    let s = JSON.parse(localStorage.getItem('freeform:autosave'));
    for (let k = 0; k < 6; k++) s = nextRevision(s);
    const p1 = s.performers.find((p) => p.section === s.sections.find((x) => x.letter === 'P').id && p.number === 1).id, at = s.sets[2].pos[p1];
    let u = nextRevision(setCue(setCounts(placeInSet(s, 2, { [p1]: { x: at.x + 2, y: at.y } }), 3, s.sets[3].counts + 4), 3, [p1], 'Stick click on 1'));
    return [SHARE_PREFIX + await encodeShow(s), SHARE_PREFIX + await encodeShow(u)];
  });
  const ctx = await browser.newContext({ ...devices['iPhone 15'], colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(URL_ + first);
  await page.waitForTimeout(1500);
  await page.locator('.who-button').click();
  await page.getByRole('searchbox').fill('P1');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.goto(URL_ + update); // the same show again, updated: it replaces the copy on the phone
  await page.waitForTimeout(1500);
  await save(page, 'phone-changed');
});
/** A printed page (US Letter width at 96 dpi), as the browser would print it. */
async function printed(kind, name, opts = {}) {
  const page = await editor();
  await page.evaluate(() => { window.print = () => {}; });
  await menu(page, 'Export'); await page.getByRole('button', { name: 'Print…' }).click();
  if (kind === 'charts') await page.getByLabel(/Drill charts/).check();
  if (opts.single) await page.getByLabel(/1 per page, bigger/).check();
  if (opts.pics) await page.getByLabel(/small field picture/).check();
  if (opts.section) await page.getByRole('combobox', { name: 'Section to print' }).selectOption({ label: opts.section });
  if (opts.paths) await page.getByLabel(/Show the paths/).check();
  await page.getByRole('dialog').getByRole('button', { name: /^Print/ }).click();
  await page.setViewportSize({ width: 816, height: 1056 });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(800);
  // The first dot-sheet page; set 2's chart (it has markup and a note).
  if (opts.single || opts.pics) { // just the top of the page: the rest is blank for a short show
    const card = await page.locator('.dot-card').first().boundingBox(), table = await page.locator('.dot-card table').first().boundingBox();
    await page.screenshot({ path: `${OUT}${name}.png`, clip: { x: card.x, y: card.y, width: card.width, height: table.y + table.height - card.y + 8 } });
    return;
  }
  await page.locator(kind === 'charts' ? '.chart-page' : '.dot-page').nth(kind === 'charts' ? opts.set ?? 1 : 0).screenshot({ path: `${OUT}${name}.png` });
}
shot('dot-sheet', () => printed('dots', 'dot-sheet'));
shot('drill-chart', () => printed('charts', 'drill-chart'));
shot('dot-sheet-page', () => printed('dots', 'dot-sheet-page', { single: true, section: 'Color Guard' }));
shot('dot-sheet-pictures', () => printed('dots', 'dot-sheet-pictures', { pics: true, section: 'Color Guard' }));
shot('drill-chart-paths', () => printed('charts', 'drill-chart-paths', { paths: true, set: 2 })); // set 3: the guard's FTL and the platform's move

for (const [name, f] of Object.entries(shots)) {
  if (only.length && !only.includes(name)) continue;
  await f();
  console.log('✓', name);
}
await browser.close();
await server.close();
