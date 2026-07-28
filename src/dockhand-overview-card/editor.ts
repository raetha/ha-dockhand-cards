import { LitElement, html, css, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { keyed } from 'lit/directives/keyed.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { editorFormStyles } from '../common/editor-styles';
import { t, type TranslationKey } from '../common/i18n';
import { DEFAULT_CUSTOM_SECTIONS } from '../dockhand-environment-card/types';
import type { DockhandEnvironmentCardConfig } from '../dockhand-environment-card/types';
import type { DockhandVulnerabilityCardConfig } from '../dockhand-vulnerability-card/types';
import { DEFAULT_STACKS_BADGES, type DockhandStacksCardConfig } from '../dockhand-stacks-card/types';
import { DEFAULT_CONTAINERS_BADGES, type DockhandContainersCardConfig } from '../dockhand-containers-card/types';
import {
  DEFAULT_SECTION_ORDER,
  getEnvironmentOrder,
  getEnvironmentOverrides,
  migrateOverviewConfig,
  type DockhandOverviewCardConfig,
  type OverviewSection,
  type EnvironmentOverride,
  type EnvironmentOverrideUpdates
} from './types';

// Side-effect imports — registers the 4 standalone editors' custom
// elements so this editor can mount them directly for the per-environment
// override detail view (see _renderDetailSection). Not needed for the
// Updates card, whose editor has a scope selector and a native-visibility
// mechanism that don't apply here — see _renderDetailSection's 'updates'
// case for why that section is hand-built instead of reused.
import '../dockhand-environment-card/editor';
import '../dockhand-vulnerability-card/editor';
import '../dockhand-stacks-card/editor';
import '../dockhand-containers-card/editor';


const SECTION_LABEL_KEY: Record<OverviewSection, TranslationKey> = {
  environments: 'label_environments',
  vulnerabilities: 'label_vulnerabilities',
  stacks: 'label_stacks',
  containers: 'label_containers',
  updates: 'label_updates'
};

const DETAIL_SECTION_LABEL_KEY: Record<OverviewSection, TranslationKey> = {
  environments: 'detail_section_environment',
  vulnerabilities: 'detail_section_vulnerabilities',
  stacks: 'detail_section_stacks',
  containers: 'detail_section_containers',
  updates: 'detail_section_updates'
};

const SECTION_ICON: Record<OverviewSection, string> = {
  environments: 'mdi:server',
  vulnerabilities: 'mdi:shield-alert',
  stacks: 'mdi:layers',
  containers: 'mdi:docker',
  updates: 'mdi:arrow-up-circle'
};

const SECTION_CONFIG_KEY: Record<OverviewSection, keyof DockhandOverviewCardConfig> = {
  environments: 'show_environments',
  vulnerabilities: 'show_vulnerabilities',
  stacks: 'show_stacks',
  containers: 'show_containers',
  updates: 'show_updates'
};

// Editors accept type-erased elements from `ref()` — reusing the exact
// shape each editor's own setConfig/hass/hideDevicePicker expects rather
// than importing every editor *class* just for a type.
interface EmbeddableCardEditor<C> extends HTMLElement {
  hass: HomeAssistant;
  hideDevicePicker: boolean;
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
    /* font-size/font-weight here match HA's own tokens (confirmed against
     * HA frontend source: --ha-font-size-s is exactly what HA's own
     * hui-heading-badges-editor uses for its secondary/description text,
     * --ha-font-weight-medium is what ha-expansion-panel's own header
     * uses) rather than a hand-picked em ratio — the previous 0.9em h3
     * size didn't match HA's equivalent section headers (which don't
     * shrink at all, just go medium-weight), and hand-picked em values
     * don't track a user's HA accessibility text-size setting the way
     * these tokens do (that setting only propagates through the actual
     * --ha-font-size-* variables, not through a fixed-root em ratio).
     * Fallback values keep this safe if a token is ever missing. */
    h3 {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--ha-font-weight-medium, 500);
      margin: 16px 0 8px;
      color: var(--primary-text-color);
    }
    h3 ha-icon {
      --mdc-icon-size: 16px;
    }
    ha-expansion-panel {
      margin: 16px 0;
    }
    ha-expansion-panel .content {
      padding: 4px 0 12px;
    }
    .env-order-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 4px;
      border-bottom: 1px solid var(--divider-color);
    }
    .env-order-row.hidden {
      opacity: 0.5;
    }
    .env-order-handle {
      cursor: grab;
      color: var(--secondary-text-color);
    }
    .env-order-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .section-order-row.disabled {
      opacity: 0.5;
    }
    /* Deliberately NOT sized down to match the live cards' compact
     * .settings-link pattern — this is config UI, not a card. HA's own
     * editors/dialogs use ha-icon-button at its native default size, and
     * this editor should read the same way, not inherit the cards'
     * density. Only color is customized (muted, matching the secondary
     * weight this action has relative to the row's primary content). */
    .row-action-btn {
      color: var(--secondary-text-color);
    }
    /* No gap between the two action buttons themselves — matches HA's
     * own edit/remove icon-button pair in hui-heading-badges-editor,
     * which has no gap between them either (each button's own internal
     * padding provides the breathing room). The gap that separates this
     * whole group from the name text comes from .env-order-row's own
     * gap, since this div is just one more flex child of that row. */
    .row-actions {
      display: flex;
      align-items: center;
    }
    .detail-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .detail-title {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }
    .detail-name {
      font-size: var(--ha-font-size-m, 1em);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .detail-badge {
      flex-shrink: 0;
      font-size: var(--ha-font-size-xs, 0.7em);
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 10px;
      background: rgb(from var(--dockhand-accent-color, var(--primary-color)) r g b / 0.15);
      color: var(--dockhand-accent-color, var(--primary-color));
    }
  `;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandOverviewCardConfig): void {
    this._config = migrateOverviewConfig({
      show_environments: true,
      show_vulnerabilities: false,
      show_stacks: false,
      show_containers: false,
      show_updates: false,
      environment_mode: 'standard',
      ...config
    });
  }

  private _orderedDevices() {
    if (!this._hass) return [];
    const devices = getEnvironmentDevices(this._hass);
    const order = getEnvironmentOrder(this._config);
    if (!order) return devices;
    return [...devices].sort((a, b) => {
      const ai = order.indexOf(a.deviceId);
      const bi = order.indexOf(b.deviceId);
      return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
    });
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

    return this._renderList(orderedDevices);
  }

  private _renderList(orderedDevices: ReturnType<DockhandOverviewCardEditor['_orderedDevices']>): TemplateResult {
    if (!this._config) return html``;
    const orderedSections = this._orderedSections();

    return html`
      <ha-expansion-panel outlined expanded>
        <ha-icon slot="leading-icon" icon="mdi:format-list-bulleted"></ha-icon>
        <h3 slot="header">${t(this._hass, 'section_order_heading')}</h3>
        <div class="content">
          <div class="hint">${t(this._hass, 'section_order_hint')}</div>
          <ha-sortable handle-selector=".env-order-handle" @item-moved=${this._sectionMoved}>
            <div>${orderedSections.map((s) => this._renderSectionOrderRow(s))}</div>
          </ha-sortable>
        </div>
      </ha-expansion-panel>

      ${orderedDevices.length > 0
        ? html`
            <ha-expansion-panel outlined expanded>
              <ha-icon slot="leading-icon" icon="mdi:view-column"></ha-icon>
              <h3 slot="header">${t(this._hass, 'environment_order_heading')}</h3>
              <div class="content">
                <div class="hint">${t(this._hass, 'environment_order_hint')}</div>
                <ha-sortable handle-selector=".env-order-handle" @item-moved=${this._envMoved}>
                  <div>${orderedDevices.map((d) => this._renderEnvOrderRow(d.deviceId, d.name))}</div>
                </ha-sortable>
              </div>
            </ha-expansion-panel>
          `
        : html``}
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
    const rowHint = section === 'vulnerabilities' ? t(this._hass, 'vulnerabilities_hint') : section === 'updates' ? t(this._hass, 'updates_hint') : undefined;

    return html`
      <div class="env-order-row section-order-row ${shown ? '' : 'disabled'}" title=${rowHint ?? ''}>
        <ha-icon class="env-order-handle" icon="mdi:drag-horizontal-variant"></ha-icon>
        <span class="env-order-name">${t(this._hass, SECTION_LABEL_KEY[section])}</span>
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

        ${section === 'updates'
          ? html`
              <ha-form
                .hass=${this._hass}
                .data=${this._config}
                .schema=${[{ name: 'updates_hide_when_no_updates', default: false, selector: { boolean: {} } }]}
                .computeLabel=${() => t(this._hass, 'hide_updates_global')}
                .computeHelper=${() => t(this._hass, 'hide_updates_global_hint')}
                @value-changed=${this._sectionSettingsChanged}
              ></ha-form>
            `
          : this._renderGlobalSectionEditor(section)}
      `
    )}`;
  }

  private _renderGlobalSectionEditor(section: Exclude<OverviewSection, 'updates'>): TemplateResult {
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
    }
  }

  /** Only 'updates' still needs a hand-built schema — its embedded
   * editor's own hide_when_no_updates would come with a native HA
   * `visibility:` condition Overview doesn't want as a "shared default"
   * concept (see the reasoning already on _renderDetailSectionContent's
   * 'updates' case). Every other section's global-defaults view embeds
   * the real editor instead — see _mountGlobalEditor/GLOBAL_FIELD_MAP. */
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

  private _renderEnvOrderRow(deviceId: string, name: string): TemplateResult {
    const hidden = this._config?.exclude_device_ids?.includes(deviceId) ?? false;

    return html`
      <div class="env-order-row ${hidden ? 'hidden' : ''}">
        <ha-icon class="env-order-handle" icon="mdi:drag-horizontal-variant"></ha-icon>
        <span class="env-order-name">${name}</span>
        <div class="row-actions">
          <ha-icon-button class="row-action-btn" label=${t(this._hass, 'override_env_settings')} @click=${this._openDetail(deviceId)}>
            <ha-icon icon="mdi:pencil"></ha-icon>
          </ha-icon-button>
          <ha-icon-button
            class="row-action-btn"
            label=${hidden ? t(this._hass, 'show_this_environment') : t(this._hass, 'hide_this_environment')}
            @click=${this._envVisibilityToggled(deviceId)}
          >
            <ha-icon icon=${hidden ? 'mdi:eye-off' : 'mdi:eye'}></ha-icon>
          </ha-icon-button>
        </div>
      </div>
    `;
  }

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
    return html`
      <ha-expansion-panel outlined expanded>
        <ha-icon slot="leading-icon" icon=${SECTION_ICON[section]}></ha-icon>
        <h3 slot="header">${t(this._hass, DETAIL_SECTION_LABEL_KEY[section])}</h3>
        <div class="content">${this._renderDetailSectionContent(section, deviceId)}</div>
      </ha-expansion-panel>
    `;
  }

  private _renderDetailSectionContent(section: OverviewSection, deviceId: string): TemplateResult {
    const overrides = getEnvironmentOverrides(this._config);
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
      case 'updates': {
        // Not reused from DockhandUpdatesCardEditor: that editor has a
        // scope selector (not meaningful here, always 'environment') and
        // builds a native HA visibility condition for hide_when_no_updates
        // — this Overview card already implements hide-when-no-updates its
        // own way for nested cards (see card.ts), so reusing that editor
        // would build a `visibility` condition that's never actually
        // consulted for cards this component renders directly.
        const current = overrides?.[deviceId]?.updates ?? {};
        return html`
          <div class="row">
            <ha-input label=${t(this._hass, 'title_override')} .value=${current.title ?? ''} @input=${this._updatesOverrideTitleChanged(deviceId)}></ha-input>
          </div>
          <div class="row">
            <ha-formfield label=${t(this._hass, 'hide_when_no_updates_override')}>
              <ha-switch .checked=${current.hide_when_no_updates ?? false} @change=${this._updatesOverrideHideChanged(deviceId)}></ha-switch>
            </ha-formfield>
          </div>
        `;
      }
    }
  }

  /** ref() callback factory for the 4 reused standalone editors — sets
   * hass/hideDevicePicker before calling setConfig so the very first
   * render already reflects both (no flash of a device picker that then
   * disappears). Only runs on mount (see keyed() in
   * _renderEnvironmentDetail, which forces a fresh mount whenever the
   * environment being edited changes) — safe to only set config once
   * here, since after that this element's own config-changed events are
   * the sole source of truth for its section of the override, right up
   * until the user switches environments and a new element is mounted. */
  private _mountEditor<C extends { type: string; device_id: string }>(deviceId: string, type: C['type'], currentOverride: Partial<C> | undefined) {
    return (el?: Element) => {
      if (!el || !this._hass) return;
      const editor = el as unknown as EmbeddableCardEditor<C>;
      editor.hass = this._hass;
      editor.hideDevicePicker = true;
      editor.setConfig({ type, device_id: deviceId, ...(currentOverride ?? {}) } as C);
    };
  }

  /** The 4 section types whose Overview-level global default now reuses
   * that card's own real editor, instead of a hand-duplicated schema —
   * see docs/ARCHITECTURE.md's entry on this. 'updates' deliberately
   * isn't here: its real editor builds a native HA `visibility:`
   * condition that has no meaning as a "shared default" (see the
   * existing comment on the 'updates' case below), and it's a single
   * field, so hand-duplicating it costs little.
   *
   * Each embedded editor's own field names don't match Overview's own
   * prefixed global-default config keys directly (`mode` vs
   * `environment_mode`, `visible_badges` vs `stacks_visible_badges`,
   * etc.) — but every one of them turns out to be exactly
   * `${prefix}_${fieldName}`, where the prefix is the section name
   * itself except 'environments', which drops the trailing 's'
   * (`environment_mode`, not `environments_mode`). GLOBAL_SECTION_PREFIX
   * is just that one small exception table, not a full field-by-field
   * map — a genuinely new field on any of these 4 cards' editors needs
   * nothing added here at all for the write-back direction (see
   * _globalSectionChanged) to pick it up automatically. `title` is
   * deliberately excluded via hideTitle instead of being mappable here —
   * a single title shared across every environment's card doesn't mean
   * anything. `show_settings_link` isn't excluded: unlike title, a
   * link-visibility preference is genuinely something a user might want
   * uniformly per card type. */
  private static readonly GLOBAL_SECTION_PREFIX: Record<'environments' | 'vulnerabilities' | 'stacks' | 'containers', string> = {
    environments: 'environment',
    vulnerabilities: 'vulnerabilities',
    stacks: 'stacks',
    containers: 'containers'
  };

  private static readonly GLOBAL_SECTION_TYPE: Record<'environments' | 'vulnerabilities' | 'stacks' | 'containers', string> = {
    environments: 'custom:dockhand-environment-card',
    vulnerabilities: 'custom:dockhand-vulnerability-card',
    stacks: 'custom:dockhand-stacks-card',
    containers: 'custom:dockhand-containers-card'
  };

  /** Builds the config fed into the embedded editor for the
   * global-defaults view: scans Overview's own config for any key
   * matching `${prefix}_${field}`, falls back to that card's own real
   * default where one exists (matching what the standalone card would
   * show for an unset field, not an arbitrary guess), and writes it
   * under the embedded editor's own (unprefixed) field name. device_id
   * is a placeholder — harmless, since hideDevicePicker means it's
   * never rendered or read by anything other than the schema entry
   * that's already omitted. Genuinely safe to scan with no exceptions:
   * the only 2 keys that would otherwise collide with the 'environments'
   * prefix (environments_overrides, environments_order) are both
   * plural, matching show_environments — only the deprecated, singular
   * environment_overrides/environment_order collided, and setConfig()
   * always migrates those away before this._config is ever read from
   * here (see migrateOverviewConfig in types.ts). */
  private _globalEditorConfig(section: 'environments' | 'vulnerabilities' | 'stacks' | 'containers'): Record<string, unknown> {
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

  private _mountGlobalEditor(section: 'environments' | 'vulnerabilities' | 'stacks' | 'containers') {
    return (el?: Element) => {
      if (!el || !this._hass) return;
      const editor = el as unknown as EmbeddableCardEditor<Record<string, unknown>>;
      editor.hass = this._hass;
      editor.hideDevicePicker = true;
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
   * these 4 cards' editors "just work" on both the read and write-back
   * directions, with nothing in this file to remember to touch at all —
   * see docs/ARCHITECTURE.md §4 for why this scan needs no exceptions
   * of any kind now (environments_overrides/environments_order were
   * renamed specifically to stop colliding with the 'environments'
   * prefix; migrateOverviewConfig in types.ts, called from setConfig,
   * keeps this._config in that shape from the moment it loads).
   * Doesn't re-implement the Environment editor's own "drop
   * custom_sections once mode leaves custom" cleanup: that already
   * happened inside the embedded editor's own _valueChanged before
   * this ever fires, so
   * `emitted.custom_sections` is already correctly absent by the time
   * it gets here — trusting that rather than duplicating the same
   * conditional a second time.
   *
   * Also carries the ev.stopPropagation() every sibling section-changed
   * handler needs — without it, the embedded editor's own raw
   * config-changed event (still typed as e.g. custom:dockhand-stacks-card
   * with an empty device_id, since that's its own config, not Overview's)
   * keeps bubbling right past this listener and reaches HA's own
   * card-editor dialog outside this component entirely. That outer
   * dialog treats any config-changed bubbling from inside the mounted
   * editor as the thing being edited, and tries to preview the embedded
   * editor's raw config instead of Overview's own — which is exactly
   * where "Please select a Dockhand environment." was coming from: the
   * card being mistakenly previewed was dockhand-stacks-card with
   * device_id: '', not dockhand-overview-card. */
  private _globalSectionChanged(section: 'environments' | 'vulnerabilities' | 'stacks' | 'containers') {
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
   * elsewhere in this editor. Reads via getEnvironmentOverrides (so an
   * old-style saved config still shows correctly) but always writes
   * environments_overrides, never the deprecated environment_overrides
   * — every edit through this method naturally migrates a config fully
   * over to the new key, deleting the old one at the same time (see
   * _updateConfig's own migration step for the case where the old key
   * is still present but this specific method wasn't what changed). */
  private _updateSectionOverride<K extends keyof EnvironmentOverride>(deviceId: string, section: K, value: EnvironmentOverride[K]): void {
    const overrides: Record<string, EnvironmentOverride> = { ...(getEnvironmentOverrides(this._config) ?? {}) };
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

  /** Consolidated replacement for what used to be 4 nearly-identical
   * handlers (one per section type), each hand-picking which fields of
   * ev.detail.config to extract into the override object. That approach
   * had a real, silent bug: when visible_badges was added to the Stacks/
   * Containers cards, the two handlers for those sections were never
   * updated to extract it, so a per-environment override of that field
   * was accepted by the UI and then silently dropped on the floor — the
   * user would set it, see it reflected in the editor, and it would
   * never actually be saved. Generic extraction (everything the embedded
   * editor emits except type/device_id) makes that specific bug
   * structurally impossible: a field the embedded editor's own schema
   * doesn't have doesn't get emitted in the first place, and a field it
   * does have is captured automatically, with nothing here to remember
   * to update. Safe to do unconditionally here (unlike the global
   * defaults' read side, see _globalEditorConfig) because the data fed
   * into each embedded editor by _mountEditor is already narrowly scoped
   * to just that one environment's override sub-object for this one
   * section — never the whole Overview config — so there's no risk of
   * an unrelated key leaking in. */
  private _overrideSectionChanged<K extends 'environment' | 'vulnerabilities' | 'stacks' | 'containers'>(deviceId: string, section: K) {
    return (ev: CustomEvent<{ config: Record<string, unknown> }>): void => {
      ev.stopPropagation();
      const value = Object.fromEntries(Object.entries(ev.detail.config).filter(([key]) => key !== 'type' && key !== 'device_id'));
      this._updateSectionOverride(deviceId, section, value as EnvironmentOverride[K]);
    };
  }

  private _updatesOverrideTitleChanged(deviceId: string) {
    return (ev: Event) => {
      const current = getEnvironmentOverrides(this._config)?.[deviceId]?.updates ?? {};
      const value: EnvironmentOverrideUpdates = { ...current, title: (ev.target as HTMLInputElement).value };
      this._updateSectionOverride(deviceId, 'updates', value);
    };
  }

  private _updatesOverrideHideChanged(deviceId: string) {
    return (ev: Event) => {
      const current = getEnvironmentOverrides(this._config)?.[deviceId]?.updates ?? {};
      const value: EnvironmentOverrideUpdates = { ...current, hide_when_no_updates: (ev.target as HTMLInputElement).checked };
      this._updateSectionOverride(deviceId, 'updates', value);
    };
  }

  private _envVisibilityToggled(deviceId: string) {
    return (ev: Event) => {
      ev.stopPropagation();
      const current = this._config?.exclude_device_ids ?? [];
      const hidden = current.includes(deviceId);
      const next = hidden ? current.filter((id) => id !== deviceId) : [...current, deviceId];
      this._updateConfig({ exclude_device_ids: next.length > 0 ? next : undefined });
    };
  }

  private _openDetail(deviceId: string) {
    return (ev: Event) => {
      ev.stopPropagation();
      this._editingDeviceId = deviceId;
    };
  }

  private _closeDetail = (ev: Event): void => {
    ev.stopPropagation();
    this._editingDeviceId = undefined;
  };

  private _envMoved(ev: CustomEvent<{ oldIndex: number; newIndex: number }>): void {
    ev.stopPropagation();
    const devices = this._orderedDevices();
    const newOrder = devices.map((d) => d.deviceId);
    const [moved] = newOrder.splice(ev.detail.oldIndex, 1);
    newOrder.splice(ev.detail.newIndex, 0, moved);
    this._updateConfig({ environments_order: newOrder });
  }

  private _sectionMoved(ev: CustomEvent<{ oldIndex: number; newIndex: number }>): void {
    ev.stopPropagation();
    const newOrder = this._orderedSections();
    const [moved] = newOrder.splice(ev.detail.oldIndex, 1);
    newOrder.splice(ev.detail.newIndex, 0, moved);
    this._updateConfig({ section_order: newOrder });
  }

  private _updateConfig(partial: Partial<DockhandOverviewCardConfig>): void {
    if (!this._config) return;
    this._config = { ...this._config, ...partial };
    fireEvent(this, 'config-changed', { config: this._config });
  }
}

customElements.define('dockhand-overview-card-editor', DockhandOverviewCardEditor);
