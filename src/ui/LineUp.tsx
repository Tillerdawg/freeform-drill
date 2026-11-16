// Line up a real recording with its score: play it and tap beat 1 of each bar (Space, Enter, or the big button).
// FreeFORM nudges each tap onto the recording's attack and places every count by the score between them (lineup.ts).
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { attackStrength, barName, barTimes, firstFullBar, mergeDownbeats, scoreToRecording, snapToAttacks, type Downbeat } from '../engine/lineup';
import type { Midi } from '../engine/midi';
import { NumberField } from './NumberField';
import { useDialog } from './useDialog';

export interface LineUpResult { downbeats: Downbeat[]; tapped: number; snapped: number }

export function LineUpDialog({ blob, map, earlier, onDone }: { blob: Blob; map: Midi; earlier: Downbeat[]; onDone: (r: LineUpResult | null) => void }) {
  const bars = useMemo(() => barTimes(map), [map]);
  const audio = useMemo(() => new Audio(), []);
  useEffect(() => { const url = URL.createObjectURL(blob); audio.src = url; return () => { audio.pause(); URL.revokeObjectURL(url); }; }, [audio, blob]);
  const lastEarlier = earlier.length ? earlier[earlier.length - 1].bar : -1;
  const [from, setFrom] = useState(lastEarlier >= 0 && lastEarlier + 1 < bars.length ? lastEarlier + 1 : firstFullBar(map));
  const [taps, setTaps] = useState<number[]>([]);
  const [running, setRunning] = useState(false);
  const [working, setWorking] = useState('');
  const bar = from + taps.length, done = bar >= bars.length;
  const floor = earlier.filter((d) => d.bar < from).reduce((t, d) => Math.max(t, d.at), -Infinity); // taps must come after earlier ones
  const tap = () => {
    if (!running || done) return;
    const t = audio.currentTime;
    setTaps((x) => (t <= (x.length ? x[x.length - 1] : floor) ? x : [...x, t]));
  };
  // Start a couple of seconds before the bar, where the earlier taps (or the score) say it is.
  const lead = () => (from === firstFullBar(map) && !earlier.length ? 0 : Math.max(0, scoreToRecording(map, earlier)(bars[from]) - 2));
  const start = (at: number) => { audio.currentTime = Math.max(0, at); audio.play().then(() => setRunning(true), () => setRunning(false)); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); tap(); } };
    window.addEventListener('keydown', key, true); // before the editor's own shortcuts (Space = play)
    return () => window.removeEventListener('keydown', key, true);
  });
  useEffect(() => { if (done) { audio.pause(); setRunning(false); } }, [done, audio]);
  const cancel = () => { if (!working) { audio.pause(); onDone(null); } };
  const dialog = useDialog(cancel);
  const finish = async () => {
    audio.pause(); setRunning(false);
    setWorking('Listening for the beats in the recording…');
    try {
      // Decoded at 22,050 samples a second, the rate the attack finder works at.
      const decoded = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(await blob.arrayBuffer());
      const strength = attackStrength(Array.from({ length: decoded.numberOfChannels }, (_, c) => decoded.getChannelData(c)), decoded.sampleRate);
      const { times, snapped } = snapToAttacks(taps, strength);
      onDone({ downbeats: mergeDownbeats(earlier, from, times), tapped: taps.length, snapped });
    } catch {
      onDone({ downbeats: mergeDownbeats(earlier, from, taps), tapped: taps.length, snapped: 0 }); // the taps as tapped
    }
  };
  const x = map.measures[bar];
  return createPortal(
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="lineup-title" style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'grid', placeItems: 'center', zIndex: 31, whiteSpace: 'normal' }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: 20, width: 460, maxWidth: 'calc(100vw - 32px)', boxShadow: 'var(--lift)' }}>
        <h2 id="lineup-title" style={{ margin: '0 0 6px', fontSize: 18 }}>Line up the recording with the score</h2>
        <p style={{ margin: '0 0 10px', fontSize: 13 }}>
          Press <strong>Space</strong> (or the button) on <strong>beat 1 of each bar</strong> as the recording plays. FreeFORM places every other count from the score.
          Tap the whole piece for the closest match, or just a stretch: you can come back for another one.
        </p>
        {!running && !taps.length && (
          <label style={{ display: 'block', margin: '0 0 10px', fontSize: 13 }}>Start at bar{' '}
            <NumberField aria-label="Start at bar" min={1} max={bars.length} integer value={from + 1} style={{ width: 64 }} onValue={(n) => setFrom(Math.min(bars.length - 1, Math.max(0, n - 1)))} />
            {' '}<span style={{ opacity: 0.8 }}>of {bars.length}{earlier.length ? ` (${earlier.length} ${earlier.length === 1 ? 'bar' : 'bars'} tapped before)` : ''}</span>
          </label>
        )}
        <button onPointerDown={(e) => { e.preventDefault(); tap(); }} disabled={!running || done} className="primary" style={{ width: '100%', height: 96, fontSize: 24, fontWeight: 700 }}>
          {done ? 'That was the last bar' : running ? `Beat 1 of ${barName(map, bar)}` : taps.length ? 'Paused' : 'Press Start'}
        </button>
        <p role="status" style={{ margin: '8px 0', fontSize: 13, minHeight: '1.4em', fontVariantNumeric: 'tabular-nums' }}>
          {working || (taps.length ? `${taps.length} ${taps.length === 1 ? 'bar' : 'bars'} tapped` : '')}
          {!working && x && !done ? `${taps.length ? ' · ' : ''}next: ${x.beats}/${x.den}` : ''}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!running && <button className="primary" disabled={!!working} onClick={() => { setTaps([]); start(lead()); }}>{taps.length ? 'Start over' : `Start at ${barName(map, from)}`}</button>}
          {running && <button onClick={() => { audio.pause(); setRunning(false); }}>Pause</button>}
          {!running && taps.length > 0 && !done && <button disabled={!!working} onClick={() => start(taps[taps.length - 1] - 2)} title="Back up 2 seconds before your last tap and keep going">Resume</button>}
          <button disabled={!taps.length || !!working} onClick={() => setTaps((t) => t.slice(0, -1))}>Undo last tap</button>
          <span style={{ marginLeft: 'auto' }} />
          <button disabled={!!working} onClick={cancel}>Cancel</button>
          <button className="primary" disabled={!taps.length || !!working} onClick={finish}>Done</button>
        </div>
      </div>
    </div>, document.body, // above the field: the Music menu sits inside the timeline's own layer
  );
}
