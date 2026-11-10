import { LitElement, html, css, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { keyed } from 'lit/directives/keyed.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { stripUndefinedKeys } from '../common/config-utils';
import { editorFormStyles, sortableRowStyles } from '../common/editor-styles';
import { resolveEnvironmentOrder } from '../common/environment-scope';
import { renderEnvironmentOrderSection } from '../common/environment-scope-editor';
import { t, type EditorTranslationKey } from '../common/i18n-editor';
import { DEFAULT_CUSTOM_SECTIONS } from '../dockhand-environment-card/types';
import type { DockhandEnvironmentCardConfig } from '../dockhand-environment-card/types';
import type { DockhandVulnerabilityCardConfig } from '../dockhand-vulnerability-card/types';
import { DEFAULT_STACKS_BADGES, type DockhandStacksCardConfig } from '../dockhand-stacks-card/types';
import { DEFAULT_CONTAINERS_BADGES, type DockhandContainersCardConfig } from '../dockhand-containers-card/types';
import type { DockhandSchedulesCardConfig } from '../dockhand-schedules-card/types';
import type { DockhandUpdatesCardConfig } from '../dockhand-updates-card/types';
import {
  DEFAULT_SECTION_ORDER,
  type DockhandOverviewCardConfig,
  type OverviewSection,
  type EnvironmentOverride
} from './types';

// Side-effect imports — registers the standalone editors' custom
// elements so this editor can mount them directly for the per-environment
// override and global-defaults views.
import '../dockhand-environment-card/editor';
import '../dockhand-vulnerability-card/editor';
import '../dockhand-stacks-card/editor';
import '../dockhand-containers-card/editor';
import '../dockhand-updates-card/editor';


const EMBEDDED_EDITOR_TAGS = [
  'dockhand-environment-card-editor',
  'dockhand-vulnerability-card-editor',
  'dockhand-stacks-card-editor',
  'dockhand-containers-card-editor',
  'dockhand-schedules-card-editor',
  'dockhand-updates-card-editor'
].join(', ');

const SECTION_LABEL_KEY: Record<OverviewSection, EditorTranslationKey> = {
  environments: 'label_environments',
  vulnerabilities: 'label_vulnerabilities',
  stacks: 'label_stacks',
  containers: 'label_containers',
  updates: 'label_updates',
  schedules: 'label_schedules'
};

const DETAIL_SECTION_LABEL_KEY: Record<OverviewSection, EditorTranslationKey> = {
  environments: 'detail_section_environment',
  vulnerabilities: 'detail_section_vulnerabilities',
  stacks: 'detail_section_stacks',
  containers: 'detail_section_containers',
  updates: 'detail_section_updates',
  schedules: 'detail_section_schedules'
};

const SECTION_ICON: Record<OverviewSection, string> = {
  environments: 'mdi:server',
  vulnerabilities: 'mdi:shield-alert',
  stacks: 'mdi:layers',
  containers: 'mdi:docker',
  updates: 'mdi:arrow-up-circle',
  schedules: 'mdi:calendar-clock'
};

const SECTION_CONFIG_KEY: Record<OverviewSection, keyof DockhandOverviewCardConfig> = {
  environments: 'show_environments',
  vulnerabilities: 'show_vulnerabilities',
  stacks: 'show_stacks',
  containers: 'show_containers',
  updates: 'show_updates',
  schedules: 'show_schedules'
};

/** Maps an OverviewSection to the corresponding key on EnvironmentOverride
 * — not the same string in one case ('environments' the section vs.
 * 'environment' the override key, singular, since one environment's
 * override only ever concerns its own Environment card, not a list of
 * them) — used by _renderDetailSection to decide whether that section's
 * override panel should start expanded. */
const OVERRIDE_KEY: Record<OverviewSection, keyof EnvironmentOverride> = {
  environments: 'environment',
  vulnerabilities: 'vulnerabilities',
  stacks: 'stacks',
  containers: 'containers',
  updates: 'updates',
  schedules: 'schedules'
};

// Editors accept type-erased elements from `ref()` — reusing the exact
// shape each editor's own setConfig/hass/cardIsEmbedded expects rather
// than importing every editor *class* just for a type.
interface EmbeddableCardEditor<C> extends HTMLElement {
  hass: HomeAssistant;
  cardIsEmbedded: boolean;
  hideTitle: boolean;
  setConfig(config: C): void;
}

export class DockhandOverviewCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandOverviewCardConfig;
  @state() private _hass?: HomeAssistant;
  /** Which environment's override detail view is open, if any — an
   * internal view switch within this same editor component, not real HA
   * page navigation (no such API exists for card editors). undefined
   * means the list view. */
  @state() private _editingDeviceId?: string;
  /** Which section type's global settings view is open, if any — same
   * kind of internal view switch as _editingDeviceId, just keyed by
   * section type instead of environment. Mutually exclusive with
   * _editingDeviceId in practice (render() checks one, then the other),
   * since they're reached from two different lists. */
  @state() private _editingSection?: OverviewSection;

  static styles = css`
    ${editorFormStyles}
    ${sortableRowStyles}
    /* Same treatment as a hidden environment row (editor-styles.ts). */
    .section-order-row.disabled .order-name {
      color: var(--secondary-text-color);
    }
    .section-order-row.disabled .order-handle {
      opacity: 0.5;
    }
    /* ha-expansion-panel margin/padding and .row-action-btn/.row-actions/
     * .order-row's own gap all come from the shared sortableRowStyles now.
     * Two notes on choices that aren't obvious from the shared CSS alone:
     * the icon-buttons are deliberately NOT sized down to match the live
     * cards' compact .header-icon pattern — this is config UI, not a
     * card, and HA's own editors/dialogs use ha-icon-button at its native
     * default size — and there's no gap between the two action buttons
     * themselves, matching HA's own edit/remove icon-button pair in
     * hui-heading-badges-editor, which has no gap between them either
     * (each button's own internal padding provides the breathing room). */
    .detail-header {
      display: flex;
      align-items: center;
      gap: var(--ha-space-2, 8px);
      margin-bottom: var(--ha-space-1, 4px);
    }
    .detail-title {
      display: flex;
      align-items: center;
      gap: var(--ha-space-2, 8px);
      min-width: 0;
      flex: 1;
    }
    .detail-name {
      font-size: var(--ha-font-size-m, 14px);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .detail-badge {
      flex-shrink: 0;
      /* Matches HA's own ha-automation-row-event-chip.ts convention for
       * this exact kind of small status-text chip (confirmed real
       * against source, used in Lovelace editors too, not just
       * automations) — border-radius: var(--ha-border-radius-pill)
       * (9999px, a true pill/capsule shape, not a rounded rectangle)
       * and padding: var(--ha-space-1) var(--ha-space-2). Editors match
       * HA's own conventions directly rather than this repo's own
       * rendered-card shapes (label-pill/status-chip use a smaller
       * radius) — the two don't need to agree with each other. */
      font-size: var(--ha-font-size-xs, 10px);
      font-weight: 500;
      padding: var(--ha-space-1, 4px) var(--ha-space-2, 8px);
      border-radius: var(--ha-border-radius-pill, 9999px);
      background: rgb(from var(--dockhand-accent-color, var(--primary-color)) r g b / 0.15);
      color: var(--dockhand-accent-color, var(--primary-color));
    }
  `;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    // The embedded editors only get hass when mounted (see _mountEditor),
    // so pass every later update on, as HA does for a top-level editor.
    for (const editor of this.shadowRoot?.querySelectorAll<HTMLElement & { hass: HomeAssistant }>(EMBEDDED_EDITOR_TAGS) ?? []) {
      editor.hass = hass;
    }
  }

  setConfig(config: DockhandOverviewCardConfig): void {
    this._config = {
      show_environments: true,
      show_vulnerabilities: false,
      show_stacks: false,
      show_containers: false,
      show_updates: false,
      show_schedules: false,
      environment_mode: 'standard',
      align_columns: true,
      ...config
    };
  }

  /** The shared order: listed environments first, the rest after them
   * alphabetically, as everywhere else. */
  private _orderedDevices() {
    if (!this._hass) return [];
    return resolveEnvironmentOrder(getEnvironmentDevices(this._hass), this._config?.environments_order);
  }

  private _isSectionShown(section: OverviewSection): boolean {
    switch (section) {
      case 'environments':
        return this._config?.show_environments ?? true;
      case 'vulnerabilities':
        return this._config?.show_vulnerabilities ?? false;
      case 'stacks':
        return this._config?.show_stacks ?? false;
      case 'containers':
        return this._config?.show_containers ?? false;
      case 'updates':
        return this._config?.show_updates ?? false;
      case 'schedules':
        return this._config?.show_schedules ?? false;
    }
  }

  private _orderedSections(): OverviewSection[] {
    const saved = this._config?.section_order;
    if (!saved) return DEFAULT_SECTION_ORDER;
    const known = new Set(saved);
    const rest = DEFAULT_SECTION_ORDER.filter((s) => !known.has(s));
    return [...saved, ...rest];
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;

    const orderedDevices = this._orderedDevices();

    // The environment behind an open detail view can vanish out from
    // under it (device removed, or hass simply hasn't loaded devices yet
    // on first render) — fall back to the list view rather than reference
    // a name that no longer resolves to anything.
    if (this._editingDeviceId) {
      const device = orderedDevices.find((d) => d.deviceId === this._editingDeviceId);
      if (device) {
        return this._renderEnvironmentDetail(device.deviceId, device.name);
      }
      this._editingDeviceId = undefined;
    }

    if (this._editingSection) {
      return this._renderSectionSettingsDetail(this._editingSection);
    }

    return this._renderList();
  }

  private _renderList(): TemplateResult {
    if (!this._config || !this._hass) return html``;
    const orderedSections = this._orderedSections();

    return html`
      <ha-expansion-panel outlined expanded>
        <ha-icon slot="leading-icon" icon="mdi:format-list-bulleted"></ha-icon>
        <h3 slot="header">${t(this._hass, 'section_order_heading')}</h3>
        <div class="content">
          <div class="hint">${t(this._hass, 'order_list_hint')}</div>
          <div class="bulk-actions">
            <button class="link-btn" @click=${this._showAllSections}>${t(this._hass, 'select_all_environments')}</button>
            <span class="bulk-actions-sep">·</span>
            <button class="link-btn" @click=${this._clearAllSections}>${t(this._hass, 'clear_all_environments')}</button>
          </div>
          <ha-sortable handle-selector=".order-handle" @item-moved=${this._sectionMoved}>
            <div class="order-list">${orderedSections.map((s) => this._renderSectionOrderRow(s))}</div>
          </ha-sortable>
        </div>
      </ha-expansion-panel>

      ${renderEnvironmentOrderSection({
        hass: this._hass,
        headingKey: 'label_environments',
        hintKey: 'order_list_hint',
        icon: 'mdi:web',
        order: this._config?.environments_order,
        excluded: this._config?.exclude_device_ids,
        showExcludeToggle: true,
        allowReorder: true,
        onMoved: (order) => this._updateConfig({ environments_order: order }),
        onToggleExcluded: (deviceId, nowExcluded) => {
          const current = this._config?.exclude_device_ids ?? [];
          const next = nowExcluded ? [...current, deviceId] : current.filter((id) => id !== deviceId);
          this._updateConfig({ exclude_device_ids: next.length > 0 ? next : undefined });
        },
        onSolo: (deviceId) => {
          const all = this._orderedDevices().map((d) => d.deviceId);
          this._updateConfig({ exclude_device_ids: all.filter((id) => id !== deviceId) });
        },
        onSelectAll: () => this._updateConfig({ exclude_device_ids: undefined }),
        onClearAll: () => this._updateConfig({ exclude_device_ids: this._orderedDevices().map((d) => d.deviceId) }),
        onEdit: (deviceId) => {
          this._editingDeviceId = deviceId;
        }
      })}

      <ha-form
        .hass=${this._hass}
        .data=${this._config}
        .schema=${[{ name: 'align_columns', default: true, selector: { boolean: {} } }]}
        .computeLabel=${() => t(this._hass, 'align_columns')}
        .computeHelper=${() => t(this._hass, 'align_columns_hint')}
        @value-changed=${this._sectionSettingsChanged}
      ></ha-form>
    `;
  }

  /** Every section type now has a global-defaults settings view, so
   * every row gets a pencil — Environment (mode/custom sections),
   * Vulnerabilities/Stacks/Containers (show_settings_link, plus
   * visible_badges for the latter two), and Updates
   * (hide-when-no-updates). Not true when this was first built (see
   * git history / CHANGELOG); it changed once show_settings_link was
   * added as a global default too, since every card type has that
   * field. */
  private _renderSectionOrderRow(section: OverviewSection): TemplateResult {
    const shown = this._isSectionShown(section);
    const rowHint =
      section === 'vulnerabilities'
        ? t(this._hass, 'vulnerabilities_hint')
        : section === 'updates'
          ? t(this._hass, 'updates_hint')
          : section === 'schedules'
            ? t(this._hass, 'schedules_overview_hint')
            : undefined;

    return html`
      <div class="order-row section-order-row ${shown ? '' : 'disabled'}" title=${rowHint ?? ''}>
        <ha-icon class="order-handle" icon="mdi:drag-horizontal-variant"></ha-icon>
        <span class="order-name">${t(this._hass, SECTION_LABEL_KEY[section])}</span>
        <div class="row-actions">
          <ha-icon-button class="row-action-btn" label=${t(this._hass, 'override_env_settings')} @click=${this._openSectionSettings(section)}>
            <ha-icon icon="mdi:pencil"></ha-icon>
          </ha-icon-button>
          <ha-icon-button
            class="row-action-btn"
            label=${shown ? t(this._hass, 'hide_this_environment') : t(this._hass, 'show_this_environment')}
            @click=${this._sectionVisibilityToggled(section)}
          >
            <ha-icon icon=${shown ? 'mdi:eye' : 'mdi:eye-off'}></ha-icon>
          </ha-icon-button>
        </div>
      </div>
    `;
  }

  private _renderSectionSettingsDetail(section: OverviewSection): TemplateResult {
    return html`${keyed(
      section,
      html`
        <div class="detail-header">
          <ha-icon-button class="row-action-btn" label=${t(this._hass, 'back')} @click=${this._closeSectionSettings}>
            <ha-icon icon="mdi:arrow-left"></ha-icon>
          </ha-icon-button>
          <div class="detail-title">
            <span class="detail-name">${t(this._hass, SECTION_LABEL_KEY[section])}</span>
          </div>
        </div>

        ${this._renderGlobalSectionEditor(section)}
      `
    )}`;
  }

  private _renderGlobalSectionEditor(section: OverviewSection): TemplateResult {
    switch (section) {
      case 'environments':
        return html`<dockhand-environment-card-editor
          ${ref(this._mountGlobalEditor('environments'))}
          @config-changed=${this._globalSectionChanged('environments')}
        ></dockhand-environment-card-editor>`;
      case 'vulnerabilities':
        return html`<dockhand-vulnerability-card-editor
          ${ref(this._mountGlobalEditor('vulnerabilities'))}
          @config-changed=${this._globalSectionChanged('vulnerabilities')}
        ></dockhand-vulnerability-card-editor>`;
      case 'stacks':
        return html`<dockhand-stacks-card-editor
          ${ref(this._mountGlobalEditor('stacks'))}
          @config-changed=${this._globalSectionChanged('stacks')}
        ></dockhand-stacks-card-editor>`;
      case 'containers':
        return html`<dockhand-containers-card-editor
          ${ref(this._mountGlobalEditor('containers'))}
          @config-changed=${this._globalSectionChanged('containers')}
        ></dockhand-containers-card-editor>`;
      case 'schedules':
        return html`<dockhand-schedules-card-editor
          ${ref(this._mountGlobalEditor('schedules'))}
          @config-changed=${this._globalSectionChanged('schedules')}
        ></dockhand-schedules-card-editor>`;
      case 'updates':
        return html`<dockhand-updates-card-editor
          ${ref(this._mountGlobalEditor('updates'))}
          @config-changed=${this._globalSectionChanged('updates')}
        ></dockhand-updates-card-editor>`;
    }
  }

  private _sectionSettingsChanged(ev: CustomEvent<{ value: DockhandOverviewCardConfig }>): void {
    this._config = { ...ev.detail.value };
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _sectionVisibilityToggled(section: OverviewSection) {
    const key = SECTION_CONFIG_KEY[section];
    return (ev: Event) => {
      ev.stopPropagation();
      this._updateConfig({ [key]: !this._isSectionShown(section) });
    };
  }

  /** Sets every section's own show_X field at once — each section is its
   * own standalone boolean (not a single exclude-array the way
   * environments are), so "all"/"none" means setting all six of them
   * together, not toggling a shared list. */
  private _showAllSections = (ev: Event): void => {
    ev.stopPropagation();
    const patch: Partial<DockhandOverviewCardConfig> = {};
    for (const key of Object.values(SECTION_CONFIG_KEY)) patch[key] = true;
    this._updateConfig(patch);
  };

  private _clearAllSections = (ev: Event): void => {
    ev.stopPropagation();
    const patch: Partial<DockhandOverviewCardConfig> = {};
    for (const key of Object.values(SECTION_CONFIG_KEY)) patch[key] = false;
    this._updateConfig(patch);
  };

  private _openSectionSettings(section: OverviewSection) {
    return (ev: Event) => {
      ev.stopPropagation();
      this._editingSection = section;
    };
  }

  private _closeSectionSettings = (ev: Event): void => {
    ev.stopPropagation();
    this._editingSection = undefined;
  };

  private _renderEnvironmentDetail(deviceId: string, name: string): TemplateResult {
    return html`${keyed(
      deviceId,
      html`
        <div class="detail-header">
          <ha-icon-button class="row-action-btn" label=${t(this._hass, 'back')} @click=${this._closeDetail}>
            <ha-icon icon="mdi:arrow-left"></ha-icon>
          </ha-icon-button>
          <div class="detail-title">
            <span class="detail-name">${name}</span>
            <span class="detail-badge">${t(this._hass, 'overrides_from_default_badge')}</span>
          </div>
        </div>
        <div class="hint">${t(this._hass, 'detail_view_hint')}</div>

        ${this._orderedSections().map((section) => this._renderDetailSection(section, deviceId))}
      `
    )}`;
  }

  private _renderDetailSection(section: OverviewSection, deviceId: string): TemplateResult {
    const overrides = this._config?.environments_overrides;
    // Starts expanded only if this section already has an override in
    // place — otherwise collapsed, matching rule 2's "collapsed unless
    // it's the thing you actually came here to look at" reasoning.
    // Someone who already overrode this section for this environment
    // wants to see that immediately; someone who didn't shouldn't need
    // to expand six panels just to find the one they're about to touch.
    const hasOverride = Object.keys(overrides?.[deviceId]?.[OVERRIDE_KEY[section]] ?? {}).length > 0;
    return html`
      <ha-expansion-panel outlined ?expanded=${hasOverride}>
        <ha-icon slot="leading-icon" icon=${SECTION_ICON[section]}></ha-icon>
        <h3 slot="header">${t(this._hass, DETAIL_SECTION_LABEL_KEY[section])}</h3>
        <div class="content">${this._renderDetailSectionContent(section, deviceId)}</div>
      </ha-expansion-panel>
    `;
  }

  private _renderDetailSectionContent(section: OverviewSection, deviceId: string): TemplateResult {
    const overrides = this._config?.environments_overrides;
    switch (section) {
      case 'environments':
        return html`
          <dockhand-environment-card-editor
            ${ref(this._mountEditor<DockhandEnvironmentCardConfig>(deviceId, 'custom:dockhand-environment-card', overrides?.[deviceId]?.environment))}
            @config-changed=${this._overrideSectionChanged(deviceId, 'environment')}
          ></dockhand-environment-card-editor>
        `;
      case 'vulnerabilities':
        return html`
          <dockhand-vulnerability-card-editor
            ${ref(
              this._mountEditor<DockhandVulnerabilityCardConfig>(
                deviceId,
                'custom:dockhand-vulnerability-card',
                overrides?.[deviceId]?.vulnerabilities
              )
            )}
            @config-changed=${this._overrideSectionChanged(deviceId, 'vulnerabilities')}
          ></dockhand-vulnerability-card-editor>
        `;
      case 'stacks':
        return html`
          <dockhand-stacks-card-editor
            ${ref(this._mountEditor<DockhandStacksCardConfig>(deviceId, 'custom:dockhand-stacks-card', overrides?.[deviceId]?.stacks))}
            @config-changed=${this._overrideSectionChanged(deviceId, 'stacks')}
          ></dockhand-stacks-card-editor>
        `;
      case 'containers':
        return html`
          <dockhand-containers-card-editor
            ${ref(
              this._mountEditor<DockhandContainersCardConfig>(deviceId, 'custom:dockhand-containers-card', overrides?.[deviceId]?.containers)
            )}
            @config-changed=${this._overrideSectionChanged(deviceId, 'containers')}
          ></dockhand-containers-card-editor>
        `;
      case 'updates':
        return html`
          <dockhand-updates-card-editor
            ${ref(this._mountEditor<DockhandUpdatesCardConfig>(deviceId, 'custom:dockhand-updates-card', overrides?.[deviceId]?.updates))}
            @config-changed=${this._overrideSectionChanged(deviceId, 'updates')}
          ></dockhand-updates-card-editor>
        `;
      case 'schedules':
        return html`
          <dockhand-schedules-card-editor
            ${ref(this._mountScheduleEditor(overrides?.[deviceId]?.schedules))}
            @config-changed=${this._overrideSectionChanged(deviceId, 'schedules')}
          ></dockhand-schedules-card-editor>
        `;
    }
  }

  /** ref() callback factory for the reused standalone editors — sets
   * hass/cardIsEmbedded before calling setConfig so the very first
   * render already reflects both (no flash of a device picker that then
   * disappears). Only runs on mount (see keyed() in
   * _renderEnvironmentDetail, which forces a fresh mount whenever the
   * environment being edited changes) — safe to only set config once
   * here, since after that this element's own config-changed events are
   * the sole source of truth for its section of the override, right up
   * until the user switches environments and a new element is mounted. */
  /** `device_id` in the constraint is `string | undefined`, not `string`
   * — Stacks (and, as more cards migrate, others) now declare it as an
   * optional legacy field once they support multiple environments (see
   * that card's own types.ts), even though this specific function always
   * passes a real value below. Widening the constraint to match is
   * simpler and more honest than keeping it stricter than the config
   * shapes it actually needs to accept. */
  private _mountEditor<C extends { type: string; device_id?: string }>(deviceId: string, type: C['type'], currentOverride: Partial<C> | undefined) {
    return (el?: Element) => {
      if (!el || !this._hass) return;
      const editor = el as unknown as EmbeddableCardEditor<C>;
      editor.hass = this._hass;
      editor.cardIsEmbedded = true;
      editor.setConfig({ type, device_id: deviceId, ...(currentOverride ?? {}) } as C);
    };
  }

  /** Same idea as _mountEditor above, not reused directly — that one's
   * generic constraint requires a `device_id` field, which the Schedules
   * card's own config type has never had (see that card's own README
   * for why) and never will just to satisfy this. cardIsEmbedded still
   * applies the same way — it's what hides Schedules' own Environments
   * section; there's no per-environment device concept for this override
   * view to carry in the first place (Overview already knows which
   * environment this is via the enclosing deviceId, it's just not
   * something the Schedules override config itself needs). */
  private _mountScheduleEditor(currentOverride: Partial<DockhandSchedulesCardConfig> | undefined) {
    return (el?: Element) => {
      if (!el || !this._hass) return;
      const editor = el as unknown as EmbeddableCardEditor<Partial<DockhandSchedulesCardConfig>>;
      editor.hass = this._hass;
      editor.cardIsEmbedded = true;
      editor.setConfig({ type: 'custom:dockhand-schedules-card', ...(currentOverride ?? {}) });
    };
  }

  /** The section types whose Overview-level global default reuses that
   * card's own real editor, instead of a hand-duplicated schema — see
   * docs/architecture.md's entry on this. (The Updates editor skips its
   * native HA `visibility:` condition when cardIsEmbedded, since Overview
   * hides an embedded Updates card itself.)
   *
   * Each embedded editor's own field names don't match Overview's own
   * prefixed global-default config keys directly (`mode` vs
   * `environment_mode`, `visible_badges` vs `stacks_visible_badges`,
   * etc.) — but every one of them turns out to be exactly
   * `${prefix}_${fieldName}`, where the prefix is the section name
   * itself except 'environments', which drops the trailing 's'
   * (`environment_mode`, not `environments_mode`). GLOBAL_SECTION_PREFIX
   * is just that one small exception table, not a full field-by-field
   * map — a genuinely new field on any of these cards' editors needs
   * nothing added here at all for the write-back direction (see
   * _globalSectionChanged) to pick it up automatically. `title` is
   * deliberately excluded via hideTitle instead of being mappable here —
   * a single title shared across every environment's card doesn't mean
   * anything. `show_settings_link` isn't excluded: unlike title, a
   * link-visibility preference is genuinely something a user might want
   * uniformly per card type. */
  private static readonly GLOBAL_SECTION_PREFIX: Record<'environments' | 'vulnerabilities' | 'stacks' | 'containers' | 'schedules' | 'updates', string> = {
    environments: 'environment',
    vulnerabilities: 'vulnerabilities',
    stacks: 'stacks',
    containers: 'containers',
    schedules: 'schedules',
    updates: 'updates'
  };

  private static readonly GLOBAL_SECTION_TYPE: Record<'environments' | 'vulnerabilities' | 'stacks' | 'containers' | 'schedules' | 'updates', string> = {
    environments: 'custom:dockhand-environment-card',
    vulnerabilities: 'custom:dockhand-vulnerability-card',
    stacks: 'custom:dockhand-stacks-card',
    containers: 'custom:dockhand-containers-card',
    schedules: 'custom:dockhand-schedules-card',
    updates: 'custom:dockhand-updates-card'
  };

  /** Builds the config fed into the embedded editor for the
   * global-defaults view: scans Overview's own config for any key
   * matching `${prefix}_${field}`, falls back to that card's own real
   * default where one exists (matching what the standalone card would
   * show for an unset field, not an arbitrary guess), and writes it
   * under the embedded editor's own (unprefixed) field name. device_id
   * is a placeholder — harmless, since cardIsEmbedded means it's
   * never rendered or read by anything other than the schema entry
   * that's already omitted. Safe to scan with no exceptions: the
   * only keys sharing the 'environments' prefix (environments_overrides,
   * environments_order) aren't fields of the Environment card. */
  private _globalEditorConfig(section: 'environments' | 'vulnerabilities' | 'stacks' | 'containers' | 'schedules' | 'updates'): Record<string, unknown> {
    const cfg = (this._config ?? {}) as unknown as Record<string, unknown>;
    const prefix = DockhandOverviewCardEditor.GLOBAL_SECTION_PREFIX[section];
    const data: Record<string, unknown> = { type: DockhandOverviewCardEditor.GLOBAL_SECTION_TYPE[section], device_id: '' };
    for (const [key, value] of Object.entries(cfg)) {
      if (key.startsWith(`${prefix}_`)) {
        data[key.slice(prefix.length + 1)] = value;
      }
    }
    if (section === 'environments') {
      data.mode ??= 'standard';
      data.custom_sections ??= DEFAULT_CUSTOM_SECTIONS;
    }
    if (section === 'stacks') data.visible_badges ??= DEFAULT_STACKS_BADGES;
    if (section === 'containers') data.visible_badges ??= DEFAULT_CONTAINERS_BADGES;
    return data;
  }

  private _mountGlobalEditor(section: 'environments' | 'vulnerabilities' | 'stacks' | 'containers' | 'schedules' | 'updates') {
    return (el?: Element) => {
      if (!el || !this._hass) return;
      const editor = el as unknown as EmbeddableCardEditor<Record<string, unknown>>;
      editor.hass = this._hass;
      editor.cardIsEmbedded = true;
      editor.hideTitle = true;
      editor.setConfig(this._globalEditorConfig(section));
    };
  }

  /** Reverse of _globalEditorConfig, and fully generic in the same way:
   * every key the embedded editor emits except type/device_id gets
   * written to `${prefix}_${key}` on Overview's own config, whatever
   * that key happens to be — no field list needed here either, since
   * the data any embedded editor emits is exactly the data it was given
   * (via _globalEditorConfig's own generic prefix scan) plus whatever
   * the user changed. This is what makes adding a new field to one of
   * these cards' editors "just work" on both the read and write-back
   * directions, with nothing in this file to remember to touch at all —
   * see docs/architecture.md §4 for why this scan needs no exceptions.
   * Doesn't re-implement the Environment editor's own "drop
   * custom_sections once mode leaves custom" cleanup: that already
   * happened inside the embedded editor's own _valueChanged before
   * this ever fires, so
   * `emitted.custom_sections` is already correctly absent by the time
   * it gets here — trusting that rather than duplicating the same
   * conditional a second time.
   *
   * Stops the embedded editor's own config-changed (its own card type,
   * with an empty device_id) from bubbling on to Home Assistant's card
   * dialog, which would otherwise preview that config instead of the
   * Overview's. */
  private _globalSectionChanged(section: 'environments' | 'vulnerabilities' | 'stacks' | 'containers' | 'schedules' | 'updates') {
    return (ev: CustomEvent<{ config: Record<string, unknown> }>): void => {
      ev.stopPropagation();
      const prefix = DockhandOverviewCardEditor.GLOBAL_SECTION_PREFIX[section];
      const next: Record<string, unknown> = { ...this._config };
      for (const [field, value] of Object.entries(ev.detail.config)) {
        if (field === 'type' || field === 'device_id') continue;
        const overviewKey = `${prefix}_${field}`;
        if (value === undefined) {
          delete next[overviewKey];
        } else {
          next[overviewKey] = value;
        }
      }
      this._config = next as DockhandOverviewCardConfig;
      fireEvent(this, 'config-changed', { config: this._config });
    };
  }

  /** Merges one card-type section's override for one environment, pruning
   * empty leaves so a cleared-out override doesn't linger as `{}` in the
   * saved config — same hygiene as exclude_device_ids/environments_order
   * elsewhere in this editor. */
  private _updateSectionOverride<K extends keyof EnvironmentOverride>(deviceId: string, section: K, value: EnvironmentOverride[K]): void {
    const overrides: Record<string, EnvironmentOverride> = { ...(this._config?.environments_overrides ?? {}) };
    const envOverride: EnvironmentOverride = { ...(overrides[deviceId] ?? {}) };
    const isEmpty = !value || Object.values(value).every((v) => v === undefined || v === '' || (Array.isArray(v) && v.length === 0));

    if (isEmpty) {
      delete envOverride[section];
    } else {
      envOverride[section] = value;
    }

    if (Object.keys(envOverride).length === 0) {
      delete overrides[deviceId];
    } else {
      overrides[deviceId] = envOverride;
    }

    this._updateConfig({ environments_overrides: Object.keys(overrides).length > 0 ? overrides : undefined });
  }

  /** Takes everything the embedded editor emits except type/device_id, so
   * a field added to one of those editors is saved here with nothing to
   * update. Safe without the exceptions _globalEditorConfig's prefix scan
   * reasons about, because each embedded editor is only ever given this
   * one environment's override for this one section. */
  private _overrideSectionChanged<K extends 'environment' | 'vulnerabilities' | 'stacks' | 'containers' | 'schedules' | 'updates'>(deviceId: string, section: K) {
    return (ev: CustomEvent<{ config: Record<string, unknown> }>): void => {
      ev.stopPropagation();
      const value = Object.fromEntries(Object.entries(ev.detail.config).filter(([key]) => key !== 'type' && key !== 'device_id'));
      this._updateSectionOverride(deviceId, section, value as EnvironmentOverride[K]);
    };
  }

  private _closeDetail = (ev: Event): void => {
    ev.stopPropagation();
    this._editingDeviceId = undefined;
  };

  private _sectionMoved(ev: CustomEvent<{ oldIndex: number; newIndex: number }>): void {
    ev.stopPropagation();
    const newOrder = this._orderedSections();
    const [moved] = newOrder.splice(ev.detail.oldIndex, 1);
    newOrder.splice(ev.detail.newIndex, 0, moved);
    this._updateConfig({ section_order: newOrder });
  }

  /** See DockhandStacksCardEditor's identical method (dockhand-stacks-
   * card/editor.ts) for the full reasoning — see common/config-utils.ts's
   * stripUndefinedKeys. */
  private _updateConfig(partial: Partial<DockhandOverviewCardConfig>): void {
    if (!this._config) return;
    this._config = stripUndefinedKeys({ ...this._config, ...partial }) as DockhandOverviewCardConfig;
    fireEvent(this, 'config-changed', { config: this._config });
  }
}

customElements.define('dockhand-overview-card-editor', DockhandOverviewCardEditor);
