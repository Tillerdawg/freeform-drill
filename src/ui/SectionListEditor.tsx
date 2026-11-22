// The section list a show starts with, typed before there's a show: a letter and a name per row (New show), so a
// drill writer uses their own letters from the outset. A letter belongs to one section (Jason, 2026-11-22).
import { useState } from 'react';
import { DEFAULT_SECTIONS, MAX_LETTER, sectionListProblems, type SectionList } from '../engine/show';

/** A row being typed, with a key that stays put when rows above it are removed. */
export type EditRow = SectionList[number] & { key: string };
let next = 0;
export const toRows = (list: SectionList): EditRow[] => list.map((s) => ({ ...s, key: `r${next++}` }));
export const fromRows = (rows: EditRow[]): SectionList =>
  rows.map(({ name, letter, color }) => ({ name: name.trim(), letter: letter.trim(), ...(color ? { color } : {}) }));
/** The same names, letters, and colors, in the same order. */
export const sameList = (a: SectionList, b: SectionList) =>
  a.length === b.length && a.every((x, i) => x.name.trim() === b[i].name.trim() && x.letter.trim() === b[i].letter.trim() && (x.color ?? '') === (b[i].color ?? ''));

export function SectionListEditor({ rows, onChange }: { rows: EditRow[]; onChange: (rows: EditRow[]) => void }) {
  const problems = sectionListProblems(rows);
  const [added, setAdded] = useState(''); // the row just added, so its letter box takes the typing
  const edit = (i: number, patch: Partial<EditRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const isDefault = sameList(fromRows(rows), DEFAULT_SECTIONS);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div role="list" aria-label="Sections" style={{ maxHeight: 'min(260px, 40vh)', overflowY: 'auto', display: 'grid', gap: 4, paddingRight: 4 }}>
        {rows.map((r, i) => (
          <div role="listitem" key={r.key}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input aria-label={`Letter for ${r.name.trim() || `section ${i + 1}`}`} placeholder="?" value={r.letter} maxLength={MAX_LETTER}
                autoFocus={r.key === added} aria-invalid={!!problems[i] && problems[i] !== 'Give it a name.'}
                style={{ width: 44, textAlign: 'center', borderColor: problems[i] && problems[i] !== 'Give it a name.' ? 'var(--danger)' : undefined }}
                onChange={(e) => edit(i, { letter: e.target.value })} />
              <input aria-label={`Name of section ${r.letter.trim() || i + 1}`} placeholder="Name (Drum Major)" value={r.name} maxLength={60}
                aria-invalid={problems[i] === 'Give it a name.'} style={{ flex: 1, minWidth: 0, borderColor: problems[i] === 'Give it a name.' ? 'var(--danger)' : undefined }}
                onChange={(e) => edit(i, { name: e.target.value })} />
              <button type="button" className="icon danger" aria-label={`Remove ${r.name.trim() || `section ${i + 1}`}`} title="Remove this section"
                disabled={rows.length < 2} onClick={() => onChange(rows.filter((_, j) => j !== i))}>×</button>
            </div>
            {problems[i] && <div role="alert" style={{ color: 'var(--danger)', fontSize: 12, marginTop: 2 }}>{problems[i]}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => { const [r] = toRows([{ name: '', letter: '' }]); setAdded(r.key); onChange([...rows, r]); }}>+ Section</button>
        <button type="button" disabled={isDefault} onClick={() => onChange(toRows(DEFAULT_SECTIONS))}
          title="Flute F, Clarinet K, Alto Sax A, Tenor Sax X, Trumpet P, and so on">FreeFORM's list</button>
      </div>
    </div>
  );
}
