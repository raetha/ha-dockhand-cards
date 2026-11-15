import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { DomChanges } from './dom-changes';

/**
 * Keeps a card's `.grid-2` pairs (Container's network/block I/O, the
 * Environment card's resource counts) from overlapping on a narrow card: when
 * the widest item wouldn't fit in half the width, the grid gets `.stacked`
 * and shows one item per line. Measured from the items' content, not a fixed
 * width, so it holds for any values, language or font size, and it switches
 * every pair together so the columns stay aligned. Re-checked when the card
 * resizes and after every render (values change width as they update).
 */
export class PairGridController implements ReactiveController {
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

  private check(): void {
    for (const grid of this.host.shadowRoot?.querySelectorAll<HTMLElement>('.grid-2') ?? []) {
      if (grid.clientWidth === 0) continue;
      const needed = Math.max(0, ...Array.from(grid.children, contentWidth));
      grid.classList.toggle('stacked', needed * 2 + columnGap(grid) > grid.clientWidth);
    }
    this.dom.forget();
  }
}

function columnGap(el: Element): number {
  return parseFloat(getComputedStyle(el).columnGap) || 0;
}

/** An item's natural width: its parts don't shrink (.row-icon, .row-right),
 * so their widths plus the gaps between them are what it needs whatever
 * width it currently has. */
function contentWidth(item: Element): number {
  const parts = Array.from(item.children);
  return parts.reduce((sum, part) => sum + part.getBoundingClientRect().width, 0) + columnGap(item) * Math.max(0, parts.length - 1);
}
