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
 * context. A newer-tag pill beside a version keeps only its icon when the
 * version would be cut (`.compact-version`). If the columns still don't fit beside the name's minimum (an
 * aligned list's first track), the list scrolls sideways with its controls
 * held in view (`.overflowing` on `.list.aligned`).
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
    const lists = Array.from(this.host.shadowRoot?.querySelectorAll<HTMLElement>('.list.aligned') ?? []);
    for (const list of lists) list.classList.remove('overflowing');
    this.host.style.removeProperty(NAME_MIN_PROPERTY);
    const all = Array.from(this.host.shadowRoot?.querySelectorAll<HTMLElement>('.row') ?? []);
    const rows = all.filter((row) => row.querySelector('.tag-pills'));
    const labelled = all.filter((row) => row.querySelector('.name-label'));
    for (const row of all) row.classList.remove('compact-tags', 'no-tags', 'no-labels', 'compact-version');
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
    // Only then does an aligned list's name side keep a minimum: what each
    // row needs to show NAME_MIN_EM of its name (or all of a shorter one)
    // after its icon. If the columns don't fit beside that, the list
    // scrolls sideways (only then: a scrolling box clips).
    if (lists.length) {
      const needed = Math.max(0, ...lists.flatMap((list) => Array.from(list.querySelectorAll<HTMLElement>(':scope > .row')).map(nameSideMinimum)));
      this.host.style.setProperty(NAME_MIN_PROPERTY, `${Math.ceil(needed)}px`);
      // A newer-tag pill (the Updates card's version column) keeps just its
      // icon when what's beside it would otherwise be cut; its tooltip
      // still names the tag.
      const tagged = all.filter((row) => row.querySelector('.version-tag-pill'));
      const short = tagged.filter((row) => isCut(row.querySelector('.cell.version')) || Array.from(row.querySelectorAll('.version-old, .version-new')).some(isCut));
      for (const row of short) row.classList.add('compact-version');
      const wide = lists.filter(isCut);
      for (const list of wide) list.classList.add('overflowing');
    }
    this.dom.forget();
  }
}

/** Whether the row's name is cut, or its left side holds more than fits. */
function isSqueezed(row: Element): boolean {
  return nameCut(row.querySelector('.item-name')) || isCut(row.querySelector('.row-left'));
}

/** A name's text width and the width it's given, to the fraction of a
 * pixel: the browser shows an ellipsis for any overflow, which
 * scrollWidth and clientWidth (whole pixels) can hide (22.1px of "web" in
 * a 21.9px box reads 22 and 22). Where layout gives no fractions (a
 * test's DOM), those whole pixels. */
function nameWidths(name: HTMLElement): { text: number; shown: number } {
  const range = document.createRange();
  range.selectNodeContents(name);
  const text = range.getBoundingClientRect?.().width ?? 0;
  const box = name.getBoundingClientRect().width;
  if (!text || !box) return { text: name.scrollWidth, shown: name.clientWidth };
  const style = getComputedStyle(name);
  const inset = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) + (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
  return { text, shown: box - inset };
}

/** Whether a name shows less than all of itself. */
function nameCut(name: HTMLElement | null): boolean {
  if (!name) return false;
  const { text, shown } = nameWidths(name);
  return text - shown > 0.01;
}

/** How much of a cut name to keep before its row's labels give way, and
 * before an aligned list scrolls sideways. */
const NAME_MIN_EM = 6;

/** The aligned list's name track minimum (aligned-list.ts). */
const NAME_MIN_PROPERTY = '--dockhand-name-min';

/** The width a row's name side needs: whatever comes before its name, and
 * NAME_MIN_EM of the name, or all of it if it's shorter. */
function nameSideMinimum(row: HTMLElement): number {
  const left = row.querySelector<HTMLElement>('.row-left');
  const name = left?.querySelector<HTMLElement>('.item-name');
  if (!left || !name) return 0;
  const em = parseFloat(getComputedStyle(name).fontSize) || 14;
  return name.getBoundingClientRect().left - left.getBoundingClientRect().left + Math.min(name.scrollWidth, NAME_MIN_EM * em);
}

/** Whether a name is cut to less than NAME_MIN_EM (or all of itself, if
 * it's shorter). */
function nameTooShort(name: HTMLElement | null): boolean {
  if (!name || !nameCut(name)) return false;
  const { text, shown } = nameWidths(name);
  const em = parseFloat(getComputedStyle(name).fontSize) || 14;
  return shown < Math.min(text, NAME_MIN_EM * em);
}

/** Whether an element shows less than its content. A pixel's slack, as
 * the two widths are rounded separately. */
function isCut(el: Element | null): boolean {
  return el !== null && el.scrollWidth - el.clientWidth > 1;
}
