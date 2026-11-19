import { describe, expect, it } from 'vitest';
import { run } from './audioStore';

/**
 * A stand-in for IndexedDB: each transaction either commits or aborts a moment after its request succeeds (a full disk
 * can make a transaction abort after the request itself has already succeeded).
 */
const fakeDb = (ending: 'complete' | 'abort') => async () => ({
  transaction: () => {
    const tx: { error: Error | null; objectStore: () => object; oncomplete?: () => void; onabort?: () => void } = {
      error: ending === 'abort' ? new Error('QuotaExceededError') : null,
      objectStore: () => ({}),
    };
    setTimeout(() => (ending === 'complete' ? tx.oncomplete?.() : tx.onabort?.()));
    return tx;
  },
}) as unknown as IDBDatabase;
const request = () => ({ result: 'stored', error: null }) as unknown as IDBRequest<string>;

describe('run (one IndexedDB request)', () => {
  it('resolves with the result once the transaction commits', async () => {
    await expect(run('shows', 'readwrite', request, fakeDb('complete'))).resolves.toBe('stored');
  });

  it('fails when the transaction aborts after its request succeeded, so a lost write is never reported as saved', async () => {
    await expect(run('shows', 'readwrite', request, fakeDb('abort'))).rejects.toThrow('QuotaExceededError');
  });
});
