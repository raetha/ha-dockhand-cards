import { html, nothing, type TemplateResult } from 'lit';

/**
 * Joins a card's own list of section results with `.divider` lines
 * between adjacent, actually-rendering sections only — never before the
 * first, never after the last, and never between two sections when one
 * of them didn't render anything at all (a `nothing` result, whether
 * from a config visibility toggle or genuine data unavailability).
 *
 * Exists because the previous pattern — each section's own render
 * method independently prepending its own leading divider — ties the
 * divider to the wrong thing's own visibility (itself, the section
 * below the line) instead of whatever precedes it, and breaks the
 * moment a section that isn't literally first in a card's own fixed
 * order happens to be the first one a user's own config selection
 * actually renders (Environment's own Custom mode: any section can be
 * first, but only `container_counts` was ever built without its own
 * leading divider). A shared join step sidesteps this entirely — no
 * section owns a divider at all, so there's no "first section" special
 * case to get wrong, and no combination of hidden/empty sections can
 * ever produce two adjacent lines or a dangling one at the very end.
 */
export function joinWithDividers(sections: (TemplateResult | typeof nothing)[]): TemplateResult {
  const rendered = sections.filter((s) => s !== nothing) as TemplateResult[];
  return html`${rendered.map((section, i) => html`${i > 0 ? html`<div class="divider"></div>` : nothing}${section}`)}`;
}

/**
 * Merges several section results into one, with no divider between
 * them at all — for sections that should always sit directly adjacent
 * (e.g. a card's own metrics section and the grid immediately below
 * it, which specifically shouldn't get a line between them, even
 * though each is still its own independently-visibility-toggled
 * piece). Reduces to `nothing` if every constituent piece is `nothing`,
 * so the merged result still composes correctly as a single entry in a
 * `joinWithDividers` array — without this, passing each piece
 * separately would let `joinWithDividers` treat them as independent
 * sections and insert a divider between them, which is exactly the
 * bug this exists to avoid.
 */
export function mergeSections(...sections: (TemplateResult | typeof nothing)[]): TemplateResult | typeof nothing {
  const rendered = sections.filter((s) => s !== nothing);
  if (rendered.length === 0) return nothing;
  return html`${rendered}`;
}
