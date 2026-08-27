import { LitElement, html, type TemplateResult } from 'lit';
import { state, property } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';
import type { HaFormSchema } from '../common/ha-form-types';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices, getRepresentativeEntityId } from '../common/device-utils';
import { cardNameFieldSchema, migrateTitleToName } from '../common/card-name';
import { stripUndefinedKeys } from '../common/config-utils';
import { t } from '../common/i18n';
import { editorFormStyles, sortableRowStyles } from '../common/editor-styles';
import { renderEnvironmentOrderSection, resolveIncludedOrderedWithLegacy, effectiveExcludeDeviceIds } from '../common/environment-scope';
import { DEFAULT_CONTAINERS_BADGES, type DockhandContainersCardConfig } from './types';

export class DockhandContainersCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandContainersCardConfig;
  @state() private _hass?: HomeAssistant;
  /** See DockhandVulnerabilityCardEditor's identical property for the
   * full reasoning — set only by the Overview card's per-environment
   * override detail view, never by HA itself. */
  @property({ type: Boolean }) cardIsEmbedded = false;
  /** See DockhandEnvironmentCardEditor's identical property for the full
   * reasoning. */
  @property({ type: Boolean }) hideTitle = false;

  static styles = [editorFormStyles, sortableRowStyles];

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandContainersCardConfig): void {
    this._config = { sort_by: 'name', ...(migrateTitleToName(config as Record<string, unknown>) as DockhandContainersCardConfig) };
  }

  /** See DockhandStacksCardEditor's identical method for the full
   * reasoning — see common/config-utils.ts's stripUndefinedKeys. */
  private _updateConfig(patch: Partial<DockhandContainersCardConfig>): void {
    if (!this._config) return;
    this._config = stripUndefinedKeys({ ...this._config, ...patch }) as DockhandContainersCardConfig;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _rootSchema(): HaFormSchema[] {
    return [
      {
        name: 'group_by',
        default: this.cardIsEmbedded ? 'none' : 'environment',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'none', label: t(this._hass, 'group_by_none') },
              ...(this.cardIsEmbedded ? [] : [{ value: 'environment', label: t(this._hass, 'group_by_environment') }]),
              { value: 'status', label: t(this._hass, 'group_by_status') }
            ]
          }
        }
      },
      {
        name: 'sort_by',
        default: 'name',
        selector: {
          select: {
            mode: 'dropdown' as const,
            options: [
              { value: 'name', label: t(this._hass, 'sort_by_name') },
              { value: 'status', label: t(this._hass, 'sort_by_status') }
            ]
          }
        }
      }
    ];
  }

  private _contentSchema(representativeEntityId: string | undefined): HaFormSchema[] {
    return [
      {
        name: 'content',
        type: 'expandable',
        flatten: true,
        icon: 'mdi:text-short',
        title: t(this._hass, 'content_section_heading'),
        schema: [
          ...(this.hideTitle ? [] : [cardNameFieldSchema(representativeEntityId, [{ type: 'device' }])]),
          { name: 'show_settings_link', default: true, selector: { boolean: {} } },
          {
            name: 'visible_badges',
            type: 'multi_select',
            options: {
              health: t(this._hass, 'badge_health'),
              updates: t(this._hass, 'badge_updates'),
              cpu: t(this._hass, 'badge_cpu'),
              memory: t(this._hass, 'badge_memory'),
              ...(this.cardIsEmbedded ? {} : { environment: t(this._hass, 'badge_environment') })
            }
          }
        ]
      }
    ];
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;

    const devices = getEnvironmentDevices(this._hass);
    if (devices.length === 0) {
      return html`<div class="row">${t(this._hass, 'no_environments_found')}</div>`;
    }

    const includedEnvDevices = resolveIncludedOrderedWithLegacy(devices, this._config.environments_order, this._config.exclude_device_ids, this._config.device_id);
    const representativeEntityId = includedEnvDevices[0] ? getRepresentativeEntityId(this._hass, includedEnvDevices[0].deviceId) : undefined;

    return html`
      <ha-form
        .hass=${this._hass}
        .data=${{ ...this._config, group_by: this._config.group_by ?? (this.cardIsEmbedded ? 'none' : 'environment') }}
        .schema=${this._rootSchema()}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>

      <!--
        Legacy single-environment configs (device_id, real and released
        since 1.0.0) are never rewritten here — see
        resolveIncludedOrderedWithLegacy's own comment in
        environment-scope.ts for the full reasoning (same as Stacks').
      -->
      ${renderEnvironmentOrderSection({
        hass: this._hass,
        headingKey: 'label_environments',
        hintKey: 'order_list_hint',
        icon: 'mdi:web',
        hidden: this.cardIsEmbedded,
        order: this._config.environments_order,
        excluded: effectiveExcludeDeviceIds(devices, this._config.exclude_device_ids, this._config.device_id),
        showExcludeToggle: true,
        // Drag order only actually affects anything when grouped by
        // environment (groupContainerRows sorts *other* groupings by
        // status rank or alphabetically, never by environmentOrder) — so
        // the handle stays visible but disabled otherwise, rather than
        // functional but silently inert.
        allowReorder: (this._config.group_by ?? (this.cardIsEmbedded ? 'none' : 'environment')) === 'environment',
        onMoved: (order) => this._updateConfig({ environments_order: order, device_id: undefined }),
        onToggleExcluded: (deviceId, nowExcluded) => {
          const current = effectiveExcludeDeviceIds(devices, this._config?.exclude_device_ids, this._config?.device_id) ?? [];
          const next = nowExcluded ? [...current, deviceId] : current.filter((id) => id !== deviceId);
          this._updateConfig({ exclude_device_ids: next, device_id: undefined });
        },
        onSolo: (deviceId) => {
          this._updateConfig({ exclude_device_ids: devices.filter((d) => d.deviceId !== deviceId).map((d) => d.deviceId), device_id: undefined });
        },
        onSelectAll: () => this._updateConfig({ exclude_device_ids: [], device_id: undefined }),
        onClearAll: () => this._updateConfig({ exclude_device_ids: devices.map((d) => d.deviceId), device_id: undefined })
      })}

      <ha-form
        .hass=${this._hass}
        .data=${{ ...this._config, visible_badges: this._config.visible_badges ?? DEFAULT_CONTAINERS_BADGES }}
        .schema=${this._contentSchema(representativeEntityId)}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (schema: HaFormSchema): string => {
    switch (schema.name) {
      case 'name':
        return t(this._hass, 'title_override');
      case 'show_settings_link':
        return t(this._hass, 'show_settings_link');
      case 'visible_badges':
        return t(this._hass, 'visible_badges_label');
      case 'group_by':
        return t(this._hass, 'group_by_label');
      case 'sort_by':
        return t(this._hass, 'sort_by_label');
      default:
        return schema.name;
    }
  };

  private _valueChanged(ev: CustomEvent<{ value: DockhandContainersCardConfig }>): void {
    this._config = { ...ev.detail.value };
    fireEvent(this, 'config-changed', { config: this._config });
  }
}

customElements.define('dockhand-containers-card-editor', DockhandContainersCardEditor);
