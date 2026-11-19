// Browser checks of the things a director trusts FreeFORM Drill with: that a draft survives Shows…, that removed music
// comes back with Undo, and that a phone keeps working with no signal. They run against the production build (offline
// use only works there), each in a fresh browser profile.
// Run after a build:  npm run build && npm run journeys
// Needs Playwright once:  npm i --no-save playwright && npx playwright install chromium  (or set CHROME to an installed Chrome)
import { preview } from 'vite';
import { createRequire } from 'node:module';

const { chromium, devices } = createRequire(import.meta.url)('playwright'); // require: also finds a global install

const server = await preview({ preview: { port: 5198, strictPort: true }, logLevel: 'error' });
const BASE = 'http://localhost:5198/';
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
let failed = 0;

/** A show with no performers yet: two sets and a podium. Only the blank first-visit show may be dropped; this is a draft. */
const draft = {
  format: 'freeform-show', version: 1, id: 'journey-draft', title: 'Prop draft', hash: 'highSchool',
  sections: [{ id: 's1', name: 'Trumpets', letter: 'T' }], performers: [], props: [{ id: 'pr1', name: 'Podium', w: 4, h: 2 }],
  sets: [{ id: 'set1', name: '1', counts: 0, pos: {}, props: { pr1: { x: 0, y: 30, angle: 0 } } },
    { id: 'set2', name: '2', counts: 8, pos: {}, props: { pr1: { x: 0, y: 30, angle: 0 } } }],
};
/** One trumpet, with a recording (its bytes go into this browser's storage under audioId). */
const withMusic = {
  format: 'freeform-show', version: 1, id: 'journey-music', title: 'With music', hash: 'highSchool',
  sections: [{ id: 's1', name: 'Trumpets', letter: 'T' }], performers: [{ id: 'p1', section: 's1', number: 1 }],
  sets: [{ id: 'set1', name: '1', counts: 0, pos: { p1: { x: 0, y: 28 } } }, { id: 'set2', name: '2', counts: 8, pos: { p1: { x: -8, y: 28 } } }],
  music: { name: 'click.wav', audioId: 'journey-audio', taps: [] },
};

async function journey(name, f) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try { await f(ctx); console.log(`✓ ${name}`); } catch (e) { failed++; console.log(`✗ ${name}\n  ${e.message.split('\n')[0]}`); } finally { await ctx.close(); }
}
const check = (ok, what) => { if (!ok) throw new Error(what); };
/** Open the editor with `show` as the autosaved show, as if it were the one open last visit. */
async function editorWith(ctx, show, audio) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}app/`);
  await page.evaluate(async ({ show, audio }) => {
    localStorage.clear();
    localStorage.setItem('freeform:autosave', JSON.stringify(show));
    if (audio) await new Promise((ok, fail) => {
      const r = indexedDB.open('freeform', 2);
      r.onupgradeneeded = () => { for (const s of ['audio', 'shows', 'versions']) r.result.createObjectStore(s); };
      r.onsuccess = () => { const tx = r.result.transaction('audio', 'readwrite'); tx.objectStore('audio').put(new Blob(['RIFF'], { type: 'audio/wav' }), audio); tx.oncomplete = () => { r.result.close(); ok(); }; tx.onerror = fail; };
      r.onerror = fail;
    });
  }, { show, audio });
  await page.reload();
  await page.waitForSelector('canvas');
  await page.waitForTimeout(1500); // the autosave reaches the library
  return page;
}
const shows = (page) => page.evaluate(() => new Promise((ok) => {
  const r = indexedDB.open('freeform', 2);
  r.onsuccess = () => { const q = r.result.transaction('shows').objectStore('shows').getAllKeys(); q.onsuccess = () => { r.result.close(); ok(q.result.map(String)); }; };
}));
const stored = (page, id) => page.evaluate((id) => new Promise((ok) => {
  const r = indexedDB.open('freeform', 2);
  r.onsuccess = () => { const q = r.result.transaction('audio').objectStore('audio').get(id); q.onsuccess = () => { r.result.close(); ok(!!q.result); }; };
}), id);

await journey('A draft with a prop and no performers stays in Shows… after opening the list and another show', async (ctx) => {
  const page = await editorWith(ctx, draft);
  check((await shows(page)).includes('journey-draft'), 'the draft never reached the library');
  await page.getByRole('button', { name: 'Shows…' }).first().click();
  await page.waitForTimeout(800);
  check((await shows(page)).includes('journey-draft'), 'opening Shows… deleted the draft');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Help' }).first().click();
  await page.getByRole('button', { name: /^Try the sample show/ }).first().click();
  await page.waitForTimeout(1500);
  check((await shows(page)).includes('journey-draft'), 'opening the sample deleted the draft');
});

await journey("When this browser can't save, opening another show waits for the director's choice", async (ctx) => {
  const page = await editorWith(ctx, { ...draft, performers: [{ id: 'p1', section: 's1', number: 1 }], sets: draft.sets.map((x) => ({ ...x, pos: { p1: { x: 0, y: 28 } } })) });
  await page.evaluate(() => { // the library refuses from now on, like a full disk
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...a) { if (this.name === 'shows') throw new DOMException('full', 'QuotaExceededError'); return put.apply(this, a); };
  });
  await page.getByLabel('Show title').fill('Prop draft, edited'); // a change the library hasn't got
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Help' }).first().click();
  await page.getByRole('button', { name: /^Try the sample show/ }).first().click();
  await page.getByText("This browser couldn't save").waitFor({ timeout: 5000 });
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  await page.getByRole('button', { name: 'Stay here' }).click();
  check(await page.getByLabel('Show title').inputValue() === 'Prop draft, edited', 'the show switched even though it could not be saved');
});

await journey('Remove music, then Undo: the recording is still there to play', async (ctx) => {
  const page = await editorWith(ctx, withMusic, 'journey-audio');
  await page.getByRole('button', { name: /Music$/ }).first().click();
  await page.getByRole('button', { name: 'Remove music' }).click();
  await page.keyboard.press('Escape');
  await page.locator('canvas').click({ position: { x: 20, y: 20 } }); // the field has the keyboard, as after any edit
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  check(await stored(page, 'journey-audio'), 'Remove music deleted the recording, so Undo brought back a silent show');
  await page.getByRole('button', { name: /Music$/ }).first().click();
  check(await page.getByText('click.wav').isVisible(), 'Undo did not bring the music back');
  check(!(await page.getByText("The recording isn't in this browser").isVisible()), 'the recording is missing after Undo');
});

await journey('A phone opens the show, says Ready offline, and still works after losing signal', async (ctx0) => {
  await ctx0.close();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  try {
    const page = await ctx.newPage();
    await page.goto(`${BASE}app/#perform`);
    await page.evaluate((show) => localStorage.setItem('freeform:performer', JSON.stringify({ shows: [{ show, me: null, facingFront: false, follow: true }], current: 0 })), withMusic);
    await page.reload();
    const says = (text, timeout) => page.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout });
    await says('Ready offline', 20_000); // the show and FreeFORM itself are saved on the phone
    await ctx.setOffline(true);
    await page.reload();
    await says('Ready offline', 10_000).catch(() => { throw new Error('offline, the phone no longer says Ready offline'); });
    check((await page.innerText('body')).includes('With music'), 'the show is gone offline');
  } finally { await ctx.close(); }
});

await browser.close();
await new Promise((ok) => server.httpServer.close(ok));
if (failed) { console.log(`${failed} journey(s) failed`); process.exit(1); }
