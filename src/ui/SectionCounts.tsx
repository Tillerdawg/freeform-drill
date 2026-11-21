import { useState } from 'react';
import { placeSectionCounts, type Show } from '../engine/show';
import { NumberField } from './NumberField';
import { useDialog } from './useDialog';

/**
 * The first-run screen's "Enter section counts": how many in each section, and FreeFORM lays them out in rows on the
 * front hash so there's a formation to start from. Undo takes it back.
 */
export function SectionCountsDialog({ show, setShow, onPlaced, onClose }: {
  show: Show; setShow: (f: (s: Show) => Show) => void; onPlaced: (ids: string[]) => void; onClose: () => void;
}) {
  const dialog = useDialog(onClose);
  const [n, setN] = useState<Record<string, number>>({});
  const total = Object.values(n).reduce((a, b) => a + b, 0);
  const place = () => {
    const r = placeSectionCounts(show, show.sections.map((s) => ({ section: s.id, n: n[s.id] ?? 0 })));
    setShow(() => r.show); onPlaced(r.ids); onClose();
  };
  return (
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Enter section counts" style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'grid', placeItems: 'center', zIndex: 30 }}>
      <form onSubmit={(e) => { e.preventDefault(); if (total) place(); }}
        style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: 20, width: 380, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', display: 'grid', gap: 12, gridTemplateRows: 'auto 1fr auto' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>How many in each section?</h2>
        <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px', alignItems: 'center' }}>
          {show.sections.map((s) => (
            <label key={s.id} style={{ display: 'contents' }}>
              <span>{s.name} ({s.letter})</span>
              <NumberField aria-label={`How many in ${s.name}`} min={0} max={200} integer value={n[s.id] ?? 0} style={{ width: 64 }}
                onValue={(v) => setN((m) => ({ ...m, [s.id]: v }))} />
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ marginRight: 'auto', fontVariantNumeric: 'tabular-nums' }}>{total} performers</span>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={!total}>Place them</button>
        </div>
      </form>
    </div>
  );
}
