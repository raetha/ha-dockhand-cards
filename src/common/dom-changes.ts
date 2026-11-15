/**
 * Whether a card's rendered DOM changed since the last ask. Home Assistant
 * sends a new `hass` whenever any state anywhere changes, and Lit then
 * re-renders but touches the DOM only where a value changed; measuring the
 * layout after every one of those updates forces the browser to lay the
 * card out again, which on a card with many rows is most of an update's
 * time. Controllers that measure ask this first.
 */
export class DomChanges {
  private observer?: MutationObserver;

  /** True the first time, then whenever the host's shadow DOM changed
   * since the previous call (the caller's own changes are taken back out
   * with `forget()`). */
  changed(host: HTMLElement): boolean {
    if (typeof MutationObserver === 'undefined' || !host.shadowRoot) return true;
    if (!this.observer) {
      this.observer = new MutationObserver(() => undefined);
      this.observer.observe(host.shadowRoot, { subtree: true, childList: true, characterData: true, attributes: true });
      return true;
    }
    return this.observer.takeRecords().length > 0;
  }

  /** Drops the changes made since the last call: the measuring controller's own. */
  forget(): void {
    this.observer?.takeRecords();
  }

  disconnect(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }
}
