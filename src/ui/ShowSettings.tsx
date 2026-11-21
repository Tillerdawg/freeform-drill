import { useState } from 'react';
import type { HashPreset } from '../engine/coords';
import { fieldOf, withField, remapHash, type Show } from '../engine/show';
import { FieldSelect, FieldDetails, PRESETS } from './FieldPicker';
import { useDialog } from './useDialog';

const row: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' };

/**
 * The show's name, the field it's written on, its hash marks, and how performers are drawn: set once, so they live here
 * (from the show menu) rather than at the top of the sidebar, which is for what you're editing now.
 */
export function ShowSettingsDialog({ show, setShow, onClose }: { show: Show; setShow: (f: (s: Show) => Show) => void; onClose: () => void }) {
  const dialog = useDialog(onClose);
  const [pendingHash, setPendingHash] = useState<HashPreset | null>(null);
  const hashDialog = useDialog(() => setPendingHash(null), !!pendingHash);
  return (
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Show settings" style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'grid', placeItems: 'center', zIndex: 30 }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: 20, width: 460, maxWidth: 'calc(100vw - 32px)', display: 'grid', gap: 12, fontSize: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Show settings</h2>
      <div style={{ ...row, marginTop: 0 }}>
        <input aria-label="Show title" value={show.title} onChange={(e) => setShow((s) => ({ ...s, title: e.target.value }))} style={{ flex: 1 }} />
        <FieldSelect value={fieldOf(show)} outside={show.hash} onChange={(f) => {
          setShow((s) => withField(s, f)); // onto or off a floor: spots stay put in steps
        }} />
        <select aria-label="Draw performers as" title="On the field, printed charts, and phones: the section letter labeled with the number, or a dot labeled P4"
          value={show.symbols ?? 'letters'} onChange={(e) => setShow((s) => { const { symbols: _, ...rest } = s, v = e.target.value; return v === 'dots' ? { ...rest, symbols: v } : rest; })}>
          <option value="letters">Letters</option>
          <option value="dots">Dots</option>
        </select>
      </div>
      {show.surface?.kind !== 'court' && (
        <div style={row}>
          <FieldDetails value={fieldOf(show)} onChange={(f) => {
            // Other hashes under written drill: ask what should happen to it.
            if (typeof f === 'string' && show.performers.length) setPendingHash(f);
            else setShow((s) => withField(s, f));
          }} />
        </div>
      )}
      {show.surface && show.performers.some((x) => show.sets.some((st) => { const q = st.pos[x.id]; return q && (Math.abs(q.x) > show.surface!.w / 2 || q.y < 0 || q.y > show.surface!.d); })) && (
        <p role="status" style={{ color: 'var(--warn)', fontSize: 12, margin: 0 }}>Some performers are off the floor in some sets. They kept their spots in steps from the center and the front.</p>
      )}
      {pendingHash && (
        <div ref={hashDialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Change hash marks" style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'grid', placeItems: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: 20, width: 420, maxWidth: 'calc(100vw - 32px)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Change to {PRESETS.find(([k]) => k === pendingHash)![1]} hashes</h2>
            <p style={{ margin: '0 0 12px' }}>What should happen to the drill?</p>
            <div style={{ display: 'grid', gap: 8 }}>
              <button onClick={() => { setShow((s) => remapHash(s, pendingHash)); setPendingHash(null); }} style={{ textAlign: 'left', padding: 8 }}>
                <strong>Keep positions relative to the hashes</strong><br />
                <span style={{ fontSize: 12 }}>On the hash stays on the hash; the field stretches to fit. Use this if the show was started with the wrong hashes.</span>
              </button>
              <button onClick={() => { setShow((s) => ({ ...s, hash: pendingHash })); setPendingHash(null); }} style={{ textAlign: 'left', padding: 8 }}>
                <strong>Keep spots on the field</strong><br />
                <span style={{ fontSize: 12 }}>Dots stay where they are; only the hashes move, so coordinates change.</span>
              </button>
              <button onClick={() => setPendingHash(null)}>Cancel</button>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, opacity: 0.75 }}>Changes every set. Undo reverses it.</p>
          </div>
        </div>
      )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
