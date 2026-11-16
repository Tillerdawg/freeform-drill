// The keyboard cheat sheet: press ? anywhere in the editor (or Help, then Keyboard shortcuts).
import { SHORTCUTS } from './keyboardShortcuts';
import { useDialog } from './useDialog';

const key: React.CSSProperties = { fontFamily: 'inherit', fontWeight: 600 };

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const dialog = useDialog(onClose);
  return (
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'grid', placeItems: 'center', zIndex: 20 }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: 20, width: 760, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', fontSize: 13, boxSizing: 'border-box', boxShadow: 'var(--lift)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2 id="shortcuts-title" style={{ margin: 0, fontSize: 18, flex: 1 }}>Keyboard shortcuts</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <p style={{ margin: '6px 0 4px' }}>They work anywhere in the editor except while you're typing in a box (⌘S still saves). Arrows move things the way they look on screen: ↑ is toward the back sideline.</p>
        <div style={{ columns: '320px 2', columnGap: 24 }}>
          {SHORTCUTS.map((g) => (
            <section key={g.title} style={{ breakInside: 'avoid', marginTop: 12 }}>
              <h3 style={{ fontSize: 14, margin: '0 0 4px' }}>{g.title}</h3>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  {g.rows.map(([what, keys]) => (
                    <tr key={what} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '4px 8px 4px 0', verticalAlign: 'top' }}>{what}</td>
                      <td style={{ padding: '4px 0', verticalAlign: 'top', textAlign: 'right', width: '42%' }}><kbd style={key}>{keys}</kbd></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
