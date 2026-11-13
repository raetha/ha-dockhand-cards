import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Keeps a list row's name readable on a narrow card. Dockhand tags that
 * don't all fit fold into one pill with their count (`.compact-tags`; the
 * names are in its tooltip). Then, when the name would be cut or the left
 * side no longer fits, the row's newer-version pill drops its text and keeps
 * its icon (`.compact-version`; the tag is still in its tooltip). If even
 * the count pill doesn't fit then, the tags are left out (`.no-tags`; a
 * sliver of a clipped pill says nothing), and the version pill is checked
 * again without them.
 * Decided per row from the full layout each time (the
 * classes come off, everything is measured, then they go back on where
 * needed), so a row never flips between the two and nothing paints in
 * between. Re-checked when the card resizes and after every render, as
 * PairGridController does.
 */
export class RowFitController implements ReactiveController {
  private readonly observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => this.check());

  constructor(private readonly host: ReactiveControllerHost & HTMLElement) {
    host.addController(this);
  }

  hostConnected(): void {
    this.observer?.observe(this.host);
  }

  hostDisconnected(): void {
    this.observer?.disconnect();
  }

  hostUpdated(): void {
    this.check();
  }

  check(): void {
    const rows = Array.from(this.host.shadowRoot?.querySelectorAll<HTMLElement>('.row') ?? []).filter((row) => row.querySelector('.version-tag-pill, .tag-pills'));
    for (const row of rows) row.classList.remove('compact-version', 'compact-tags', 'no-tags');
    // Read every row, then write: one layout for each step, not one a row.
    const clipped = rows.filter((row) => isCut(row.querySelector('.tag-pills')));
    for (const row of clipped) row.classList.add('compact-tags');
    const squeezed = rows.filter((row) => row.querySelector('.version-tag-pill') && isSqueezed(row));
    for (const row of squeezed) row.classList.add('compact-version');
    const overflowing = clipped.filter(isSqueezed);
    for (const row of overflowing) {
      row.classList.remove('compact-tags', 'compact-version');
      row.classList.add('no-tags');
    }
    // Without the count pill, the version pill may have room after all.
    const stillSqueezed = overflowing.filter((row) => row.querySelector('.version-tag-pill') && isSqueezed(row));
    for (const row of stillSqueezed) row.classList.add('compact-version');
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
