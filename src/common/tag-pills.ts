import { html, nothing, type TemplateResult } from 'lit';
import type { HassEntity } from 'home-assistant-js-websocket';

/** A Dockhand tag (ha-dockhand 2.0+): a name, and the colour the user
 * picked for it in Dockhand. */
export interface DockhandTag {
  name: string;
  color?: string;
}

// The attribute carries Dockhand's palette as `#rrggbb`; anything else is
// ignored rather than put into a style attribute.
const HEX = /^#[0-9a-f]{6}$/i;

/** The tags on a container's State or a stack's Status sensor, in
 * Dockhand's order. */
export function entityTags(stateObj: HassEntity | undefined): DockhandTag[] {
  const names = stateObj?.attributes.tags;
  if (!Array.isArray(names)) return [];
  const colors = (stateObj?.attributes.tag_colors ?? {}) as Record<string, unknown>;
  return names
    .filter((name): name is string => typeof name === 'string' && name !== '')
    .map((name) => {
      const color = colors[name];
      return typeof color === 'string' && HEX.test(color) ? { name, color } : { name };
    });
}

/** The same pill and colouring as an environment label: the tag's colour
 * mixed halfway toward the theme's text colour for the text, and at 15%
 * for the background, as in Dockhand. A tag without a colour gets the
 * plain pill. */
export function renderTagPill(tag: DockhandTag): TemplateResult {
  if (!tag.color) return html`<span class="label-pill tag-pill">${tag.name}</span>`;
  const style = `color: color-mix(in srgb, ${tag.color} 50%, var(--primary-text-color)); background: rgb(from ${tag.color} r g b / 0.15);`;
  return html`<span class="label-pill tag-pill" style=${style}>${tag.name}</span>`;
}

/** Every tag of an entity as pills on a list row, or nothing. The group
 * gives way before the row's name does (see `.tag-pills`); when they don't
 * all fit, RowFitController shows the one pill with their count instead. */
export function renderTagPills(stateObj: HassEntity | undefined): TemplateResult | typeof nothing {
  const tags = entityTags(stateObj);
  if (!tags.length) return nothing;
  return html`<span class="tag-pills">${tags.map(renderTagPill)}</span
    ><span class="label-pill tag-summary" title=${tags.map((tag) => tag.name).join(', ')}
      ><ha-icon icon="mdi:tag-multiple-outline"></ha-icon>${tags.length}</span
    >`;
}

/** The tags as their own row under a single Stack or Container card's
 * header, like the Environment card's labels, or nothing. */
export function renderTagRow(stateObj: HassEntity | undefined): TemplateResult | typeof nothing {
  const tags = entityTags(stateObj);
  return tags.length ? html`<div class="label-row tag-row">${tags.map(renderTagPill)}</div>` : nothing;
}
