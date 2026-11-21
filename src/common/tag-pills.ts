import { html, nothing, type TemplateResult } from 'lit';
import type { HassEntity } from 'home-assistant-js-websocket';
import type { HomeAssistant } from './ha-types';
import { getStackName, isStackDevice } from './device-utils';
import { resolveStackEntities } from './entity-resolver';
import { t } from './i18n-card';

/** A Dockhand tag (ha-dockhand 2.0+): a name, and the colour the user
 * picked for it in Dockhand. `stack` marks a stack's tag, drawn outlined
 * wherever it shows: on a container it names the stack it comes from (and
 * `own` says the container has it too), on the stack itself it's ''. */
export interface DockhandTag {
  name: string;
  color?: string;
  stack?: string;
  own?: boolean;
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

/** A container's tags as Dockhand's containers list shows them by default:
 * its own (ha-dockhand 2.1+ keeps them to the container), then the ones
 * assigned to its stack that it doesn't have, read from the stack's own
 * Status sensor (the container device's parent) so they aren't stored
 * twice. A tag on both stays where the container has it, marked as on the
 * stack too. */
export function containerTags(hass: HomeAssistant, deviceId: string | undefined, stateObj: HassEntity | undefined): DockhandTag[] {
  const own = entityTags(stateObj);
  const device = deviceId ? hass.devices?.[deviceId] : undefined;
  const parent = device?.via_device_id ? hass.devices?.[device.via_device_id] : undefined;
  const stack = parent && isStackDevice(parent) ? getStackName(parent) : null;
  if (!parent || !stack) return own;
  const fromStack = entityTags(resolveStackEntities(hass, parent.id, ['status']).found.status?.state);
  const onStack = new Set(fromStack.map((tag) => tag.name.toLowerCase()));
  const mine = new Set(own.map((tag) => tag.name.toLowerCase()));
  return [
    ...own.map((tag) => (onStack.has(tag.name.toLowerCase()) ? { ...tag, stack, own: true } : tag)),
    ...fromStack.filter((tag) => !mine.has(tag.name.toLowerCase())).map((tag) => ({ ...tag, stack }))
  ];
}

/** A stack's own tags, marked as a stack's so they're outlined as they
 * are on its containers. */
export function stackTags(stateObj: HassEntity | undefined): DockhandTag[] {
  return entityTags(stateObj).map((tag) => ({ ...tag, stack: '' }));
}

/** The same pill and colouring as an environment label: the tag's colour
 * mixed halfway toward the theme's text colour for the text, and at 15%
 * for the background, as in Dockhand. A tag without a colour gets the
 * plain pill. */
export function renderTagPill(tag: DockhandTag, hass?: HomeAssistant): TemplateResult {
  // From the stack only: outlined, no fill. On both: filled and outlined.
  const fromStack = tag.stack !== undefined && !tag.own;
  const cls = `label-pill tag-pill${fromStack ? ' from-stack' : tag.stack !== undefined ? ' also-stack' : ''}`;
  const title =
    !tag.stack || !hass ? nothing : t(hass, fromStack ? 'tag_from_stack' : 'tag_also_on_stack', { stack: tag.stack });
  const style = tag.color
    ? `color: color-mix(in srgb, ${tag.color} 50%, var(--primary-text-color));${fromStack ? '' : ` background: rgb(from ${tag.color} r g b / 0.15);`}`
    : nothing;
  return html`<span class=${cls} style=${style} title=${title}>${tag.name}</span>`;
}

/** Tags as pills on a list row, or nothing. The group
 * gives way before the row's name does (see `.tag-pills`); when they don't
 * all fit, RowFitController shows the one pill with their count instead. */
export function renderTagPills(tags: DockhandTag[], hass?: HomeAssistant): TemplateResult | typeof nothing {
  if (!tags.length) return nothing;
  return html`<span class="tag-pills">${tags.map((tag) => renderTagPill(tag, hass))}</span
    ><span class="label-pill tag-summary" title=${tags.map((tag) => tag.name).join(', ')}
      ><ha-icon icon="mdi:tag-multiple-outline"></ha-icon>${tags.length}</span
    >`;
}

/** The tags as their own row under a single Stack or Container card's
 * header, like the Environment card's labels, or nothing. */
export function renderTagRow(tags: DockhandTag[], hass?: HomeAssistant): TemplateResult | typeof nothing {
  return tags.length ? html`<div class="label-row tag-row">${tags.map((tag) => renderTagPill(tag, hass))}</div>` : nothing;
}
