import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { DomChanges } from './dom-changes';

/**
 * Keeps a list row's name readable on a narrow card. Dockhand tags that
 * don't all fit fold into one pill with their count (`.compact-tags`; the
 * names are in its tooltip). If even the count pill doesn't fit, the tags
 * are left out (`.no-tags`; a sliver of a clipped pill says nothing). Then,
 * if the name still shows less than NAME_MIN_EM of itself, or the name side
 * holds more than fits, its environment, type and instance pills are left
 * out too (`.no-labels`): the name says which row it is, they only add
 * context.
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
    const all = Array.from(this.host.shadowRoot?.querySelectorAll<HTMLElement>('.row') ?? []);
    const rows = all.filter((row) => row.querySelector('.tag-pills'));
    const labelled = all.filter((row) => row.querySelector('.name-label'));
    for (const row of all) row.classList.remove('compact-tags', 'no-tags', 'no-labels');
    // Read every row, then write: one layout for each step, not one a row.
    const clipped = rows.filter((row) => isCut(row.querySelector('.tag-pills')));
    for (const row of clipped) row.classList.add('compact-tags');
    const overflowing = clipped.filter(isSqueezed);
    for (const row of overflowing) {
      row.classList.remove('compact-tags');
      row.classList.add('no-tags');
    }
    const crowded = labelled.filter((row) => isCut(row.querySelector('.row-left')) || nameTooShort(row.querySelector('.item-name')));
    for (const row of crowded) row.classList.add('no-labels');
    this.dom.forget();
  }
}

/** Whether the row's name is cut, or its left side holds more than fits. */
function isSqueezed(row: Element): boolean {
  return isCut(row.querySelector('.item-name')) || isCut(row.querySelector('.row-left'));
}

/** How much of a cut name to keep before its row's labels give way. */
const NAME_MIN_EM = 6;

/** Whether a name is cut to less than NAME_MIN_EM (or all of itself, if
 * it's shorter). */
function nameTooShort(name: HTMLElement | null): boolean {
  if (!name || !isCut(name)) return false;
  const em = parseFloat(getComputedStyle(name).fontSize) || 14;
  return name.clientWidth < Math.min(name.scrollWidth, NAME_MIN_EM * em);
}

/** Whether an element shows less than its content. A pixel's slack, as
 * the two widths are rounded separately. */
function isCut(el: Element | null): boolean {
  return el !== null && el.scrollWidth - el.clientWidth > 1;
}
