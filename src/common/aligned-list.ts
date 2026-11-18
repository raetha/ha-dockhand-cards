import { html, nothing, type TemplateResult } from 'lit';

/**
 * A list whose rows line up their details in columns (`.list.aligned` in
 * shared-styles.ts): the name side, then one column per detail, each as
 * wide as its widest value. Rows are `.row`s whose children are the name
 * side (`.row-left`) and then one cell per column, in order, empty when
 * the row has nothing for it; group headers and dividers inside span every
 * column. `columns` is how many, each as wide as its widest value, or their
 * own track sizes. Cards with a RowFitController give the name side a
 * minimum, enough to read each name, and when the columns don't fit
 * beside it the list scrolls sideways instead, its controls staying in
 * view (`.overflowing`). One list for every group of a card, so groups line up too.
 */
export function renderAlignedList(columns: number | string[], content: unknown): TemplateResult {
  const tracks = typeof columns === 'number' ? Array<string>(columns).fill('auto') : columns;
  return html`<div class="list aligned" style=${`grid-template-columns: minmax(var(--dockhand-name-min, 0px), 1fr)${tracks.map((track) => ` ${track}`).join('')}`}>${content}</div>`;
}

/** A column's cell on a row. */
export function cell(content: unknown): TemplateResult {
  return html`<div class="cell">${content ?? nothing}</div>`;
}

/**
 * The columns a list shows: the details turned on, in display order, that
 * at least one row has, so a list never has a column of empty cells.
 */
export function shownColumns<K extends string, R>(order: readonly K[], visible: (key: K) => boolean, rows: readonly R[], has: (row: R, key: K) => boolean): K[] {
  return order.filter((key) => visible(key) && rows.some((row) => has(row, key)));
}
