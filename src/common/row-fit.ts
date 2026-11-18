import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { DomChanges } from './dom-changes';

/**
 * Keeps a list row's name readable on a narrow card. Dockhand tags that
 * don't all fit fold into one pill with their count (`.compact-tags`; the
 * names are in its tooltip). If even the count pill doesn't fit, the tags
 * are left out (`.no-tags`; a sliver of a clipped pill says nothing).
 * Decided per row from the full layout each time (the
 * classes come off, everything is measured, then they go back on where
 * needed), so a row never flips between the two and nothing paints in
 * between. Re-checked when the card resizes and after every render, as
 * PairGridController does.
 */
export class RowFitController implements ReactiveController {
  private readonly observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => this.check());
  private readonly dom = new DomChanges();

  constructor(private readonly host: ReactiveControllerHost & HTMLElement) {
    host.addController(this);
  }

  hostConnected(): void {
    this.observer?.observe(this.host);
  }

  hostDisconnected(): void {
    this.observer?.disconnect();
    this.dom.disconnect();
  }

  hostUpdated(): void {
    // A render that changed nothing leaves the layout as it was measured.
    if (this.dom.changed(this.host)) this.check();
  }

  check(): void {
    const rows = Array.from(this.host.shadowRoot?.querySelectorAll<HTMLElement>('.row') ?? []).filter((row) => row.querySelector('.tag-pills'));
    for (const row of rows) row.classList.remove('compact-tags', 'no-tags');
    // Read every row, then write: one layout for each step, not one a row.
    const clipped = rows.filter((row) => isCut(row.querySelector('.tag-pills')));
    for (const row of clipped) row.classList.add('compact-tags');
    const overflowing = clipped.filter(isSqueezed);
    for (const row of overflowing) {
      row.classList.remove('compact-tags');
      row.classList.add('no-tags');
    }
    this.dom.forget();
  }
}

/** Whether the row's name is cut, or its left side holds more than fits. */
function isSqueezed(row: Element): boolean {
  return isCut(row.querySelector('.item-name')) || isCut(row.querySelector('.row-left'));
}

/** Whether an element shows less than its content. A pixel's slack, as
 * the two widths are rounded separately. */
function isCut(el: Element | null): boolean {
  return el !== null && el.scrollWidth - el.clientWidth > 1;
}
