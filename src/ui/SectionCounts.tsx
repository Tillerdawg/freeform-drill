import { useState } from 'react';
import { MAX_LETTER, placeSectionCounts, sectionListProblems, type Show } from '../engine/show';
import { sameList } from './SectionListEditor';
import { saveStartingList } from './startingSections';
import { NumberField } from './NumberField';
import { useDialog } from './useDialog';

/**
 * The first-run screen's "Enter section counts": how many in each section, and FreeFORM lays them out in rows on the
 * front hash so there's a formation to start from. Each section's letter and name can be changed here too, so a drill
 * writer starts with their own letters (one section per letter); changed ones become the next new show's list. Undo
 * takes it all back.
 */
export function SectionCountsDialog({ show, setShow, onPlaced, onClose }: {
  show: Show; setShow: (f: (s: Show) => Show) => void; onPlaced: (ids: string[]) => void; onClose: () => void;
}) {
  const dialog = useDialog(onClose);
  const [n, setN] = useState<Record<string, number>>({});
  const [rows, setRows] = useState(() => show.sections.map(({ id, name, letter }) => ({ id, name, letter })));
  const problems = sectionListProblems(rows), bad = problems.some(Boolean);
  const edit = (i: number, patch: { name?: string; letter?: string }) => setRows((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const total = Object.values(n).reduce((a, b) => a + b, 0);
  const place = () => {
    if (bad) return;
    const typed = new Map(rows.map((x) => [x.id, { name: x.name.trim(), letter: x.letter.trim() }]));
    const sections = show.sections.map((s) => ({ ...s, ...typed.get(s.id) }));
    const r = placeSectionCounts({ ...show, sections }, sections.map((s) => ({ section: s.id, n: n[s.id] ?? 0 })));
    setShow(() => r.show); onPlaced(r.ids); onClose();
    const list = sections.map(({ name, letter, color }) => ({ name, letter, ...(color ? { color } : {}) }));
    if (!sameList(list, show.sections)) saveStartingList(list); // changed here: the next new show starts with it too
  };
  return (
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Enter section counts" style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'grid', placeItems: 'center', zIndex: 30 }}>
      <form onSubmit={(e) => { e.preventDefault(); if (total && !bad) place(); }}
        style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: 20, width: 420, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', display: 'grid', gap: 12, gridTemplateRows: 'auto 1fr auto' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>How many in each section?</h2>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Change a letter or name if your band uses different ones. Each section needs its own letter.</span>
        </div>
        <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '6px 8px', alignItems: 'center' }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Letter</span><span style={{ fontSize: 12, opacity: 0.75 }}>Section</span><span style={{ fontSize: 12, opacity: 0.75 }}>How many</span>
          {rows.map((s, i) => (
            <div key={s.id} style={{ display: 'contents' }}>
              <input aria-label={`Letter for ${s.name.trim() || `section ${i + 1}`}`} value={s.letter} maxLength={MAX_LETTER}
                aria-invalid={!!problems[i] && problems[i] !== 'Give it a name.'}
                style={{ width: 44, textAlign: 'center', borderColor: problems[i] && problems[i] !== 'Give it a name.' ? 'var(--danger)' : undefined }}
                onChange={(e) => edit(i, { letter: e.target.value })} />
              <input aria-label={`Name of section ${s.letter.trim() || i + 1}`} value={s.name} maxLength={60} style={{ minWidth: 0, borderColor: problems[i] === 'Give it a name.' ? 'var(--danger)' : undefined }}
                aria-invalid={problems[i] === 'Give it a name.'} onChange={(e) => edit(i, { name: e.target.value })} />
              <NumberField aria-label={`How many in ${s.name}`} min={0} max={200} integer value={n[s.id] ?? 0} style={{ width: 64 }}
                onValue={(v) => setN((m) => ({ ...m, [s.id]: v }))} />
              {problems[i] && <div role="alert" style={{ gridColumn: '1 / -1', color: 'var(--danger)', fontSize: 12, marginTop: -4 }}>{problems[i]}</div>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ marginRight: 'auto', fontVariantNumeric: 'tabular-nums' }}>{total} performers</span>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={!total || bad} title={bad ? 'Fix the sections marked above first' : undefined}>Place them</button>
        </div>
      </form>
    </div>
  );
}
