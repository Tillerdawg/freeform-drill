// After a Pyware or OpenMarch import: what came in, and what to check before teaching it (src/engine/importSummary.ts),
// with Review and the first problem a click away.
import type { ImportSummary } from '../engine/importSummary';
import type { Issue } from '../engine/review';
import { useDialog } from './useDialog';

export function ImportSummaryDialog({ title, from, summary, setName, onReview, onGo, onClose }: {
  title: string; from: 'Pyware' | 'OpenMarch'; summary: ImportSummary; setName: (i: number) => string; onReview: () => void; onGo: (x: Issue) => void; onClose: () => void;
}) {
  const dialog = useDialog(onClose);
  const first = summary.issues[0];
  return (
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Import summary" style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'grid', placeItems: 'center', zIndex: 20 }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: 20, width: 520, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', fontSize: 14 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Opened "{title}" from {from}</h2>
        <strong>What came in</strong>
        <ul style={{ margin: '4px 0 12px', paddingLeft: 20 }}>{summary.came.map((l) => <li key={l}>{l}</li>)}</ul>
        <strong>{summary.check.length ? 'Check before you teach it' : 'Nothing to check'}</strong>
        {summary.check.length
          ? <ul style={{ margin: '4px 0 12px', paddingLeft: 20 }}>{summary.check.map((l) => <li key={l}>{l}</li>)}</ul>
          : <p style={{ margin: '4px 0 12px' }}>Review found no step, spacing, or missing-spot problems. Play it through once to be sure it looks the way the writer meant.</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {first && <button onClick={() => { onClose(); onGo(first); }} title={first.text}>Go to the first problem (set {setName(first.set)})</button>}
          {first && <button onClick={() => { onClose(); onReview(); }}>Open Review</button>}
          <button className="primary" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
