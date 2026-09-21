/**
 * Editor-side counterparts to functions in environment-scope.ts that depend
 * on i18n — kept here so that importing environment-scope.ts from a card
 * does not pull in the full editor translation table.
 *
 * Exports:
 *   effectiveExcludeDeviceIds — editor reflection of the legacy-field state
 *   renderEnvironmentOrderSection — shared drag-to-reorder environment list
 */

import { html, nothing, type TemplateResult } from 'lit';
import type { HomeAssistant } from './ha-types';
import { getEnvironmentDevices, type EnvironmentDeviceOption } from './device-utils';
import { t, type EditorTranslationKey } from './i18n-editor';
import { resolveEnvironmentOrder, type EnvironmentScope } from './environment-scope';

export type { EnvironmentScope };

/** Editor-side counterpart to resolveIncludedOrderedWithLegacy — what
 * renderEnvironmentOrderSection's own `excluded` option should show when
 * only legacy fields are present, so the editor accurately reflects
 * "just this one environment" (everything else shown as excluded) rather
 * than looking like nothing's been chosen at all. Never written back
 * into config on its own — only actually interacting with the section
 * writes real exclude_device_ids, same reasoning as
 * resolveIncludedOrderedWithLegacy's own comment. */
export function effectiveExcludeDeviceIds(
  all: EnvironmentDeviceOption[],
  excluded: string[] | undefined,
  legacyDeviceId: string | undefined,
  legacyScope?: EnvironmentScope
): string[] | undefined {
  if (excluded !== undefined || !legacyDeviceId) return excluded;
  const shouldSolo = legacyScope !== undefined ? legacyScope === 'environment' : true;
  if (!shouldSolo) return excluded;
  return all.filter((d) => d.deviceId !== legacyDeviceId).map((d) => d.deviceId);
}

/**
 * The shared "selected environments" editor section — a drag-to-reorder
 * list with a per-environment eye icon, reusing the exact `<ha-sortable>`
 * + `sortableRowStyles` pattern already used for Overview's own
 * environment order and this card's own badge order. `showExcludeToggle`
 * controls whether the eye icon renders at all: exclusion only means
 * anything when a card actually applies exclude_device_ids (see
 * resolveIncludedOrdered) — when a card only wants this section for
 * its *ordering* effect (e.g. Schedules' group_by: 'environment', which
 * uses this same list for group display order regardless of scope),
 * showing an eye icon that would silently do nothing is worse than not
 * showing one at all.
 *
 * Wraps in a collapsible `<ha-expansion-panel>`, expanded by default,
 * with the native `no-collapse` attribute set so it can't currently be
 * collapsed at all (confirmed real against HA frontend source —
 * `ha-expansion-panel.ts` has a genuine `no-collapse` boolean, not
 * something hand-built here). An earlier version of this function
 * removed the panel entirely in favor of a bare heading, reasoning
 * nothing needed collapsing — reverted after seeing it rendered: the
 * bare version looked worse in practice than the panel does, even
 * fixed open. `no-collapse` is deliberately marked "for now" in the
 * maintainer's own words — revisit if collapsing turns out to be
 * wanted after all, at which point removing the attribute is enough,
 * no other change needed.
 */
export function renderEnvironmentOrderSection(opts: {
  hass: HomeAssistant;
  headingKey: EditorTranslationKey;
  hintKey: EditorTranslationKey;
  /** True when this editor is embedded inside another editor (currently
   * only the Overview card) that already owns environment scoping for
   * everything it generates — returns an empty template instead of
   * rendering anything. The one place this hides itself, rather than
   * every card's own render() repeating the same
   * `${this.cardIsEmbedded ? html`` : renderEnvironmentOrderSection(...)}`
   * ternary and risking a future card forgetting it, or one of them
   * drifting from the others — see docs/EDITOR_DESIGN.md's rule on this:
   * any card with an environment-selection section is expected to
   * support being hidden this way, whether or not it's actually embedded
   * in Overview yet. */
  hidden?: boolean;
  /** Defaults to 'mdi:sort' — the header icon this section has always
   * used, since it was originally framed purely around ordering. Callers
   * whose heading no longer centers on ordering (e.g. a plain
   * "Environments" heading) can override with something that better
   * matches the new heading text — see label_environments' own usage in
   * the Schedules card editor for why "sort" stopped fitting once the
   * heading itself stopped being about sorting specifically. */
  icon?: string;
  order: string[] | undefined;
  excluded: string[] | undefined;
  showExcludeToggle: boolean;
  /** Whether dragging to reorder actually does anything — false when a
   * card only wants this section for its inclusion/exclusion effect and
   * order has no separate meaning of its own for it (e.g. this repo's
   * Updates card, which doesn't group by environment the way Schedules
   * can). Offering a drag handle that silently changes nothing would be
   * actively misleading, same reasoning as showExcludeToggle below but
   * for the opposite half of this control. */
  allowReorder: boolean;
  onMoved: (newOrder: string[]) => void;
  onToggleExcluded: (deviceId: string, nowExcluded: boolean) => void;
  /** Renders a third per-row action — "show only this one" (mixing-desk
   * "solo" convention), excluding every other environment in one click
   * rather than needing N-1 individual exclude clicks. Optional and
   * independent of showExcludeToggle: a card could in principle want one
   * without the other, though in practice they'll almost always travel
   * together. Omit entirely for a card that hasn't opted into this yet. */
  onSolo?: (deviceId: string) => void;
  /** Renders a leading per-row pencil action — opens some other, richer
   * per-environment settings view the card maintains outside this
   * component entirely (this function has no idea what that view shows,
   * only that clicking the pencil should navigate to it). Currently only
   * the Overview card provides this — its own per-environment override
   * detail view — which is exactly the point: existing purely as an
   * optional hook here means Overview's environment list can reuse this
   * shared component instead of duplicating its row rendering (drag
   * handle, name, action buttons) a second time with a pencil bolted on,
   * the same duplication this component already exists to avoid for
   * every other card. */
  onEdit?: (deviceId: string) => void;
  /** Bulk "select all" / "clear all" actions, rendered together as a
   * small row above the list — only rendered when *both* are provided
   * (there's no sensible reading of offering just one). Exists
   * specifically so the "everything included by default" opt-out model
   * doesn't strand someone who actually wants to build a small curated
   * list from scratch: clear, then re-include the few they want, rather
   * than excluding everyone else one at a time. */
  onSelectAll?: () => void;
  onClearAll?: () => void;
}): TemplateResult {
  if (opts.hidden) return html``;

  const all = getEnvironmentDevices(opts.hass);
  const displayList = resolveEnvironmentOrder(all, opts.order);
  const excludedSet = new Set(opts.excluded ?? []);

  const moved = (ev: CustomEvent<{ oldIndex: number; newIndex: number }>) => {
    ev.stopPropagation();
    const ids = displayList.map((e) => e.deviceId);
    const [movedId] = ids.splice(ev.detail.oldIndex, 1);
    ids.splice(ev.detail.newIndex, 0, movedId);
    opts.onMoved(ids);
  };

  const rows = html`
    <div class="order-list">
      ${displayList.map((env) => {
        const isExcluded = excludedSet.has(env.deviceId);
        return html`
          <div class="order-row ${isExcluded ? 'hidden' : ''}">
            <ha-icon class="order-handle ${opts.allowReorder ? '' : 'disabled'}" icon="mdi:drag-horizontal-variant"></ha-icon>
            <span class="order-name">${env.name}</span>
            <div class="row-actions">
              ${opts.onEdit
                ? html`
                    <ha-icon-button class="row-action-btn" label=${t(opts.hass, 'override_env_settings')} @click=${() => opts.onEdit!(env.deviceId)}>
                      <ha-icon icon="mdi:pencil"></ha-icon>
                    </ha-icon-button>
                  `
                : nothing}
              ${opts.onSolo
                ? html`
                    <ha-icon-button class="row-action-btn" label=${t(opts.hass, 'solo_this_environment')} @click=${() => opts.onSolo!(env.deviceId)}>
                      <ha-icon icon="mdi:target"></ha-icon>
                    </ha-icon-button>
                  `
                : nothing}
              ${opts.showExcludeToggle
                ? html`
                    <ha-icon-button
                      class="row-action-btn"
                      label=${isExcluded ? t(opts.hass, 'show_this_environment') : t(opts.hass, 'hide_this_environment')}
                      @click=${() => opts.onToggleExcluded(env.deviceId, !isExcluded)}
                    >
                      <ha-icon icon=${isExcluded ? 'mdi:eye-off' : 'mdi:eye'}></ha-icon>
                    </ha-icon-button>
                  `
                : nothing}
            </div>
          </div>
        `;
      })}
    </div>
  `;

  return html`
    <ha-expansion-panel outlined expanded no-collapse>
      <ha-icon slot="leading-icon" icon=${opts.icon ?? 'mdi:sort'}></ha-icon>
      <span slot="header">${t(opts.hass, opts.headingKey)}</span>
      <div class="content">
        <div class="hint">${t(opts.hass, opts.hintKey)}</div>
        ${opts.onSelectAll && opts.onClearAll
          ? html`
              <div class="bulk-actions">
                <button class="link-btn" @click=${opts.onSelectAll}>${t(opts.hass, 'select_all_environments')}</button>
                <span class="bulk-actions-sep">·</span>
                <button class="link-btn" @click=${opts.onClearAll}>${t(opts.hass, 'clear_all_environments')}</button>
              </div>
            `
          : nothing}
        ${opts.allowReorder ? html`<ha-sortable handle-selector=".order-handle" @item-moved=${moved}>${rows}</ha-sortable>` : rows}
      </div>
    </ha-expansion-panel>
  `;
}
