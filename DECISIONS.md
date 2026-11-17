# Decisions

Each entry: timestamp, who decided, context, options considered, decision.

Recent decisions are here. Older ones are in [docs/decisions/](docs/decisions/), one file per month, moved as written: [October 2026](docs/decisions/2026-10.md) and [November 1–9, 2026](docs/decisions/2026-11.md). When this file passes about 100 KB, move whole days older than two weeks into that month's file.

## 2026-11-10 09:56 EST — The review's suggestions go on the plan
- **Who:** Jason, on Claude's review.
- **Context:** Jason asked Claude to go through the docs, the app, and the tests, and say what would make FreeFORM better for drill writers, directors, and students. The review found phone layout problems, small click targets, accessibility gaps, no front door on the site, and the GitHub token as the main barrier to other directors using hosted links.
- **Other options:** take only some of them; open GitHub issues instead of plan items.
- **Decision:** All of them go in PLAN.md under "From the 2026-11-10 review." The order within it (phone layout, front door, upload service, pilot) is Claude's suggestion (*Jason can veto*). Nothing is built yet.

## 2026-11-10 10:45 EST — A front page at /, the editor at /app/
- **Who:** Jason chose the layout (landing at /, editor at /app/); Claude chose the details (*Jason can veto*).
- **Context:** freeformdrill.org opened straight into the editor, and on a phone it said only "Open the show link your director sent you," with nothing about what FreeFORM is.
- **Other options:** a page at /about/ with the editor staying at /; no front page yet.
- **Decision:** `index.html` is the front page; the app is `app/index.html`. Links made before the move (`/#show=…`, `/#load=…`, `/#perform`) and a home-screen app opened at / are forwarded to /app/ before the page draws, so nothing a student has stops working. The manifest keeps its identity (`id: "./"`, the old start address) and starts at app/. Browser storage is per site, not per page, so shows, phones' saved shows, and settings carry over. Privacy and "Coming from Pyware or UDB" are sections of the front page rather than pages of their own (Claude: one page to keep up to date). Its QR code opens the sample show from a file the build writes (`sample.freeform`, the same ids every build), so the code stays short enough to scan off a screen; a share link with the whole show inside made a very dense code. The comparison says only what FreeFORM does and doesn't do, not Pyware's prices or tiers, which change and which Claude couldn't check.

## 2026-11-10 10:45 EST — The editor and the performer view are separate downloads
- **Who:** Claude (*Jason can veto*), from the review.
- **Context:** A phone downloaded the whole editor (216 KB zipped) to show one dot. The single bundle was on purpose: the offline cache kept only files the page linked.
- **Other options:** keep one bundle.
- **Decision:** `main.tsx` loads the editor or the performer view on demand, and the QR scanner loads only when someone scans (a phone now fetches about 107 KB zipped). The build writes `precache.json` (both pages, every built file, the icons and logos); the service worker caches all of it at install and tops it up after each online visit, so the view you haven't opened yet still works offline. Checked offline in Chromium for the editor, the performer view, and the front page.

## 2026-11-10 10:45 EST — Light or dark follows the device
- **Who:** Claude, from the review item Jason approved (*Jason can veto*).
- **Context:** Dark was the default for everyone; the plan had "follow the device's setting" as "later, if wanted."
- **Other options:** keep dark as the default.
- **Decision:** Until someone clicks the sun/moon button, FreeFORM (editor, phone, front page) follows the device's light or dark setting, and changes with it. A click is remembered as before and wins. Most Macs and Windows PCs are set to light, so many directors will now see light mode first. The screenshot script asks for dark, so the guide's pictures don't change.

## 2026-11-10 10:45 EST — The phone view's layout
- **Who:** Claude (*Jason can veto*), from the review.
- **Context:** On an upright phone the view buttons floated over the field and covered the neighbors' labels, and the field was about a fifth of the screen. On its side, the play controls ran off the edge.
- **Other options:** a row of view buttons under the field (costs field height); shorter button labels (Jason chose the current ones on 2026-11-08).
- **Decision:** **From the press box** and the sun/moon button sit beside the show's title, and **Follow my dot** beside the who button, so the header is no taller and nothing covers the field. The readout panel is a share of the screen's height (130 to 230 px) instead of 230 px, and still fixed, so the field never resizes as the text changes. On its side, the field gets the left side at full height and everything else scrolls in one column on the right. The staff view draws dots instead of letters while letters would overlap.

## 2026-11-10 10:45 EST — The step size in plain words on phones
- **Who:** Claude chose the words (*Jason can veto*); Jason approved the idea in the review.
- **Context:** "8.3-to-5" means nothing to many students.
- **Other options:** replace the number; words only for big steps.
- **Decision:** The number stays, with a line under it: smaller steps than normal (past 9-to-5), normal (7 to 9), bigger than normal (6 to 7), or very big (under 6), then the overall direction for a performer facing the front ("moving back and to your left"). A sideways drift under a third of the main direction isn't mentioned. For a follow-the-leader or curved move it's where they end up, not the route.

## 2026-11-10 10:45 EST — Red paths are solid, not only red
- **Who:** Claude (*Jason can veto*).
- **Context:** In a simulation of red-green color blindness, a red (over the limit) path looked like a plain dark one.
- **Other options:** a different warning color.
- **Decision:** Red paths are solid and 1.6 times as wide; the others stay dashed. The red rings and the underlined red "max" on the timeline already work without color.

## 2026-11-10 10:45 EST — Dot sheets with field pictures
- **Who:** Claude (*Jason can veto*), from the review.
- **Context:** A UDB-style dot book shows a little field for each set.
- **Other options:** pictures on the 4-per-page cards (no room); a separate dot-book print type.
- **Decision:** A third dot-sheet layout, **1 per page, with a small field picture for each set**: a 1.3-inch picture of the whole field on each set's row, everyone faint gray and the performer a big black dot, 12 sets a page (checked: 12 rows with two-line notes fit).

## 2026-11-10 10:45 EST — Send feedback goes to GitHub for now
- **Who:** Claude (*Jason can veto*).
- **Context:** The review asked for a way to send feedback without GitHub. Any other channel (an email address, a form service) is Jason's to choose and would put his address or an outside service on the page.
- **Other options:** a mailto link; a form service.
- **Decision:** **Send feedback** (Help menu and front page) opens GitHub's new issue forms (a problem, an idea) until Jason picks a channel for people without a GitHub account. The address is one constant (`FEEDBACK` in `src/App.tsx`) plus the front page's link.

## 2026-11-10 10:45 EST — A smoke test before every deploy
- **Who:** Claude (*Jason can veto*).
- **Context:** Unit tests can't catch a screen that crashes or a button that's gone.
- **Other options:** a separate end-to-end test suite.
- **Decision:** The deploy workflow installs Playwright and runs `scripts/screenshots.mjs`, which already clicks through every screen in the guide; if it fails, the site doesn't update. It adds a few minutes to each deploy. Version 0.1.0, issue forms, and CONTRIBUTING.md came with it.

## 2026-11-10 12:00 EST — Video export
- **Who:** Jason chose what's in it (the whole field from the press box, the music if there is any, the set and count with the show's title and the piece, a range of sets, MP4); Claude chose how it's made (*Jason can veto*).
- **Context:** Directors want to post the drill in a group chat or show it to boosters.
- **Other options:** record the screen while it plays (MediaRecorder: real time, and only WebM in some browsers); a server to make videos.
- **Decision:** **Video…** in the sidebar's Get-it-to-the-band row. Frames are drawn off screen at 1920 by 1080, 30 a second, and encoded in the browser with WebCodecs through **Mediabunny** (MPL-2.0, a new dependency, loaded only when someone makes a video: about 57 KB zipped), so a 7-minute show takes well under 7 minutes. Video is H.264 when the browser has it; sound is AAC when it can encode it, otherwise Opus (plays in browsers and most players, not some older Apple apps). With the recording, frames follow the tapped counts; without, the Tempo. The caption sits in a band above the field so it covers nothing; labels are left off, as during playback, so nothing jumps. The last set holds 1.5 seconds at the end. Version 1.62.1 of Mediabunny, the newest at least two weeks old.
## 2026-11-10 12:30 EST — Spanish, starting with the phone and the front page
- **Who:** Jason asked for Spanish in Claude's order (phone and front page, then the editor, then the guide); Claude chose how (*Jason can veto*).
- **Context:** Many bands have Spanish-speaking students and families. Every string was written straight into the components.
- **Other options:** an i18n library (i18next and the like: more than this needs); keys like `perform.followMyDot` (the code stops reading as English); translating the wordmark.
- **Decision:** `tr('English text', vars)` looks the text up in `src/i18n/es.ts`, so the code still reads in English and every Spanish line is in one file a Spanish-speaking director can check; a test fails if a translated string is missing or drops a {placeholder}. FreeFORM follows the device's language until someone taps **Español** / **English** (start screen, bottom of the who list, front page), which is remembered and reloads the page. Coordinates have their own Spanish wording in `coords.ts` ("3 pasos adentro de la 45 del Lado 2, 2 pasos delante del Hash delantero"); step sizes read "8 a 5"; counts are "tiempos", measures "compases" (c.), a dot a "punto", and "set", "hash", "follow the leader", and "staff" stay as bands say them. The front page has a Spanish twin at /es/, and a Spanish-language device is sent there unless someone picked English. **FreeFORM Drill and the tagline stay in English** (Jason agreed): it's a name, a translated name could collide with others, and "Drill, without the bill." doesn't rhyme in Spanish. The Spanish is Claude's first draft; the Spanish front page asks a Spanish-speaking director to check the terms.

## 2026-11-10 12:20 EST — Not on behalf of UGA
- **Who:** Jason.
- **Context:** Jason works at the University of Georgia, and his Ko-fi page says so.
- **Decision:** The front page (English and Spanish) says FreeFORM Drill is a personal project, not affiliated with or endorsed by the University of Georgia, and that Jason doesn't speak for the University there.

## 2026-11-10 12:45 EST — A Ko-fi tip jar
- **Who:** Jason chose Ko-fi (ko-fi.com/tillerdawg); Claude chose where the links go (*Jason can veto*).
- **Context:** Hosting (the coming upload service) may cost something someday, and FreeFORM must stay free.
- **Other options:** GitHub Sponsors (donors need a GitHub account), Open Collective (a host fee, a public ledger), Buy Me a Coffee (a 5% fee).
- **Decision:** **Support FreeFORM** on the front page (English and Spanish, with "free, and it always will be"), in the editor's **Help** menu, in the README, and as GitHub's Sponsor button (`.github/FUNDING.yml`). Not on the phone view: that's students, and it stays about the drill.

## 2026-11-10 12:55 EST — The repository is freeform-drill
- **Who:** Jason.
- **Context:** The repository was `Freeform_2`, left over from an earlier prototype (`Freeform`, last changed 2026-10-05, superseded).
- **Other options:** keep the name.
- **Decision:** Renamed **freeform-drill**, matching freeformdrill.org. Links in the app, the front pages, the guide, the README, and CONTRIBUTING.md use the new address (GitHub forwards the old one); the site's address doesn't change. The old `Freeform` repository is to be deleted (Claude's access can't delete repositories; Jason does it in GitHub's settings). Claude made a full backup first (a git bundle of all 69 commits), and Jason has it. `freeform-shows` stays until Jason checks whether Publish to phones uses it.

## 2026-11-10 13:05 EST — Old repositories deleted
- **Who:** Jason.
- **Context:** `Freeform` was the superseded prototype; `freeform-shows` held old test files for Publish to phones (no browser on the new address was connected to it).
- **Decision:** Both deleted. `Freeform` was backed up first as a git bundle (Jason has it). Phones that opened a hosted test show from `freeform-shows` keep their saved copy but get no more updates. Publishing will move to the FreeFORM upload service.

## 2026-11-10 13:40 EST — A feedback form, through FreeFORM's own service
- **Who:** Jason chose a form built into FreeFORM, emailed to his Gmail without showing the address; Claude chose how (*Jason can veto*).
- **Context:** **Send feedback** opened GitHub's issue forms, which need a GitHub account; Jason didn't want to publish his email address.
- **Other options:** a Google Form; a forwarding address (feedback@freeformdrill.org); GitHub only.
- **Decision:** A Cloudflare Worker at api.freeformdrill.org (`services/api`), the start of the service the upload feature will use. The editor's **Help → Send feedback** and the front page's form post a message, an optional name and email, and what it's about; the Worker checks it and sends it through Email Routing's free sending (a raw plain-text message, from feedback@freeformdrill.org; Email Sending, the newer product, needs Workers Paid), to a verified destination whose address is a Cloudflare secret (`FEEDBACK_TO`), so it's in neither the code nor the site. Replies go to the sender's address when they give one. Guardrails: CORS and an Origin check (only freeformdrill.org), a hidden honeypot field (bots are told it worked), size caps, 3 messages a minute per IP (Workers rate limiting), plain-text email only, and nothing stored. The front page's privacy section says so. A GitHub issue stays the way to attach a show file. Wrangler 4.153.0, the newest at least two weeks old.

## 2026-11-10 14:45 EST — Pyware import rebuilds a follow-the-leader saved as straight lines
- **Who:** Jason reported it (Mario 2008, set 6 to 7: the brass collapsed into each other and spread out again; "this should not happen"). The fix is Claude's (*Jason can veto*).
- **Context:** The file itself holds the collapse. Set 7's note says "Brasses follow-the-leader toward the 50 at an 8-to-5 step", but the route was never drawn in Pyware, so its 16 in-between pages move every dot straight to its next spot. Each file of four lands on one spot on count 8 (10 spots, 4 dots each). The import was showing what the file says.
- **Other options:** leave it and let Review's too-close list point it out (the writer rebuilds 40 dots by hand with **FTL ▾**); read "follow-the-leader" in the note and guess (notes are free text); rebuild every straight move that fits a file (would turn plain block moves into odd routes).
- **Decision:** On import, performers who share a spot (within 0.3 step) on an in-between page are checked for a follow-the-leader (`hiddenFtl` in `src/engine/pyware.ts`): an order and a leader's route where everyone marches the same distance along the trail and lands exactly on their own spot in the next set. The longest file wins, then the shortest march. It takes nothing under three performers or faster than a 4-to-5, and only a file where nobody comes within a step of anyone else in it on any count. What's found becomes a normal FTL group (`set.ftl`, with the leader's turns), so steps are even and it can be edited with **FTL ▾**. Anything else stays as Pyware had it. Mario set 7 comes in as two files of 20 (one each side of the 50), each an 8-to-5, with no one too close.
- **Known limit:** when a file fits with the turn at either end (Mario's does: the inside file can turn at its back end or its front end, and every dot lands on the same spot both ways), the file can't say which. Jason (2026-11-10 14:39): X2 and X3 led, from the front end of the inside files, 4 steps toward the 50 and then 12 toward the back. So a tie goes to the leader who starts nearest the front sideline (Claude's rule, *Jason can veto*); **FTL ▾** changes it when a show did it the other way.
- **Checked:** Halo, Mario, and Tetris 2008. Only Mario set 7 changed. Tetris's meshes (sets 2, 3, and 5, "Watch out on mesh!") are not files and stay as written.

## 2026-11-10 15:10 EST — Publish to phones through FreeFORM's own service
- **Who:** Jason asked for it, with two requirements: guardrails against abuse with automatic cleanup, and making sure directors know their file is encrypted and unreadable without their key. He chose Workers KV over R2 (no card on file). Claude chose the rest (*Jason can veto*).
- **Context:** Keeping phones up to date needed a GitHub account, a repository, and a token: the biggest barrier for other directors.
- **Other options:** R2 (needs a card, 10 GB free); GitHub only; accounts.
- **Decision:** **Publish to phones** in the Share dialog uploads the locked file (encrypted in the browser, as before) to `api.freeformdrill.org/shows`, and the link points there; **Publish update** replaces it at the same address. The service stores the file in Workers KV with the hash of an edit token that only the publishing browser has; phones download it from anywhere (CORS open; it's unreadable without the key). Guardrails: only freeformdrill.org may publish, only files shaped like a locked FreeFORM show, 24 MB at most (KV's limit is 25 MB), 6 publishes a minute per visitor, and a daily job that deletes shows nobody has opened or updated for a year (opens are noted at most once a day, since KV's free plan allows 1,000 writes a day). **Stop sharing** removes a show at once; a phone that opens a removed show's link is told it isn't online anymore (in Spanish too). The encryption is explained in a box at the top of the Keep phones up to date tab, in the guide, and in the front page's privacy section: the key is only in the link (after the #, never sent to a server), no one can read the file without it (FreeFORM included), so the link is the password, and a lost link can't be recovered. GitHub publishing and self-hosting moved under **Other ways to host it**. If the 1 GB fills up, moving to R2 is a small change in the service.

## 2026-11-10 15:40 EST — A new device keeps the same phone link
- **Who:** Jason asked what happens when a director gets a new device mid-season; Claude proposed three fixes and Jason approved them (details are Claude's; *Jason can veto*).
- **Context:** Only the browser that published a show holds its edit token, so a new device could only publish a new link, and every student would need it.
- **Other options:** let the link update the show (any student could overwrite the drill: no); accounts.
- **Decision:** (1) **Full backup** carries the show's publishing (the link with its key, and the service's id and edit token), and **Import…** restores it, so Publish update keeps the same link; a plain **Save** file doesn't, so a show file passed to a co-writer can't overwrite the band's copy. (2) A **publishing code** (`FREEFORM-PUBLISHING-1.` and the same information, checked on the way in) under **Use on another device** in the Share dialog, pasted on the new device in **Shows… → Open from a link…** or in Share; pasting one for a different show asks first, since publishing would replace that show on phones. (3) **Open from a link…** also takes the link students use and brings back the whole show (the link holds the key; names and music included), for a director with no file at all; without the code, publishing from there makes a new link, and FreeFORM says so. The code and full backups are labeled as passwords.

## 2026-11-10: "Recovery code", and a way in from a blank field (Jason can veto)
- **Context:** Jason moved a show to Safari with the code, but the steps were only on the screen that gave him the code. Weeks later, on a new device, a director wouldn't know where to paste it.
- **Decision:** (1) The copied code is a short message with the steps written above it, and **Email it to yourself** sends that message, so the steps travel with the code. (2) The blank field's start note gets a fourth button that opens the paste box directly. (3) Jason asked that the button read **Open from a link or recovery code…**; for one name everywhere, the code is now called a **recovery code** in the Share dialog, the copied message, and the guide (the code's own text, `FREEFORM-PUBLISHING-1.`, is unchanged, so codes already copied still work).

## 2026-11-10: Dismissing Review warnings, and "Step size limit" (Jason can veto)
- **Context:** Jason's show had 35 Review warnings, many of them intended (performers passing each other), with no way to clear them. He also asked why the step limit shows when nothing is over it, and to call it "Step size limit."
- **Decision:** Each warning gets **Dismiss**. Dismissed warnings are saved with the show (so they travel with Save, Full backup, and a co-writer's copy), drop out of the **Review (n)** count, and are named by kind, set, and performers: if the problem changes, it's a new warning and shows again. **Show them again** brings them all back; one at a time seemed like more than a first version needs. The timeline's red step warnings still show, since they're about the drill itself. The limit row now reads "Step size limit: warn above a 4-to-5", so it reads as a setting, and "1 steps apart" became "1 step apart".
- **Update (same day, Jason asked):** instead of a Dismiss button on each warning, each has a checkbox, with **Select all** at the top and one **Dismiss** button for the checked ones. Dismissed warnings get their own tab, **Dismissed**, where the same checkboxes and **Bring back** restore one, several, or all. Clicking a warning's text still goes to it.
- **Update (same day, Jason asked):** checkboxes everywhere in the editor and phone view (Review, Click, Loop, and the rest) are drawn in FreeFORM's colors and made bigger: a 20 px dark box that fills gold with a dark check (22 px on touch screens), instead of each browser's small default.

## 2026-11-11: Transform split into Mirror and Rotate & Scale
- **Who:** Jason Tiller (talked through with Claude)
- **Context:** When Jason wanted selected performers in an arc or a curve, he kept reaching for **Transform**, because the word sounds like "change the form," which is what **Shape** does. Transform only flipped, mirrored, rotated, and scaled.
- **Options:** (1) rename Transform (Rotate & Flip, Turn & Flip); (2) one "Form" menu with a shape section and a move section; (3) leave both and cross-link them; (4) merge Shape and Transform into one long menu; (5) split Transform into two menus named for what they do.
- **Decision:** (5). **Mirror** has Flip across the 50, Flip front ↔ back, and Copy Side 1 → 2 / 2 → 1. **Rotate & Scale** has Around, the degree turns, and Expand / Contract, and like Shape it needs 2 or more performers. Shape stays as it is. On a narrow iPad the button reads **Rotate** so the row still fits (Claude's call; Jason can veto). Picture to trace stays in the sidebar for now: it's a backdrop for every set, not an action on the selection.
- **Update (same day, Jason asked):** the **Shape** menu gets a **Picture to trace…** button at the bottom. It opens the sidebar with Picture to trace open, so the tracing tool is in reach from where you shape performers. The panel itself stays in the sidebar.

## 2026-11-11: The deploy uses the runner's own Chrome (Jason can veto)
- **Who:** Claude
- **Context:** Two deploys in a row failed before the smoke test: `npx playwright install --with-deps chromium` couldn't reach Ubuntu's package servers for fonts. Typecheck, tests, and build had passed; the site just didn't update.
- **Options:** rerun and hope; retry the install a few times; use the Google Chrome that GitHub's Ubuntu runners already have.
- **Decision:** use the runner's Chrome through the screenshot script's `CHROME` setting, and fall back to Playwright's install only if Chrome isn't there. No package servers, and a faster deploy.

## 2026-11-11: "Add Performer (F)"
- **Who:** Jason Tiller
- **Context:** The Add button's main part read **Add · F**, which didn't say what F was.
- **Decision:** It reads **Add Performer (F)**, with the section's letter in parentheses. **Add Set** and **Add Prop** are unchanged. On a narrow iPad (mini size) it shortens to **Add (F)** so the top row still fits (Claude's call; Jason can veto).

## 2026-11-11: Zoom buttons on the field
- **Who:** Jason Tiller (layout details by Claude; Jason can veto)
- **Context:** Fit was an icon at the right end of the top toolbar, away from the field it acts on, and zooming took a pinch, ⌘/Ctrl + scroll, or a shortcut.
- **Decision:** A small panel in the field's top-right corner holds **−**, the zoom as a percent, **+**, and **Fit**. 100% means the whole field (the Fit view), so the number reads as "how far in am I." The buttons step by 25%, like ⌘+ and ⌘−. Fit left the toolbar. The Review panel, when open, covers the zoom panel.

## 2026-11-11: Phones: My dots upright, the field sideways
- **Who:** Jason Tiller (choices offered by Claude; Jason picked each)
- **Context:** Jason wants the phone more useful on the field: upright, a list of the performer's dot coordinates; sideways, the field and playback controls.
- **Options and choices:** (1) Rotation lock: orientation only, or orientation plus a switch. Chose **orientation plus a My dots / Field switch**, since many students keep their phones locked upright and would never see the field otherwise. Turning the phone clears the switch. (2) List rows: dot-sheet style, sentences, or just current and next. Chose **dot-sheet style**: a card per set with the set, counts, measures, side to side, front to back, step size (with the plain words), any hold before stepping off, and notes; the current set outlined in gold; tap a card to go to that set. (3) Sideways readout: one short line, none, or today's side column. Chose **one short line** (the set and my spot). (4) Staff in portrait: the field or a set list. Chose **the field**, always.
- **Claude's calls (Jason can veto):** the sideways layout keeps the right-hand column (show, who, switch, Follow my dot, the line, and the controls) because a phone on its side is only about 390 px tall, too short for the controls under the field; the list has no playback controls (sideways is for playing); the field stays loaded but hidden while the list shows, so its zoom survives a switch.
- **Update (same day, Jason asked):** the step size goes in parentheses after the plain words, "smaller step size than normal (10.4-to-5), moving forward (facing the front)", in place of its own line above them. Each card is a line shorter.
- **Update (same day, Jason asked):** "smaller steps than normal" reads "smaller step size than normal", and "bigger steps than normal" became "bigger step size than normal" to match (Claude's call; Jason can veto). Spanish: "tamaño de paso más chico (grande) de lo normal".
- **Update (same day, Jason asked):** all four match: "normal step size" and "very big step size" too (Spanish: "tamaño de paso normal", "tamaño de paso muy grande").
- **Update (same day, Jason asked):** "stand still" is gone: performers may mark time or do visuals without traveling. A card for a set with no travel says **Hold (same spot as set 3)**, and the step-size word for no travel is "hold" everywhere. In Spanish, "hold" was "quieto" (still), which had the same problem; it is now "mantener" ("mantener 4, mover 12"; "Mantener (mismo lugar que en el set 3)") until a Spanish-speaking director says otherwise (Claude's call; Jason can veto).

## 2026-11-11: Color blindness: no separate mode; color is never the only signal
- **Who:** Jason Tiller (proposed by Claude)
- **Context:** Jason asked whether FreeFORM should have a color-blind mode. About 1 in 12 boys has red-green color blindness, so a band of 100 likely has several, and many don't know it or wouldn't turn on a setting in front of their section.
- **Options:** a color-blind mode (a setting); make sure color is never the only signal, everywhere; both.
- **Decision:** No mode. Color is never the only signal (a house rule in CLAUDE.md), checked by a test. An audit found the app already does this: too-big steps on the field are solid and thicker, the timeline's are underlined and clickable, Review's warnings have names, every dot has its letter, and printing is black on white. On the phone, the step size's color goes with its plain words ("very big step size"). Jason decided against adding "over the limit" there: performers don't know the limit, so the words are enough.
- **Color changes (Claude's call; Jason can veto):** simulating color blindness showed light mode's error red (#b3261e) and warning brown (#7a5200) looking almost the same (ΔE 5), and dark mode's error and "done" green close (ΔE 10). The error color is now coral red #ff756b in dark mode (was #ff8080) and crimson #bd1c3a in light mode (was #b3261e): the closest pairs are now about 15 apart, and the colors still read as red. A pure red can't stay clearly apart (20+) from both green and yellow for every kind of color blindness without turning pink, so the words do that job. `palette.test.ts` checks the pairs (12 on panels, 20 for field paths) in both modes.

## 2026-11-11: Panel buttons on the tools row
- **Who:** Jason Tiller
- **Context:** The timeline and sidebar show/hide buttons sat at the right end of the top toolbar row, next to Undo and Redo.
- **Decision:** They move to the right end of the second row (Snap to grid, Markup, Shape, and the rest), pinned there like Undo is on the first row, so they stay in reach if the row ever scrolls sideways. Undo and Redo stay on the first row.
- **Claude's call (Jason can veto):** with the two buttons added, the tools row no longer fit an iPad mini on its side (1090 px of buttons in 1024). On touch screens up to 1100 px wide, **Snap to grid** reads **Snap** and **Rotate & Scale** reads **Rotate** (they already did on an upright iPad mini), so the row fits again. **Add Performer** keeps its full name there.

## 2026-11-11: A white field in the editor
- **Who:** Jason Tiller (asked for it); details by Claude (Jason can veto)
- **Context:** Some drill writers would rather work on a white field with black lines and dots, like paper.
- **Options:** a white field for the editor only; for the editor and phones; tie it to light mode.
- **Decision:** **Layout → White field** (and **Green field** to switch back), remembered per browser, separate from light mode (any panel color with either field). Editor only for now: phones and the video stay green, and printing is already black on white. On white: black field lines, letters, and labels on a white edge; the selection keeps its gold fill with a field-dark ring and box (thin gold can't be read on white, as in light mode); shape guides and note highlights in the light-mode blue; props like paper. Step paths are unchanged: their dark casing reads on white as well as turf. A section's own color keeps its dark outline. `palette.test.ts` checks the white field's colors (text 4.5:1, lines 3:1).
- **Update (same day, Jason asked):** phones get it too: a **White field** toggle beside **Follow my dot** in the Field view (for staff as well), remembered on the phone (the same setting as the editor on one device, so the editor's Performer view matches). On white, my path and ring are field dark, the rest of the band is gray, and my neighbors black. Spanish: "Campo blanco".

## 2026-11-11: Fixes from a second outside review
- **Who:** Jason Tiller asked for them; the details are Claude's calls (Jason can veto).
- **Context:** Another AI reviewed FreeFORM. Claude checked its findings against the code: most held up. Jason asked for the confirmed ones to be fixed.
- **Decisions:**
  - **Revision on paper.** A show keeps a short fingerprint of the drill (`revisionSig`) when a revision goes out. Print compares it and says "rev 6 + changes" if the drill changed since. The fingerprint leaves out what performers don't see (dismissed warnings, the step limit, the tracing picture). Other option: print the published copy exactly; rejected because directors print drafts on purpose. Shows published before this just say "rev 6".
  - **Dismissed warnings.** A dismissal now records how bad the warning was (the step as N-to-5, the distance, the counts unwritten). It comes back only if it gets worse; getting better keeps it dismissed. Other option: come back on any change; rejected because nudging a dot would bring warnings back constantly. Dismissals saved before today match at any size, so nothing a director dismissed pops back on its own.
  - **Show files.** Turned away (not quietly repaired) when ids repeat, a performer is in a section that isn't there, a set has a spot for a performer who isn't in the show, or counts aren't whole numbers (1 or more for every move after the opening set). FreeFORM's own edits never make those, so a file with them is damaged or hand-made.
  - **Phone wording.** When a route bends more than half a step from a straight line, the card says "not a straight line (watch the move), ending up …". Spanish: "no es en línea recta (mira el movimiento), terminando …" until a Spanish-speaking director checks it. A route sketch on the card was the other option; left for later.
  - **Too close.** Moves with turning groups or follow-the-leader are checked 8 times a count instead of 2 (a straight move is already checked exactly). Each turning group's arcs are now worked out once per move instead of on every sample, so a 150-performer turning move checks in about 50 ms (it was about 170 ms with the finer checks alone), and phone playback of turns is faster too. Each move is only checked again when it changes.
  - **Not changed:** ⌘/Ctrl +/− still zoom the field (most drawing apps do); limiting it to when the field has focus is on PLAN.

## 2026-11-11: Zoom keys, Loop focus, and Watch on a card
- **Who:** Jason Tiller asked for all three; the details are Claude's calls (Jason can veto).
- **Zoom keys:** ⌘/Ctrl +, −, and 0 zoom the field while the mouse is over it, or while one of the field's zoom buttons has focus. Anywhere else the browser zooms the page, which people with low vision count on. Other option: only when the field itself has keyboard focus; rejected because the field can't take focus today, so the keys would almost never reach it. The zoom buttons' tooltips say "with the mouse over the field."
- **Loop panel:** uses the same dialog behavior as the editor's dialogs (focus in on open, Tab stays inside, Esc closes, focus back to **Loop**).
- **Watch:** a button under each My dots card whose route bends (the cards that say "watch the move"). It switches to **Field** and plays just the move into that set, once, then stops at the set; it skips the count-in, since it's for seeing the route, not rehearsing it. It's a separate button under the card, since the card itself is already a button (tap to go to that set). Only on bending routes for now, so it means something when it's there.

## 2026-11-11: The phone's status line, and a student guide
- **Who:** Jason Tiller asked for both; the details are Claude's calls (Jason can veto).
- **Status line:** one line at the top of **My dots** (and under the field) replaces the old revision line: "Ready offline · Revision 6 · checked for updates 3:42 PM". **Ready offline** appears only when both the show is saved and the offline files are installed (the service worker controls the page), so it's never a promise the phone can't keep. For a hosted link it says checking, offline, or couldn't check, each with "using the copy on this phone" and when it last checked. A **Check for updates** button sits under it in **My dots**. Under the field, the line stays on one line (cut off with "…" if it's long), so it never changes the field's height; the full line and the button are in **My dots**. The phone checks again by itself when signal comes back. Other option: a banner when offline; rejected because offline is normal at rehearsal, not an error.
- **Student guide:** a separate page, not a section of the director's guide, since students need five steps, not fifty. Written in docs/STUDENTS.md (and STUDENTS.es.md, a first-draft Spanish to be checked like the rest), built into freeformdrill.org/students/ and /es/students/ with the guide's own phone screenshots, and saved for offline use (the offline cache is now v10, so phones that already have FreeFORM pick it up). The phone links to it on its first screen and at the bottom of **My dots**. The **Español** / **English** button now sits there too, not just on the first screen, since a student who already has a show never sees the first screen again.

## 2026-11-11: A finished sample and a separate practice show
- **Who:** Jason Tiller asked for the split; the details are Claude's calls (Jason can veto).
- **Context:** The sample show doubled as the warnings demo (a too-fast move into set 4 and 24 unwritten counts), while the welcome note and guide called it a show to look around in. A new director couldn't tell a finished show from one with problems.
- **Decision:** One builder makes both. The **sample show** is finished: set 4 gets 16 counts (m. 9–12), and the Opener is 48 counts, so Review finds nothing (a test checks). The **practice show** is the same drill with three problems: two trumpets swap spots into set 3 and cut past F1 (too close), set 4 in 8 counts (steps over the limit), and a 64-count Opener (counts not written). Each problem's set has a note starting "Practice:" that says what's wrong and how to fix it; the too-close note names the performers from the show itself, so it stays true if the drill changes. **Help → Try the practice show** opens it as a show of its own. The front page and the blank field still offer only the sample. Screenshots of warnings (Review, step warnings, too close) come from the practice show; the rest from the sample. Other options: a guided lesson mode (bigger; part of the guided first show on PLAN), or a sample with warnings marked in the notes (still not "finished").

## 2026-11-11: Getting-started checklist, save status chip, and shape handles by keyboard
- **Who:** Jason Tiller chose all three, and Tab through every handle for #3; the details are Claude's calls (Jason can veto).
- **Checklist:** a card in the field's bottom-right corner, not a step-by-step wizard that takes over the screen, so experienced writers can ignore it. Six steps: put performers on the field, add the next set, move performers, watch the move, check for problems (Review opened and nothing left to fix), and send it to your band (Share opened, or the show published). Steps tick themselves off from the show itself where they can; Play, Review, and Share are remembered per show in this browser. Only the next step shows its how-to. It appears on shows that start blank in this browser (so not the sample, the practice show, or a file you open), hides while Review is open, **Fold** shrinks it to its title line, and **Hide** hides it for good on every show. Other options: a modal wizard (rejected: blocks the field and annoys Pyware users); showing it on every show (rejected: nags existing shows that never had it).
- **Save status chip:** one line in the top bar, "Browser ✓ · File: 2:14 PM · Phones: rev 6", that never wraps (cut off with "…" if the window is narrow, the full line in its tooltip), so the top bar's height never changes. File says the time of the last Save, **unsaved changes**, or **no changes**; Phones says the revision, **+ changes**, or **not published**. When something isn't saved somewhere it could be, it also gets a dashed outline (shape, not just color). Clicking it opens a sentence per layer with **Save**, **Save As…**, **Full backup…** (when it applies), and **Share…** or **Publish update…**. The time of the last file save is now kept per show in this browser.
- **Handles by keyboard:** Tab and Shift+Tab step through the open shape's handles, but only when nothing else has focus (after clicking the field or using a shape's shortcut key), so Tab still moves through buttons normally. Tab past the last handle goes on to the page. The handle gets a gold ring with a dark edge (it shows on the green field and the white one), and the note at the bottom of the field names it ("Arc, middle") and says where it is, for screen readers too. Arrows move 1 step (Shift 4, Option/Alt half), the same as nudging performers; Enter keeps; Esc puts it back where it was when picked (Esc again closes the shape, as before). Path points, follow-the-leader turns, and props are next.

## 2026-11-11: A calmer start for a new show
- **Who:** Jason Tiller (the checklist's timing was proposed by Claude; Jason picked how **New** starts)
- **Context:** After **New**, three things competed: the **Add** menu (opened by **New**, from before the blank field had its own note), the "Start your show" note, and the getting-started checklist at 0 of 6.
- **Options:** for **New**: Add Performer ready with the menu closed; the menu open with the note hidden; or plain Select with the note leading.
- **Decision:** **New** starts in Select, like any show, and the blank field's note leads (**Place performers**, **Import a roster…**, the sample, or a link).
- **Update (same day, Jason):** the note opens in the middle of the field, and the checklist is chosen, not pushed: the note has a **Getting started, step by step** button (and **Help** has **Getting started checklist** for any show). With the checklist on, a blank field's note becomes its step 1 (the four ways to begin as its buttons, steps 2 to 6 listed under it); **Close** turns it off for that show, replacing the earlier "Hide for good". While placing performers, the note leaves and the checklist moves to the bottom-right corner, so neither covers the middle of the field (Claude's call; Jason can veto).

## 2026-11-11: Props first, from the Start note
- **Who:** Jason Tiller (some writers place props before performers); placement details by Claude (Jason can veto)
- **Decision:** The blank field's **Start your show** note (and checklist step 1) has **Place a prop**, next to **Place performers**. It adds the same 8 by 8 prop as **Add**, then **Prop**, picked, with its box open in the sidebar. A new prop lands in the middle of the field, under where the note sits, so once a show has a prop the note docks at the top of the field instead of the middle.
- **Update (same day, Jason):** in the middle of an empty field the note is the welcome screen, so it carries the full FreeFORM Drill logo, centered above the text (light or dark to match the theme, and smaller in a short window). Docked at the top, it leaves the logo off to stay short (Claude's call).

## 2026-11-11: Getting started ends at Review; Send it to your band is its own checklist
- **Who:** Jason Tiller (the steps and the message by Claude; Jason can veto)
- **Context:** The getting-started checklist ended with "Send it to your band," which is a different job from writing a first move, done later and more than once.
- **Decision:** Getting started is five steps, ending at a clean Review, and when they're done it offers **Send it to your band**. That's a second checklist of the same kind, in **Help** (turning it on closes Getting started): check for problems (**Open Review**), get a link (**Open Share…**; done once Share has been opened, or the show is published), send it with the student guide (a ready-to-paste message with the published link, or a spot to paste one, plus the student guide in English and Spanish; done with **Copy the message**), and check phones at rehearsal ("What revision does everyone have?"; done with **Got it**). The message has no names or other private details, since it's meant to be pasted into a group text.

## 2026-11-11: A clearer Help menu, and Get a show back
- **Who:** Jason Tiller asked for both; the wording and layout are Claude's calls (Jason can veto).
- **Help menu:** three groups with small headings: **Learn** (How-to guide, Getting started checklist, Send it to your band, Get a show back), **Examples** (the sample and practice shows, each with a line saying what it is: "A finished 47-performer show to look around in" and "The same show with 3 problems to find and fix, explained in its notes"), and **FreeFORM Drill** (Send feedback, Support FreeFORM, About).
- **Get a show back:** a dialog, not a checklist, since only one case applies: "What happened?" with five cases, each with a sentence and the button that fixes it: **Undo** (greyed out when there's nothing to undo), **See earlier versions** (opens **Shows…** straight on the open show's versions), **Open Shows…**, **Import a file…** (with when the open show was last saved to a file), and **Open from a link or recovery code…**. "None of these?" offers **Send feedback**. It adds no new way to store anything; it's a map to what already exists.

## 2026-11-11: Save status at the bottom of the sidebar, quarter-step snapping, and Get a show back's last case
- **Who:** Jason Tiller (layout details by Claude; Jason can veto)
- **Save status:** moved from the top bar to the bottom of the sidebar, pinned there as the sidebar scrolls, with a line each for Browser, File, and Phones (the sidebar has room the top bar didn't, so nothing is cut off). The dashed outline and the panel it opens are unchanged; the panel opens upward. When the sidebar is closed, the status is too; the top bar is less crowded for it.
- **Snap to grid:** the choices read **Whole step**, **Half step**, **Quarter step** (new), and **Free**. The button beside it, which rounds the selected performers onto the grid, is renamed from **Apply** to **Snap selected** (Jason), so it says what it does; it uses the chosen grid, and with **Free** it rounds to whole steps, as its tooltip says.
- **Get a show back:** the last case reads "Something happened and I need to recover my show", explaining that a published show's phone link brings the whole show back, with **Open from a link or recovery code…**.

## 2026-11-11: Help's FreeFORM Drill buttons in green
- **Who:** Jason Tiller
- **Decision:** **Send feedback**, **Support FreeFORM**, and **About FreeFORM Drill** in **Help** use the same green button style as **Print…**, **Share…**, and **Video…** (the `primary` class, so they follow the palette in light and dark mode).

## 2026-11-11: The checklist card stands out
- **Who:** Jason Tiller (the colors by Claude; Jason can veto)
- **Context:** In the corner, the Getting started (and Send it to your band) card had the page's own background and a faint border, so it blended into the panels around it.
- **Decision:** It gets the same 2 px warning-yellow edge as the **Start your show** note (dark brown in light mode), the panel color one step lighter than the page (not the buttons' color, so its buttons still stand out), and a deeper shadow. The yellow edge is a shape cue as well as a color one.

## 2026-11-11: One palette for shadows, backdrops, and the field's ink
- **Who:** Jason Tiller asked for a consistent palette; the names and values are Claude's calls (Jason can veto).
- **Context:** An audit found the colors themselves came from the palette, but shadows were five sizes and three strengths of plain black, dialog backdrops were 50% or 60%, the readout over the field was hard-coded dark in light mode too, and the field drawing's whites, near-blacks, and tints were typed into the code.
- **Decision:** `palette.ts` gains `EFFECTS` / `EFFECTS_LIGHT` (shadow, a stronger shadow, the dialog backdrop, the play-range dimming, and the see-through readout over the field; light mode's are softer, a dark green-gray instead of black) and `FIELD` (the field's ink, the same in both modes). The page gets them as CSS variables, plus two shadow sizes: `--raise` (menus, notes, cards, the zoom box, a sidebar over the field) and `--lift` (dialogs, the Start your show note, the phone's sheet). Every shadow, backdrop, and field color now uses them; the readout under the field follows the theme (a light box with dark text in light mode). `palette.test.ts` checks the CSS variables match and fails on any loose hex or rgba color in the code or the page styles, print excepted. CLAUDE.md's "One palette" rule says so. Dark mode looks the same as before; light mode's shadows and the readout change.

## 2026-11-11: Turns, custom path points, and props by keyboard
- **Who:** Jason Tiller asked for them "like the shape handles"; the details are Claude's calls (Jason can veto).
- **Turns and points:** with a follow-the-leader group (or one performer's custom path, which is a group of one) selected, Tab and Shift+Tab step through its turns the same way they do a shape's handles, with the same gold ring, arrows, Enter, and Esc. The note names them "Follow the leader (G6 leads), turn 1" or "Custom path for P1, point 2". Tab only picks one when nothing else has focus, as with shapes. The shape handles and the turns share one piece of code.
- **Props:** with a prop picked (and no performers), the arrow keys move it 1 step (Shift 4, Option/Alt half), and the note says where its center is. Each prop's box under **Props** in the sidebar can be reached with Tab, and focusing it picks the prop, so it can be picked without a mouse. Turning stays in the typed **Turned** box rather than adding X / Y / angle boxes, since the arrows and **Turned** already cover moving and turning (the X / Y / angle idea is dropped).

## 2026-11-11: A first accessibility pass (screen reader and big text)
- **Who:** Jason Tiller asked for it before testing on his phone; the fixes are Claude's calls (Jason can veto).
- **How it was checked:** axe-core 4 (an automated checker) on the phone view (start, picking who you are, My dots, Field, the Loop panel) and the editor (main, Help, Review, Share, a blank show), in dark and light mode; the phone at 200% and 300% text, which is what Safari's aA does (it's page zoom, so it lays out like a narrower screen); and the accessibility tree VoiceOver reads.
- **Fixes:** the editor's menu panels were marked as menus (which promises arrow-key menu behavior they don't have) and sat outside any landmark; they're now labeled regions. The save status button's label hid its visible words from voice control; it now uses them. On the phone, the title, who-you-are, and button rows wrap when the text is big instead of running off the screen, and the name button can't be squeezed until the name disappears (at normal size nothing moves; the play buttons' gap went from 8 to 6 pixels so the row still fits on one line). For VoiceOver: My dots cards get hidden pauses between their parts and say "16 counts, measures 1 to 4" instead of "16 cts, m. 1–4"; the name button reads "Who are you? G6"; the field is described and points to the line with the set and spot. Spanish for the new spoken text is in es.ts.
- **Not changed:** the set-number strip under the field still scrolls sideways with a fade at the edge when it doesn't fit, by design.

## 2026-11-11: The front page's opening
- **Who:** Jason Tiller (wording); the Spanish is Claude's draft (Jason can veto).
- **Decision:** The heading is "FreeFORM Drill: Drill, without the bill." (lowercase "bill", as everywhere else; the separate italic tagline under it is gone, since the heading now says it). The opening paragraph: "FreeFORM Drill is a free drill design/teaching tool for marching band, drum corps, and indoor marching ensembles that runs in your web browser. Write the show on a computer or an iPad, watch every move count by count with your music, print dot sheets and drill charts, and send the drill to your students' phones. There's nothing to install, no account to make, and no license fee, for an ensemble of any size." The Spanish page matches, with the tagline left in English as before. The link-preview and search descriptions (the front page, its Spanish twin, and the editor page that show links open) now say the same thing.

## 2026-11-11 20:30 EST: Pick the surface when you start a show
- **Who:** Jason Tiller asked that the marching surface be chosen at the very beginning of a show; the details are Claude's *(Jason can veto)*.
- **Context:** The field menu sat in the sidebar under the title, so an indoor show started as a high school football field until you found it.
- **Other options:** Leave it in the sidebar and point to it from the Start note only; a full-screen first-run picker before the editor opens; radio buttons for all five choices in the New box instead of the same menu the sidebar uses.
- **Decision:** **New** (and **New show** under **Shows…**) opens a small **New show** box: **Title** and **Written on** (the same menu as the sidebar, with **Wide** and **Deep** for a custom floor), then **Start the show** or **Cancel**. It starts on the surface the last new show used, kept in this browser (`freeform:starting-field`, checked when read), so a guard director picks the floor once. A first visit still opens a blank show without asking, so the **Start your show** note on a blank field has the same **Written on** menu at its top; picking there also becomes the next new show's default. The menu and the floor size are one shared piece (`src/ui/FieldPicker.tsx`) in all three places. A blank title becomes "Untitled show".

## 2026-11-11 20:35 EST: Football field, then its hashes
- **Who:** Jason Tiller asked for one **Football field** choice with the hashes as a separate option; the layout is Claude's *(Jason can veto)*.
- **Context:** The field menu listed **High school**, **College / DCI**, and **NFL** beside **Basketball court** and **Custom floor**, mixing surfaces with hash levels.
- **Decision:** The **Field** menu is **Football field**, **Basketball court**, or **Custom floor**. Its details sit beside it in the New show box and the Start note, and on the row under the title in the sidebar: **Hashes** (**High school**, **College / DCI**, **NFL**) for a football field, **Wide** and **Deep** for a custom floor, nothing for a court. Going back to **Football field** from a floor uses the hashes the show had before. Changing **Hashes** under written drill still asks what should happen to it; switching surfaces never asks, since spots stay put in steps. The saved show is unchanged (`hash` and `surface`).

## 2026-11-12 06:20 EST: Save the share QR code as a picture
- **Who:** Jason Tiller asked for it, picturing a director's PowerPoint introducing the show and an email to students before rehearsal; the details are Claude's *(Jason can veto)*.
- **Context:** The Share dialog showed a QR code but gave no way to get it out of FreeFORM except a screenshot.
- **Other options:** only a PNG download; a full printable handout page (a PDF with instructions); a picture with the link written under it (long share links don't fit, and a hosted link written out shows its key).
- **Decision:** Under both QR codes (**Send this version** and **Keep phones up to date**): **Copy picture** (a PNG on the clipboard, where the browser allows it, since pasting into a slide or email is the fastest path), **Save picture** (a PNG about 1200 pixels across), and a smaller **SVG** button for posters and print. A box, checked to start, puts the show's title above the code and "Scan with your phone's camera" below it in English and Spanish (the students read it, and Spanish is a priority); unchecked, it's just the code. Black on white with the standard blank border, whatever the app's theme. A line under the buttons says anyone who can scan the picture can open the show. The guide recommends the **Keep phones up to date** code for slides (short link, big squares) and putting the link in emails as well, since a phone can't scan its own screen. The drawing is in `src/engine/qr.ts` (tested) and the buttons in `src/perform/QrExport.tsx`.

## 2026-11-12 08:15 EST: The FreeFORM logo in the middle of QR codes
- **Who:** Jason Tiller asked for it, like the brand logos in many QR codes; the details are Claude's *(Jason can veto)*.
- **Context:** A logo covers part of the code, so the code needs more error correction (spare data a scanner uses to fill in what it can't read). More error correction makes the code denser, with smaller squares.
- **Other options:** H error correction (rebuilds 30%: safest, but a typical published link goes from 41 squares across to 65); M (rebuilds 15%: 49 across, but it stopped scanning with a third of the width covered); a checkbox to turn the logo off; the FF monogram or the plain curve without its tile instead of the app icon.
- **Decision:** Q error correction (rebuilds 25%; 57 squares across for a typical published link), with the app icon (the curve on its rounded field-dark tile, Set 1's dot in gold) covering about 22% of the code's width, so about 5% of its area. Tested with the same reader the phone's scanner uses: it still reads with 38% of the width covered, so there's room for glare, a dirty screen, and an angle. A link too long for Q (a big **Send this version** link) gets the plain, densest-fitting code as before, with no logo. The logo is in the Share dialog's codes, the saved pictures (PNG and SVG), and the front page's sample-show code. No checkbox to turn it off, to keep the dialog simple; easy to add if a director asks. The colors are `QR_LOGO` in `palette.ts`.


## 2026-11-12 10:05 EST: FreeFORM Drill leads, FreeFORM follows
- **Who:** Jason Tiller wants "FreeFORM Drill" to be the dominant name, to avoid collisions with other Freeform products. Where each form goes is Claude's call *(Jason can veto)*.
- **Context:** The front page, the logos, and the editor's tab already said FreeFORM Drill, but the README, the guide, the student pages, the manifest, the feedback emails, and the messages directors send to students said only FreeFORM.
- **Other options:** FreeFORM Drill in every mention (long and clunky in running text and buttons: "FreeFORM Drill keeps a copy as you work"); keep the two mixed as they were.
- **Decision:** The way Microsoft Word is "Word" after the first mention. **FreeFORM Drill** in titles and headings (README, CONTRIBUTING, CLAUDE.md, the brand README, the How-to guide, both student pages, and their browser-tab titles), the manifest's name and description, copyright lines (LICENSE, README, both front pages), and anything that leaves the app: feedback emails (from "FreeFORM Drill feedback", subject "FreeFORM Drill Problem: …"), the message for the band, the recovery-code message and its email subject, the Save dialog's file type, and a video's default file name. Also the old-browser page's heading, the issue forms, and the first mention in each document. Plain **FreeFORM** stays in running text after that, in the app's own buttons and messages, and in code comments. Unchanged on purpose: the home-screen label (`short_name` and `apple-mobile-web-app-title` stay "FreeFORM", since phones cut a home-screen name at about 12 letters and "FreeFORM Dr…" reads worse), saved-data names (`.freeform`, `freeform-show`, `freeform:` keys), the brand's names for its parts (the FreeFORM curve and wordmark, the `freeform-*` files), and earlier DECISIONS.md entries and IDEA.md. The manifest's name was "FreeFORM Drill Design" and is now "FreeFORM Drill", matching the logo and the web address; offline cache bumped to `freeform-v11` so installed apps pick it up. The rule is in CLAUDE.md.

## 2026-11-12 12:25 EST: See the code on GitHub, in Help
- **Who:** Jason Tiller asked for a button in Help's FreeFORM Drill group that opens the GitHub repository. The name, the order, and the style are Claude's calls *(Jason can veto)*.
- **Other options:** "GitHub repository" or "Source code" (the front page's top link) as the name; putting it first in the group; a plain button instead of a gold one.
- **Decision:** **See the code on GitHub**, the same words as the front page's button, so it says where it goes without assuming anyone knows what a repository is. It's last in the group, after **About FreeFORM Drill**, since most directors will want feedback, support, or the front page before the code. Gold like the other three, so the group looks like one set. It opens github.com/Tillerdawg/freeform-drill in a new tab.

## 2026-11-12 12:35 EST: No code files that differ only in capitalization
- **Who:** Jason Tiller asked to fix it for good; the new name and the test are Claude's calls *(Jason can veto)*.
- **Context:** `src/ui/GettingStarted.tsx` (the checklist panel) sat next to `src/ui/gettingStarted.ts` (its steps). Linux treats those as two names, so the tests and the build passed, but a Mac treats them as one, so the editor crashed on load in the dev server ("does not provide an export named GettingStarted").
- **Other options:** rename the panel instead; merge the two files.
- **Decision:** The steps file is now `gettingStartedSteps.ts` (and its test `gettingStartedSteps.test.ts`). A new test, `src/engine/filenames.test.ts`, fails if two code files in one folder differ only in capitalization, so this can't come back unnoticed.

## 2026-11-12 12:55 EST: Keeping the README from going stale
- **Who:** Jason Tiller chose these two fixes (from Claude's list); the test's details are Claude's *(Jason can veto)*.
- **Context:** The README fell behind even though the house rules say to update it. Its roadmap repeated PLAN.md and kept an item PLAN had ticked off (the upload service), and its code map missed folders added in a big change (`src/i18n/`, `es/`).
- **Other options:** a once-a-month review that opens a PR when the README is off (not now; easy to add); a checkbox on pull requests (gets checked without reading); a test for the feature list (no test can tell whether a sentence describes the app).
- **Decision:** The README's roadmap is now one line pointing to PLAN.md, so there's only one copy to keep current. A new test, `src/engine/readme.test.ts`, fails if a folder in the repo (or in `src/`) is missing from the code map, or if a path the map lists doesn't exist. CLAUDE.md says both. The feature list stays a short summary, with the detail in the How-to guide.

## 2026-11-12 21:50 EST: "Add the score…" names MusicXML, not just MuseScore
- **Who:** Jason Tiller asked for the relabel; the wording is Claude's *(Jason can veto)*.
- **Context:** FreeFORM has read MusicXML, `.mxl`, and MIDI since 2026-11-02, but the Music menu's button said **Add the score (MuseScore)…** and its hint said the recording was "exported from MuseScore." Only the button's hover tip listed the other formats, and phones and tablets don't show hover tips, so Finale, Sibelius, and Dorico users had no way to know their exports work.
- **Other options:** list every format on the button (too long for the menu); "Add the score (MuseScore or MusicXML)…" (still leaves out MIDI and doesn't say MusicXML is what the other programs export).
- **Decision:** The button is now **Add the score…**, and the hint under it says the score can be MuseScore, MusicXML (exported from Finale, Sibelius, or Dorico), or MIDI. The hint also says the recording should be "made from" the score rather than "exported from MuseScore." The guide's "easy way" steps and the README's feature line say the same.

## 2026-11-13 09:40 EST: Repeats and endings played out, numbered in playback order
- **Who:** Jason Tiller chose playback-order numbering. How the marks are read and the wording of the note are Claude's calls *(Jason can veto)*.
- **Context:** MusicXML and MuseScore scores counted repeats and endings once through, with a warning to use the MIDI instead. That's a step toward importing only the score (see the one-file music idea), and it was already a trap for anyone whose recording plays the repeats.
- **Other options:** printed bar numbers, with extra syntax for the second time through (like "5–11 (2nd)"), since m. 5–11 happens twice; keep counting once through.
- **Decision:** Repeats (with play counts), 1st/2nd/3rd endings (including shared "1., 2." endings), D.C., D.S., al Fine, and al Coda are played out the way MuseScore plays them: no repeats after a jump unless the jump says to, and only the last ending after a jump. Bars are numbered in the order heard, the same as MuseScore's MIDI, so a set's **Measures** mean the same bars whichever file the score came from. A bar heard again takes the tempo written at that spot, as MuseScore plays it. In MusicXML, a D.C. or D.S. doesn't say where it plays to, so it's al Coda if the score has a To Coda, al Fine if it has a Fine, and to the end otherwise. MuseScore files use its own jump and marker labels. Marks that loop or run past 5,000 bars fall back to once through, with a note. The new code is `src/engine/repeats.ts`. When a score has repeats, the Music menu's note says how many bars it plays and gives one example from that score ("m. 13–19 here is written m. 5–11"), also when the score is added before its recording.

## 2026-11-13 10:05 EST: Rehearsal tracks from a MIDI score
- **Who:** Jason Tiller asked for it, starting with MIDI, and chose the name "rehearsal track," with a real recording kept as the option; he's fine with it sounding like a notation program's playback. The library, sound set, file format, and wording are Claude's calls *(Jason can veto)*.
- **Context:** Step one toward importing only the score. MIDI first, because it already lists every note and instrument; MusicXML and MuseScore files need note readers, which come next.
- **Other options:** smplr (MIT; plays from per-instrument sample files on a CDN, so not offline and not ours to host); js-synthesizer (FluidSynth, LGPL); MuseScore_General (MIT, but ~40 MB and only on MuseScore's servers); Sonivox (Apache-2.0, 1 MB, ringtone quality); storing WAV only (~10 MB a minute); rendering on every visit instead of storing.
- **Decision:**
  - **Engine:** spessasynth_core 4.4.10 (Apache-2.0), pinned, rendering in a Web Worker at 44.1 kHz stereo. It starts at the MIDI's time 0, not its first note, so the track lines up with the counts. It's scaled to a steady peak and gets 2 seconds of ring at the end. Checked: the stored track's first note lands within 1 ms of the raw render.
  - **Sounds:** GeneralUser GS 1.471 by S. Christian Collins, compressed to SF3 (31 MB to 7.3 MB) and kept in `public/sounds/` with its license (it allows use in software and asks sites to host their own copy). It's left out of the offline download (`precache.json`) and fetched the first time someone makes a track; the service worker keeps it after that.
  - **Storage:** compressed like Video does (AAC, else Opus, in an .m4a), about 1 MB a minute, or WAV when the browser can't. Stored like any recording, so Play, the waveform, Video, Full backup, and shared files with music work unchanged.
  - **Naming:** the show's music name is "Rehearsal track (score.mid)", which is how the menu tells it from a recording, with no new field in the show file.
  - **Menu:** **Make a rehearsal track** appears after a MIDI score is added. It becomes **Use a rehearsal track instead** when there's a recording, and **Make the rehearsal track again** once there's a track. The recording button reads **Use a real recording instead…** while a rehearsal track is in use.

## 2026-11-13 10:20 EST: Open-source credits (licenses.txt)
- **Who:** Jason Tiller asked for it, to be safe. The format and placement are Claude's calls *(Jason can veto)*.
- **Context:** Most open-source licenses ask that their copyright and license text go along with the code, and the site hands the bundled code to every visitor. The build's minifier drops almost all license comments, so the live site didn't carry the notices. One package, qrcode-generator, ships no license file at all (MIT, with its copyright in its code).
- **Other options:** a credits dialog inside the app (more code and design work for a page few people open); a hand-kept list (goes stale when a library is added); a plugin that keeps license comments in the bundles (scattered, not readable).
- **Decision:** The build writes `licenses.txt` from what's actually installed: every production dependency in `package.json` and theirs (type-only `@types/` packages ship no code and are skipped), each with its name, version, license, source address, and full license text. MPL-2.0 (mediabunny) asks for where its source is, so every entry gives one. A package with no license file gets the standard MIT text built from the copyright line in its code; anything else with no license text stops the build. The sound library (GeneralUser GS) is added by hand with its own license. It's opened from **Help → Open-source credits**, last in the FreeFORM Drill group, and the dev server serves it too. `credits.test.ts` checks every shipped package is credited, and CLAUDE.md says so for the next person adding a library.

## 2026-11-13 10:36 EST — MusicXML rehearsal tracks

- Jason asked for MusicXML and compressed MusicXML rehearsal tracks, with audio that follows the drill counts through repeats and endings. The playback details are Codex's choices, subject to Jason's review.
- FreeFORM already read the bar and tempo map from MusicXML. We considered adding a separate score converter, which would have to interpret repeats and tempo marks the same way as the count reader.
- The notes now use the same expanded bars and tempo map as the counts. The existing worker writes MIDI from that shared timing and renders it with the same instrument library. For rehearsal, it plays pitches, chords, ties, and standard drum-kit sounds with a steady note velocity. The tests compare rendered audio with the drill counts on both passes and in each ending.
- Chrome's AAC encoder and container added about 60 ms to the entrances in the test score. New rehearsal tracks use Opus in WebM where the browser can encode and play it, with WAV as the fallback. The saved Opus track's four entrances were within 14 ms of the expected counts.

## 2026-11-13 10:57 EST — Native MuseScore rehearsal tracks

- Jason asked for rehearsal tracks directly from `.mscz` files, with audio in sync through repeats and endings. The playback details are Codex's choices, subject to Jason's review.
- FreeFORM already used these files for counts. We considered an external MuseScore conversion step. The native reader now reads note pitches and ties as it builds the count map, and the existing browser renderer uses that same bar order and timing.
- For rehearsal, each staff uses its starting instrument with steady note velocity, and unpitched percussion uses a standard drum kit. A score saved in MuseScore 4.7.6 was checked against MuseScore's MIDI export. In Chrome, all four audio entrances through the repeat and both endings landed within 6 ms of the expected counts for both Opus and WAV.

## 2026-11-13 11:12 EST — Marching percussion for rehearsal tracks

- Jason asked for marching percussion that stays in sync through repeats and endings. The sound bank and mapping are Codex's choices, subject to Jason's review.
- The standard drum kit used different sounds for battery notes. We considered shipping the full MS Basic library. Instead, FreeFORM downloads a 1.4 MB subset when a rehearsal track uses marching snare, tenors, bass drums, or cymbals. It includes the older tenor and bass presets for scores using those key maps. The license and sample credits ship with the sounds.
- Identified marching parts use their battery presets. Other parts keep their usual sounds. Native MuseScore files can assign instruments by staff order when the part omits staff IDs. The renderer selects sounds without moving any notes. In Chrome, the four snare entrances from a MuseScore score and its MusicXML and MIDI exports landed within 4 ms of the expected counts.

## 2026-11-13 11:29 EST — Preview music sync

- Jason asked to keep the drill he mapped from the score and choose which holds to add. The preview and its wording are Codex's choices, subject to Jason's review.
- The app used to apply timing as soon as the score and recording were paired, add holds automatically, and fill blank measure labels. We considered a single switch for all holds.
- The preview shows the timing for each set and flags missing measures, mismatches, and gaps. Holds start unchecked and can be selected individually. Applying uses the previewed timing and adds only those holds. Existing movement lengths, set numbers, counts, and measure labels stay as written. New holds add counts to the timeline, and the preview shows the resulting arrival counts.

## 2026-11-13 11:42 EST — Independent Bézier handles on iPad

- Jason asked for independent handle edits with touch or Apple Pencil, a way back to smooth editing, and pinch zoom that leaves the shape in place. The control and its behavior are Codex's choices, subject to Jason's review.
- We considered using a long press on a handle. The Shape panel instead has an **Independent handles** toggle. Turning it off leaves the curve in place. The next drag of a round handle at a joint smooths that joint. Option-drag still moves a single handle.
- A second finger cancels an unfinished finger edit and starts the pinch. When a Pencil edit is underway, the pinch keeps the Pencil's work up to that point and stops the handle drag.

## 2026-11-13 13:40 EST — Logo on the guide pages

- Jason asked for the logo on the guide page (freeformdrill.org/guide/). The details below are Claude's choices, subject to Jason's review.
- The header's "FreeFORM Drill" text link is now the small logo, linking to the front page, in the same size and with the same light and dark versions as the front page header. We considered adding the logo beside the text, but the logo already says the name, and its alt text keeps it for screen readers.
- The student quickstart pages (students/ and es/students/) use the same page template, so they get the logo too. The Spanish page's logo links to the Spanish front page.
  
## 2026-11-13 12:17 EST — Preview earlier versions before restoring

- Jason asked to see the field and step through the sets of an earlier version before choosing whether to restore. The preview controls are Codex's choices, subject to Jason's review.
- The list used to offer Restore next to each timestamp. We considered opening the full editor temporarily. The list now opens a preview inside the same dialog, using the saved version's field, performers, props, and marks.
- Previous set, Next set, and the set menu browse the saved formations. Back to versions returns to the list. Restore keeps a copy of the current show before applying the previewed version as an undoable edit.

## 2026-11-13 15:27 EST — Backup due in Shows

- Jason asked for a **Backup due** label on each qualifying show, including closed shows. The label placement is Codex's choice, subject to Jason's review.
- The editor already tracks when each show first changed after its last file save. The library uses that timestamp and the editor's one-week rule. We considered using the library's most recent edit date, which would keep pushing the reminder back as a show is edited.
- **Later** still snoozes the field reminder for a day. The library label reports which shows need a file copy and clears on a file save. A new duplicate or a rename made while a show is closed starts tracking changes for that show.

## 2026-11-16 10:15 EST: Copy Side 1 → 2 copies step-offs and turning moves

- **Who:** Jason asked for the fix; the rules below are Claude's choices, *Jason can veto*.
- **Context:** Copy Side 1 → 2 copied spots, label sides, and follow-the-leader groups, but not delayed step-offs or turning moves (a PLAN follow-up since 2026-11-05). Side 2 marched straight with no warning, so a writer would only find out at rehearsal.
- **Options:** copy only what the copied side has and leave the other side's old settings; make the other side a true copy (its old step-offs and turns go); ask each time.
- **Decision:** A true copy, like the spots. Each partner takes its twin's step-off, or none if the twin has none. A turning group wholly on the copied side turns again as its partners, and the other side's old turning group for those performers goes. A turning group that crosses the 50 is left alone. An imported Pyware route is mirrored too, but only where it fits the partner's own two spots, so a partner who starts somewhere else marches straight instead of showing up in Review as a broken route.

## 2026-11-16 10:15 EST: Big shows drag smoothly (checks wait for the end of a drag)

- **Who:** Jason approved the work; the approach is Claude's, *Jason can veto*.
- **Context:** In a 250-performer, 40-set show, each step of a drag took about 160 ms from the mouse moving to the screen updating, with the CPU slowed 4× to stand in for a school Chromebook (about 6 frames a second). A profile showed the time going to work that didn't need to happen on every step: the timeline working out every move's biggest step, the autosave writing the whole show to storage, and Review and the close-call checks.
- **Options:** run the checks in a background worker; make each check faster; skip the checks during a drag and run them when it ends.
- **Decision:** Step sizes are kept per move until that move's two sets or the step limit change (like the close-call check already was). Review, the timeline's too-close warnings, **Move**'s too-close list, and the browser autosave use the "settled" show: a single edit comes through at once, but in a quick burst (a drag, a held arrow key) only the last one, 250 ms after things settle. Leaving the page in that moment saves the latest show. The same drag now takes about 40 ms a step (about 25 frames a second). A worker stays an option if bigger shows still need it.

## 2026-11-16 11:00 EST: A ? cheat sheet for keyboard shortcuts

- **Who:** Jason asked for it; the layout is Claude's choice, *Jason can veto*.
- **Context:** The shortcuts were only in the guide's table, which a Pyware switcher has to go looking for.
- **Options:** a dialog on **?**; a printable page; tooltips only.
- **Decision:** **?** (and **Help → Keyboard shortcuts**) opens one dialog with every shortcut, grouped (tools, selecting and moving, handles, playing, the field, the show). The list lives in one file, `src/ui/keyboardShortcuts.ts`; the guide's Keyboard shortcuts section uses the same groups, and a test fails if the two differ by a single row or if the shape keys stop matching the Shape menu.

## 2026-11-16 11:00 EST: Import OpenMarch .dots shows

- **Who:** Jason asked for it; how it reads the file and what comes over are Claude's choices, *Jason can veto*.
- **Context:** OpenMarch is a free, open-source drill program (AGPL). A director moving to FreeFORM Drill shouldn't have to re-enter a show. A .dots file is an SQLite database.
- **Clean-room:** Claude read OpenMarch's table and column names and how its fields, pages, and paths are laid out (facts about the file format, the same as the .3dj work), and wrote FreeFORM's reader from scratch. No OpenMarch code was copied, so FreeFORM stays MIT. Test files are built in the tests from FreeFORM's own table definitions; no OpenMarch show files are in the repo.
- **Options for reading SQLite:** ship sql.js (about 600 KB of WebAssembly, MIT); write a small read-only reader from SQLite's published file format.
- **Decision:** FreeFORM's own reader (`src/engine/sqlite.ts`, about 150 lines): no download for anyone who never imports, nothing new to credit, and it only reads tables. Its tests check it against real SQLite files made by Node's built-in SQLite (many rows, multi-page blobs, columns added later, damaged files). What comes over: pages as sets with OpenMarch's own names (0, 1, 1A, 2) so they match the director's OpenMarch printouts, counts (each page's beats up to the next page), measures, page notes, one section per OpenMarch section (split when a section uses two drill prefixes) with drill numbers and names, the field (a football field with the nearest of FreeFORM's hashes, or a floor of the same size), curved paths sampled count by count with even steps (kept only where they leave the straight line), and the show's recording, timed to the beats with OpenMarch's audio offset. Left out: midsets (OpenMarch's own playback doesn't use them yet), shapes, tags, colors, rotation, and the field picture.

## 2026-11-16 11:40 EST: Line up a band or studio recording with its score

- **Who:** Jason asked for it; how it works is Claude's choice, *Jason can veto*.
- **Context:** Pairing a score with a recording assumed the recording was made from the score, so a real band's or an arranger's recording drifted off the counts. The only other way was tapping every count (about 800 taps for a 7-minute show). Automatic beat finding agreed with the score only about half the time (see PLAN).
- **Options:** fully automatic alignment (matching the score to the recording's attacks with no taps); tap a few downbeats and trust the score's tempo between them; tap beat 1 of each bar, with the score placing the counts in between and each tap nudged onto the recording's attack.
- **Decision:** The last. **Line up the downbeats…** (in the preview and in **Music**) plays the recording while the director taps beat 1 of each bar: a quarter of the taps, and the easiest beat to feel. Taps can cover the whole piece or a stretch, and **Tap more bars…** adds to them (kept until the page is reloaded; the show file keeps only the resulting count timings, so the file format doesn't change). Each tap moves onto the strongest attack within 80 ms when one is clearly there, so tapping a little early or late doesn't matter. Between taps, counts follow the score (meter changes and odd bars come out right); before the first and after the last, they keep the pace of the nearest four tapped bars, as tapping counts keeps its last pace. The existing preview then shows the set timing and holds, and applies it.
- **Found on the way (Claude):** onsetStrength's frames run about 35 ms early: a sharp attack peaks when it's three-quarters of the way into the 1024-sample window. The line-up corrects for it. Also, **Tap counts…** had been opening behind the field (the Music menu sits inside the timeline's layer), so its Start button couldn't be clicked; it and the new tap screen now open over the whole page, as the preview does.

## 2026-11-16 13:10 EST: Fixes from a whole-repo audit

- **Who:** Jason asked for an audit and then for every finding to be fixed. He chose the six-month cleanup. The rest is Claude's call, *Jason can veto*.
- **Context:** An audit of the repo and the web service turned up one real data-loss risk, a capacity limit on publishing, untested service code, loose checks on show files, and some housekeeping.
- **Big shows and the autosave:** localStorage holds about 5 MB. A big show (a large band with many curved moves) can pass that, and when it did, the write failed and the *old* copy stayed, so a reload opened a stale show. Options: compare timestamps between localStorage and the library on every load; stop using localStorage for the show at all; take the old copy out when the new one doesn't fit. **Decision:** the last, as the smallest change. When the show doesn't fit, the old copy comes out, `freeform:autosave-id` names the show, and a reload (and the editor's performer preview) opens it from the library instead. The library copy is then kept at once, not 0.8 seconds later. The "not saved" note now shows only when the library itself fails, since that's the only time the work isn't safe.
- **Publishing capacity (Jason):** shows nobody opens or updates for six months are deleted, down from a year: a season fits, and the 1 GB free storage turns over twice as fast. Other options were a smaller per-show limit (12 MB) or both. Also (Claude): "last opened" is noted at most weekly instead of daily, saving KV writes, and the "couldn't store" message says the service may be out of room or past its daily limit, instead of "full for today."
- **Service tests (Claude):** `services/api/index.test.ts` runs the service's front door against a stand-in for Cloudflare: publishing, updating, and removing only with the right token, a token for one show not working on another, other sites turned away, the daily cleanup, and feedback.
- **Show-file checks (Claude):** ids that are built-in object names (`__proto__`, `constructor`, and the like) are turned away, and every "is this performer in the set" check looks only at the set's own entries. A crafted file could otherwise point a set's positions at the object itself. The checks moved from `show.ts` into `src/engine/showFile.ts`; `show.ts` still exports `parseShow`, so nothing that imports it changed.
- **Smaller fixes (Claude):** forgetting a show no longer deletes a recording another kept show uses when that show doesn't open (the ids are read from its raw text, and if a kept show isn't readable at all, nothing is deleted). Unpacking a share link or locked file stops at 40 MB, and a hosted file the server says is bigger isn't downloaded. The SQLite reader turns away a row claiming more bytes than the whole file. The SQLite test fixture builds its database in one transaction (it took 6 seconds and timed out on slower computers).
- **Housekeeping (Claude):** decisions from before November 10 moved, as written, to `docs/decisions/2026-10.md` and `docs/decisions/2026-11.md`; this file had reached 292 KB, and every session that reads it pays for that. On Jason's computer: merged local branches deleted, branch names already gone from GitHub pruned, and a stale git lock from November 4 and leftover temp objects removed.

## 2026-11-16 14:30 EST: FreeFORM never opens locked or encrypted Pyware files

- **Who:** Jason asked for it, after a Reddit commenter warned that `.3dj` files can be encrypted and importing them can cause legal trouble. How it's detected and the wording are Claude's choices, *Jason can veto*.
- **Context:** Pyware lets drill writers lock a show so a buyer needs a key to edit or print it, and newer Pyware versions may encrypt their files. FreeFORM's reader has never decrypted anything: Jason's 2008 to 2010 files are plain blocks. But a locked or encrypted file would have been called "damaged" or "not a Pyware file," which hides why and invites people to keep trying.
- **Options:** leave the messages as they were; try to read newer files' encryption (rejected: getting around a lock or encryption is what the DMCA's anti-circumvention rule is about, and locked drill is how drill writers get paid); detect files that look encrypted and say so plainly.
- **Decision:** The last. `looksScrambled` in `src/engine/pyware.ts` measures how random a file's first 64 KB looks. Jason's real files measure about 5 bits per byte; encrypted or compressed data is close to 8, and the cutoff is 7.5 (a zip header counts too). When a `.3dj` can't be read and looks scrambled, the director sees `LOCKED_MESSAGE`: it looks locked or encrypted, FreeFORM doesn't unlock or decrypt drill, ask the drill writer for an unlocked copy, or tell Jason which Pyware version saved your own show. The policy is stated in the guide and on the front page (English and Spanish).
- **Known limit:** no locked file has been seen yet. If Pyware's lock only sets a flag and leaves the data readable, FreeFORM would still import it. Once Jason has a locked file (or a Pyware 9 or newer one), check how the lock is stored and refuse it by its flag. The 9 zero bytes in the `PRPT` block at the top of Jason's files are one place to look, but that's a guess.

## 2026-11-17 07:21 EST: Triangle props

- **Who:** Jason asked for a triangle alongside the rectangle and the oval. How it's stored, drawn, and picked are Claude's choices, *Jason can veto*.
- **Context:** Props were a rectangle, or an oval when `round` was on (a **Round** checkbox). A third shape doesn't fit a checkbox.
- **Options for the file:** replace `round` with one `shape` field (cleaner, but every saved show and share link with an oval would need converting, and older copies of FreeFORM would misread new files); keep `round` and add `triangle: true`.
- **Decision:** The second. Ovals are saved exactly as before, so nothing old changes, and a copy of FreeFORM from before today opening a show with a triangle draws it as a rectangle rather than refusing the file. `parseShow` turns away a prop marked both `round` and `triangle`. In the sidebar, **Round** became a **Shape** menu: **Rectangle**, **Oval**, **Triangle**.
- **The shape (Claude):** an isosceles triangle that fills its **Wide** by **Deep** box: the flat side is the full width at the front, the point is at the back, and **Turned** points it anywhere else. It turns around the middle of its box, like the other shapes, so its center readout and arrow keys work the same. Its name sits at the triangle's centroid (a third of the way up from the flat side), where there's room for it, instead of up near the point.
- **Also (Claude):** the guide's Props screenshot was cut off by the save-status panel at the bottom of the sidebar (the **Round** row was half hidden). The screenshot script now scrolls the prop box clear of it, so the new **Shape** menu shows.

## 2026-11-17 09:11 EST: Triangles of any shape

- **Who:** Jason asked for triangles that aren't regular. How it works is Claude's choice, *Jason can veto*.
- **Context:** Triangle props were always isosceles, with the point in the middle of the width. Real platforms and wedges are often right triangles or lopsided.
- **Options:** a menu of kinds (even, right, lopsided); three side lengths; three corners dragged on the field; one setting for where the point sits along the width.
- **Decision:** The last. **Point** (shown for triangles, in steps from the left corner) slides the point anywhere from over the left corner to over the right. With the longest side as the flat side, the point always lands over that side, so this one number, with **Wide**, **Deep**, and **Turned**, reaches every triangle there is. The file stores it as `point`, a share of the width from 0 to 1 (missing means the middle, so this morning's triangles are unchanged); making the prop wider or narrower keeps the triangle's proportions. Switching away from **Triangle** drops it. `parseShow` turns away a `point` outside 0 to 1. The name sits at the triangle's centroid, which moves with the point.
- **Not done yet:** typing three side lengths (what a builder's drawing gives you) and having FreeFORM work out **Wide**, **Deep**, and **Point**. Easy to add if directors ask.

## 2026-11-17 09:20 EST: Props to exact measurements: three side lengths, and feet

- **Who:** Jason asked for another way to make props to specific lengths. What it is, and how it works, are Claude's choices, *Jason can veto*.
- **Context:** A triangle's **Wide**, **Deep**, and **Point** describe it, but a builder's drawing gives side lengths, in feet. Turning three sides into a height and a point position by hand is trigonometry nobody should have to do at rehearsal.
- **Options:** a separate "make a prop from measurements" dialog; side lengths as a second, always-live view of the same triangle; drawing corners on the field.
- **Decision:** For triangles, a **Sides** row (**Flat**, **Left**, **Right**) under **Point**. It shows the triangle's current sides and takes new ones: change one and the other two stay put, and **Wide**, **Deep**, and **Point** follow. Sides apply on Enter or leaving the box (not on every keystroke), since half-typed lengths usually aren't a triangle. If the sides can't make one, or the point would land past the end of the flat side, a note says why and the prop doesn't change. The math is `triangleSides` and `triangleFromSides` in `show.ts`, with tests (including a 3-4-5 right triangle).
- **Feet:** a **Sizes in** menu (steps or feet) at the top of the Props list switches every prop size box (**Wide**, **Deep**, **Point**, **Sides**) to feet, at 22.5 inches to the step, shown to two decimals. It's this computer's choice (`freeform:prop-units` in localStorage), not saved in the show: files and links always store steps, so nothing about the file format changes and a show looks the same everywhere.

## 2026-11-17 09:32 EST: Triangles are set by Side 1, Side 2, and Side 3

- **Who:** Jason found "Point," "Flat," "Left," and "Right" unclear and asked for side length 1, 2, and 3 instead. The details are Claude's choices, *Jason can veto*.
- **Context:** A triangle had two overlapping sets of boxes (**Wide**, **Deep**, **Point**, then **Flat**, **Left**, **Right**), and only worked when the longest side was the flat one.
- **Decision:** A triangle's box now shows only **Side lengths** **1**, **2**, and **3** (plus **Shape** and **Turned**, which moved up beside the name). **Wide**, **Deep**, and **Point** are gone for triangles; rectangles and ovals keep **Wide** and **Deep**. Any order works: side 1 always runs along the front until it's turned, and when the corner across from it leans out past an end of side 1, the triangle leans that way (the file's `point` can now be below 0 or past 1; `parseShow` checks the whole triangle is at most 200 steps across). A triangle's center is the middle of the box around it, so turning and the center readout behave like any other prop. While a triangle is picked, the field shows a small 1, 2, and 3 beside its sides, so the numbers in the sidebar have something to point at (not on printed charts).
- **Typing three new lengths (Claude):** entering new sides one box at a time often passes through lengths that aren't a triangle yet (16, then 28, then 16). Instead of refusing the middle one, the boxes keep what was typed, a note says why it isn't a triangle yet, and the prop changes once all three fit; **Put them back** drops the typed lengths.
- **Replaces** the Point box and the Flat/Left/Right row from earlier today (never released). This morning's `triangle` and `point` fields keep their meaning for any triangle saved since, so nothing breaks.

## 2026-11-17 09:40 EST: Prop sizes in inches instead of feet

- **Who:** Jason.
- **Decision:** **Sizes in** offers **steps** or **inches** (it was steps or feet). Inches are figured at 22.5 to the step and shown to two decimals; **Wide** and **Deep** step by 1 inch on the arrows. Still this computer's choice (`freeform:prop-units` is now `inches` or `steps`; a leftover `feet` from this morning's unreleased build reads as steps), and shows still store steps.

## 2026-11-17 11:55 EST: A docs checkup

- **Who:** Jason asked whether the README, the guide, and the other documents were current, then for everything found to be fixed. What counted as a fix is Claude's call, *Jason can veto*.
- **What was checked:** the tests that guard the docs (the README's code map, every guide picture used and present, the shortcut tables), every bold button name in the guide and README against the code, and every screenshot, retaken and compared with the one in the repo.
- **Fixed:**
  - The README's Props line now says what props can be (rectangles, ovals, or triangles from three side lengths, in steps or inches). It also mentions the **?** shortcut list and that FreeFORM never opens locked or encrypted Pyware drill, since that's a policy and not just a feature.
  - The Sections help in the sidebar still said to add a section "from Add Performer(s) (New section)." It now says **Add ▾**, **Create New Section**, which is what the menu says.
  - Screenshots: **coordinates** and **trace** still showed the old field menu (before **Football field** and **Hashes** were split), and **send-band** still had "FreeFORM" where the message now says "FreeFORM Drill." **Sections** and **roster** also needed retaking, because the Hashes row pushed their headings down and the crop stopped at the save-status panel. The script now scrolls the sidebar before taking those three (the same way it does for Props), and they show more rows than before. The other pictures didn't change apart from dates and rendering, so they were left alone.
  - This morning's prop entries had headings that didn't match when the work was done (one said 10:05 for work committed at 09:32), so the inches entry looked out of order. They now use the commit times from Jason's git history.
  - PLAN.md's first milestone listed performer icons, which were taken out on 2026-11-07.
