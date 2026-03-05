/**
 * Cross-tab sync lock coordination using BroadcastChannel.
 *
 * Only one browser tab should drive a sync pass at a time.  The lock is
 * "optimistic": a tab claims the lock by broadcasting sync-started and then
 * waits 200 ms to see if a competing tab overrides it.
 */

export interface SyncLockCallbacks {
  /** Called when another tab claims the lock – current tab must stop syncing. */
  onLockStolen: () => void;
  /** Called when another tab completes a sync pass. */
  onRemoteSyncComplete: () => void;
}

export class SyncLock {
  private channel: BroadcastChannel | null = null;
  private hasLock = false;

  constructor(private readonly callbacks: SyncLockCallbacks) {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('tradiemate-sync-lock');
      this.channel.onmessage = (event: MessageEvent<{ type: string }>) => {
        if (event.data.type === 'sync-started') {
          // Another tab started syncing — yield
          this.hasLock = false;
          callbacks.onLockStolen();
          console.warn(
            '[SyncLock] Another tab is syncing, releasing lock and stopping this tab\'s sync'
          );
        } else if (event.data.type === 'sync-completed') {
          callbacks.onRemoteSyncComplete();
        }
      };
    }
  }

  /**
   * Try to acquire the sync lock.
   * Broadcasts sync-started and waits 200 ms to see if another tab objects.
   * Returns true if the lock was successfully acquired.
   */
  async acquire(): Promise<boolean> {
    if (!this.channel) return true; // No BroadcastChannel support — allow sync

    this.hasLock = true;
    this.channel.postMessage({ type: 'sync-started', timestamp: Date.now() });

    // Brief wait: if a competing tab is already syncing it will set hasLock = false
    await new Promise<void>(resolve => setTimeout(resolve, 200));

    return this.hasLock;
  }

  /** Broadcast that this tab has finished syncing and release the lock. */
  release(): void {
    if (this.channel && this.hasLock) {
      this.channel.postMessage({ type: 'sync-completed', timestamp: Date.now() });
      this.hasLock = false;
    }
  }

  /** Tear down the BroadcastChannel (e.g. on app unmount). */
  destroy(): void {
    this.channel?.close();
    this.channel = null;
  }
}
