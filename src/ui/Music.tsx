import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { secondsAt, type Midi } from '../engine/midi';
import { parseScore } from '../engine/musicxml';
import { synced } from '../engine/music';
import { newId, showLength, tooBigForBackup, type Show } from '../engine/show';
import type { RehearsalSource } from '../engine/scoreMidi';
import { deleteAudio, getAudio, putAudio } from './audioStore';
import { makeRehearsalTrack } from './rehearsalTrack';
import { Menu } from './Toolbar';
import { NumberField } from './NumberField';
import { useDialog } from './useDialog';
import { MusicSyncPreview } from './MusicSyncPreview';
import { LineUpDialog } from './LineUp';
import type { Downbeat } from '../engine/lineup';

interface Props {
  show: Show;
  setShow: (f: (s: Show) => Show) => void;
  audio: HTMLAudioElement | null; // null: this browser doesn't have the show's recording
  onAudio: (id: string) => void; // a recording was stored under this id
  useMusic: boolean;
  setUseMusic: (on: boolean) => void;
}

type Score = { name: string; map: Midi };
type PendingSync = { score: Score; audioName: string; warning?: string; downbeats?: Downbeat[] } & ({ blob: Blob } | { audioId: string });

/** The score and recording can be loaded in either order. Pairing them opens a preview before syncing. */
export function MusicMenu({ show, setShow, audio, onAudio, useMusic, setUseMusic }: Props) {
  const file = useRef<HTMLInputElement>(null), scoreFile = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const [tapping, setTapping] = useState(false);
  const [score, setScore] = useState<(Score & { source?: RehearsalSource }) | null>(null);
  const [working, setWorking] = useState('');
  const [preview, setPreview] = useState<PendingSync | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Lining up a real recording: the bars tapped so far (this visit only), and the tap screen while it's open.
  const [lining, setLining] = useState<{ pending: PendingSync; blob: Blob } | null>(null);
  const [tapped, setTapped] = useState<{ key: string; downbeats: Downbeat[] } | null>(null); // kept so the next visit adds to them
  const pairKey = (scoreName: string, audioName: string) => `${scoreName}\u0000${audioName}`;
  const earlierFor = (scoreName: string, audioName: string) => (tapped?.key === pairKey(scoreName, audioName) ? tapped.downbeats : undefined);
  const currentShow = useRef<Show | null>(show);
  useEffect(() => {
    currentShow.current = show;
    return () => { currentShow.current = null; };
  }, [show]);
  const m = show.music, total = showLength(show);
  const startPreview = (pending: PendingSync) => { setError(''); setPreview(pending); };

  const load = async (f: File) => {
    setWorking('Opening the recording…');
    try {
      if (score) {
        const length = await duration(f);
        if (currentShow.current) startPreview({ score, audioName: f.name, blob: f, warning: pairWarning(length, score.map) });
        return;
      }
      const id = newId('a');
      if (!(await putAudio(id, f))) { setNote(storageError); return; }
      const active = currentShow.current;
      if (!active) { deleteAudio(id); return; }
      // Reopening the same recording on another computer keeps its timings.
      const keep = active.music?.name === f.name;
      setShow((s) => ({ ...s, music: { name: f.name, audioId: id, taps: keep ? s.music?.taps ?? [] : [] } }));
      onAudio(id);
      const big = tooBigForBackup('audio', f.size); // said now, not discovered when the show moves to another computer
      setNote(`${keep ? 'Loaded. Your counts still apply.' : `Loaded ${f.name}. Now add its score, or tap the counts.`}${big ? ` ${big}` : ''}`);
    } finally {
      setWorking('');
    }
  };

  const addScore = async (f: File) => {
    setWorking('Reading the score…');
    try {
      const { rehearsal: source, ...map } = await parseScore(await f.arrayBuffer());
      const active = currentShow.current;
      if (!active) return;
      const next = { name: f.name, map, source };
      setScore(next);
      if (active.music && audio) {
        startPreview({ score: next, audioName: active.music.name, audioId: active.music.audioId, warning: pairWarning(audio.duration, map) });
      } else {
        setNote([`Score added: ${f.name}.`, ...(map.warnings ?? []), source ? 'Make a rehearsal track, or add the recording made from this score.' : 'Now add its recording (mp3).'].join(' '));
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "That score file couldn't be read.");
    } finally {
      setWorking('');
    }
  };

  const makeTrack = async () => {
    if (!score?.source || working) return;
    setWorking('Getting the instrument sounds…');
    try {
      setNote('');
      const blob = await makeRehearsalTrack(score.source, score.map, (step, f) => {
        const pct = `${Math.round(f * 100)}%`;
        setWorking(step === 'instruments' ? `Getting the instrument sounds… ${pct}` : step === 'playing' ? `Playing the score… ${pct}` : 'Preparing the track…');
      });
      if (currentShow.current) startPreview({ score, audioName: rehearsalName(score.name), blob });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "The rehearsal track couldn't be made.");
    } finally {
      setWorking('');
    }
  };

  const apply = async ({ sets, taps }: { sets: Show['sets']; taps: number[] }) => {
    if (!preview || saving) return;
    const active = currentShow.current;
    if (!active) return;
    setSaving(true);
    setError('');
    try {
      const audioId = 'audioId' in preview ? preview.audioId : newId('a');
      if ('blob' in preview && !(await putAudio(audioId, preview.blob))) {
        setError(storageError);
        return;
      }
      if (currentShow.current !== active || ('audioId' in preview && active.music?.audioId !== audioId)) {
        if ('blob' in preview) deleteAudio(audioId);
        setError('The show changed while applying the sync. Review it again or reopen the preview.');
        return;
      }
      // Keep the earlier audio available to Undo and earlier versions.
      setShow((s) => ({ ...s, sets, music: { name: preview.audioName, audioId, taps } }));
      if ('blob' in preview) onAudio(audioId);
      setNote(`Music sync applied from ${preview.score.name}.`);
      setPreview(null);
    } finally {
      setSaving(false);
    }
  };
  /** Open the tap screen for this pairing: the recording from the preview, or the show's own stored one. */
  const lineUp = async (pending: PendingSync) => {
    const blob = 'blob' in pending ? pending.blob : await getAudio(pending.audioId);
    if (!blob) { setNote("The recording isn't in this browser. Add it again to line it up."); return; }
    setPreview(null);
    setLining({ pending, blob });
  };
  const rehearsal = !!m && isRehearsal(m.name);
  const label = !m ? 'Music' : synced(m) && useMusic && audio ? '♪ Music' : 'Music';
  const done = (ok: boolean) => (ok ? '✓ ' : '');
  return (
    <>
      <Menu label={label} pressed={!!(m && synced(m) && useMusic && audio)} title="Play the drill with the show's recording">
        {(close) => <>
          {!m && <p style={{ margin: 0, fontSize: 12, maxWidth: 320 }}>Add a MuseScore (.mscz), MusicXML, or MIDI score to make a rehearsal track. If you have a recording made from the score, add both in either order to sync the counts. To use a recording on its own, tap the counts.</p>}
          {m && <p style={{ margin: 0, fontSize: 12 }}><strong>{m.name}</strong><br />
            {m.taps.length ? `${m.taps.length} of ${total + 1} counts placed${m.taps.length < total + 1 ? '; later counts keep the last pace' : ''}.` : 'No counts yet: add the score, or tap them.'}</p>}
          {m && !audio && <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--warn)' }}>{rehearsal ? "The rehearsal track isn't in this browser. Add the score again and make the track to hear it." : `The recording isn't in this browser. Add ${m.name} again to hear it.`}</p>}
          <button disabled={!!working} onClick={() => scoreFile.current?.click()} title="MuseScore (.mscz), MusicXML (exported from Finale, Sibelius, or Dorico), .mxl, or MIDI. Each set's counts are placed in the measures typed for it.">
            {done(!!score)}{score ? `Score: ${score.name}` : m?.taps.length ? 'Add the score again…' : 'Add the score…'}</button>
          <button disabled={!!working} onClick={() => file.current?.click()}>{done(!!m && !!audio && !rehearsal)}{rehearsal ? 'Use a real recording instead…' : m ? 'Replace the recording…' : 'Add the recording (mp3)…'}</button>
          {score?.source && <button disabled={!!working} onClick={makeTrack} title="FreeFORM plays the score with General MIDI instruments. The counts follow the same repeats, endings, and tempos.">
            {done(rehearsal && !!audio)}{rehearsal ? 'Make the rehearsal track again' : m ? 'Use a rehearsal track instead' : 'Make a rehearsal track'}</button>}
          {working && <p role="status" aria-live="polite" style={{ margin: 0, fontSize: 12 }}>{working}</p>}
          {m && audio && score && <button disabled={!!working} onClick={() => { const downbeats = earlierFor(score.name, m.name); startPreview({ score, audioName: m.name, audioId: m.audioId, downbeats, warning: downbeats ? undefined : pairWarning(audio.duration, score.map) }); }}>Preview music sync…</button>}
          {m && audio && score && !rehearsal && <button disabled={!!working} onClick={() => { close(); lineUp({ score, audioName: m.name, audioId: m.audioId, downbeats: earlierFor(score.name, m.name) }); }}
            title="For a band or studio recording that wasn't made from the score: tap beat 1 of each bar, and FreeFORM places the rest from the score">Line up the downbeats…</button>}
          {m && <button disabled={!audio || !!working} onClick={() => { setTapping(true); close(); }}>Tap counts…</button>}
          {m && synced(m) && <label style={{ fontSize: 13 }}><input type="checkbox" checked={useMusic} onChange={(e) => setUseMusic(e.target.checked)} /> Play with music (off: use Tempo)</label>}
          {m && <button disabled={!!working} className="danger" onClick={() => { setShow((s) => { const { music: _, ...rest } = s; return rest; }); setNote(''); }}>Remove music</button>}{/* the recording stays until nothing can bring it back (Undo, a version): see sweepFiles */}
          {note && <p role="status" style={{ margin: 0, fontSize: 12, maxWidth: 320 }}>{note}</p>}
        </>}
      </Menu>
      <input ref={file} type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ''; }} />
      <input ref={scoreFile} type="file" accept=".mscz,.mscx,.mid,.midi,audio/midi,.musicxml,.xml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addScore(f); e.target.value = ''; }} />
      {preview && <MusicSyncPreview show={show} map={preview.score.map} scoreName={preview.score.name} audioName={preview.audioName} warning={preview.warning}
        downbeats={preview.downbeats} onLineUp={isRehearsal(preview.audioName) ? undefined : () => lineUp(preview)}
        saving={saving} error={error} onApply={apply} onCancel={() => setPreview(null)} />}
      {lining && <LineUpDialog blob={lining.blob} map={lining.pending.score.map} earlier={lining.pending.downbeats ?? []} onDone={(r) => {
        const { pending } = lining;
        setLining(null);
        if (!r) { startPreview(pending); return; } // back to the preview as it was
        setNote(`Lined up at ${r.downbeats.length} ${r.downbeats.length === 1 ? 'bar' : 'bars'}${r.tapped ? `; ${r.snapped} of ${r.tapped} new taps moved onto the recording's beat` : ''}.`);
        setTapped({ key: pairKey(pending.score.name, pending.audioName), downbeats: r.downbeats });
        startPreview({ ...pending, warning: undefined, downbeats: r.downbeats });
      }} />}
      {tapping && audio && m && <TapDialog audio={audio} total={total} kept={m.taps} onDone={(taps) => { setTapping(false); if (taps) setShow((s) => (s.music ? { ...s, music: { ...s.music, taps } } : s)); }} />}
    </>
  );
}

/**
 * Play the recording and tap (Space, Enter or the big button) on every count: from the top, or from count `from` to
 * redo part of it. Counts before `from` keep their earlier taps; the playback starts 2 counts' worth of time before it.
 */
function TapDialog({ audio, total, kept, onDone }: { audio: HTMLAudioElement; total: number; kept: number[]; onDone: (taps: number[] | null) => void }) {
  const [from, setFrom] = useState(0); // the count the next tap is (redo from here); kept[0..from-1] stay
  const [taps, setTaps] = useState<number[]>([]); // new taps, for counts from, from+1, …
  const [running, setRunning] = useState(false);
  // Redoing a passage: the old taps after it stay too, if they still come after the last new one.
  const after = kept.slice(from + taps.length), keepAfter = from > 0 && taps.length > 0 && after.length > 0 && after[0] > taps[taps.length - 1];
  const all = [...kept.slice(0, from), ...taps, ...(keepAfter ? after : [])];
  const tapped = from + taps.length; // counts tapped so far in this pass, for the button and readout
  const allRef = useRef(all);
  allRef.current = all;
  const floor = from ? kept[from - 1] : -Infinity; // a new tap must come after the last kept one
  const tap = () => { if (running) setTaps((t) => (audio.currentTime <= (t.length ? t[t.length - 1] : floor) ? t : [...t, audio.currentTime])); };
  const start = (at: number) => { audio.currentTime = Math.max(0, at); audio.play().then(() => setRunning(true), () => setRunning(false)); };
  const lead = from >= 2 ? kept[from - 1] - (kept[from - 1] - kept[from - 2]) * 2 : 0; // two counts before the redo starts
  const canRedo = kept.length >= 2;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); tap(); }
    };
    window.addEventListener('keydown', key, true); // before the editor's own shortcuts (Space = play)
    return () => window.removeEventListener('keydown', key, true);
  });
  useEffect(() => () => audio.pause(), [audio]);
  const dialog = useDialog(() => { audio.pause(); onDone(null); });
  const n = all.length;
  return createPortal( // above the field: the Music menu sits inside the timeline's own layer, which would hide it
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Tap counts" style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'grid', placeItems: 'center', zIndex: 30, whiteSpace: 'normal' }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: 20, width: 440, maxWidth: 'calc(100vw - 32px)' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Tap the counts</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13, opacity: 0.85 }}>
          Press <strong>Space</strong> (or the button) on every count, starting with count {from}{from ? '' : ', where set 1 stands'}. Keep tapping as long as you
          like: counts past your last tap keep its pace. Small misses are fine; you can undo a tap or start over.
        </p>
        {canRedo && !running && !taps.length && (
          <label style={{ display: 'block', margin: '0 0 10px', fontSize: 13 }}>Redo from count{' '}
            <NumberField aria-label="Redo from count" min={0} max={kept.length} integer value={from} style={{ width: 64 }} onValue={setFrom} />
            {' '}<span style={{ opacity: 0.8 }}>(counts before it keep their taps; you've tapped {kept.length})</span>
          </label>
        )}
        <button onPointerDown={(e) => { e.preventDefault(); tap(); }} disabled={!running} className="primary"
          style={{ width: '100%', height: 96, fontSize: 28, fontWeight: 700 }}>
          {running ? (taps.length ? `Count ${tapped - 1}` : `Tap on count ${from}`) : 'Press Start'}
        </button>
        <p style={{ margin: '8px 0', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {n} of {total + 1} counts tapped{tapped > 1 ? ` · last count ${(all[tapped - 1] - all[tapped - 2]).toFixed(2)} s (${Math.round(60 / (all[tapped - 1] - all[tapped - 2]))} bpm)` : ''}
          {keepAfter ? ` · counts ${tapped}–${n - 1} keep their earlier taps` : from > 0 && taps.length ? ` · earlier taps after count ${tapped - 1} are replaced` : ''}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!running && <button className="primary" onClick={() => { setTaps([]); start(from ? lead : 0); }}>{taps.length ? (from ? `Start again from count ${from}` : 'Start over') : from ? `Start from count ${from}` : 'Start'}</button>}
          {running && <button onClick={() => { audio.pause(); setRunning(false); }}>Pause</button>}
          {!running && taps.length > 0 && <button onClick={() => start(Math.max(0, taps[taps.length - 1] - 2))} title="Back up 2 seconds before your last tap and keep going">Resume</button>}
          <button disabled={!taps.length} onClick={() => setTaps((t) => t.slice(0, -1))}>Undo last tap</button>
          <span style={{ marginLeft: 'auto' }} />
          <button onClick={() => { audio.pause(); onDone(null); }}>Cancel</button>
          <button className="primary" disabled={n < 2 || !taps.length} onClick={() => { audio.pause(); onDone(allRef.current); }}>Done</button>
        </div>
      </div>
    </div>, document.body,
  );
}

/** A recording's length in seconds, from its metadata (null if the browser can't tell). */
function duration(f: Blob): Promise<number | null> {
  return new Promise((ok) => {
    const a = new Audio(), url = URL.createObjectURL(f);
    const done = (v: number | null) => { URL.revokeObjectURL(url); ok(v); };
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => done(null);
    setTimeout(() => done(null), 5000);
    a.preload = 'metadata'; a.src = url;
  });
}
const rehearsalName = (score: string) => `Rehearsal track (${score})`;
/** A rehearsal track keeps its score's name in the show's music name (no new field in the show file). */
const isRehearsal = (name: string) => name.startsWith('Rehearsal track (');
const fmt = (s: number) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`; };

const storageError = "This browser wouldn't store the music (it may be out of space or in private mode).";

/** Warn when the lengths suggest that the recording and score are different exports. */
function pairWarning(length: number | null, map: Midi): string | undefined {
  const scoreLength = secondsAt(map, map.end);
  if (length !== null && Number.isFinite(length) && (length < scoreLength - 2 || length > scoreLength + 20)) {
    return `Check that these go together. The recording is ${fmt(length)} and the score plays for ${fmt(scoreLength)}. If it's a band or studio recording, not one made from this score, choose Line up the downbeats.`;
  }
}
