import { LitElement, html, type TemplateResult } from 'lit';
import { state, property } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';
import type { HaFormSchema } from '../common/ha-form-types';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices, getRepresentativeEntityId } from '../common/device-utils';
import { cardNameFieldSchema } from '../common/card-name';
import { stripUndefinedKeys } from '../common/config-utils';
import { t } from '../common/i18n-editor';
import { editorFormStyles, sortableRowStyles } from '../common/editor-styles';
import { resolveIncludedOrdered } from '../common/environment-scope';
import { renderEnvironmentOrderSection } from '../common/environment-scope-editor';
import { DEFAULT_STACKS_BADGES, type DockhandStacksCardConfig } from './types';
import { STACKS_FILTER_FIELDS, renderFiltersForm } from '../common/filters-editor';

export class DockhandStacksCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandStacksCardConfig;
  @state() private _hass?: HomeAssistant;
  /** See DockhandVulnerabilityCardEditor's identical property for the
   * full reasoning — set only by the Overview card's per-environment
   * override detail view, never by HA itself. */
  @property({ type: Boolean }) cardIsEmbedded = false;
  /** Set by the Dockhand dashboard's settings: the dashboard chooses the
   * environments, so the editor leaves its Environments section out, but
   * the card still spans several (unlike cardIsEmbedded). */
  @property({ type: Boolean }) scopeFixed = false;
  /** See DockhandEnvironmentCardEditor's identical property for the full
   * reasoning. */
  @property({ type: Boolean }) hideTitle = false;

  static styles = [editorFormStyles, sortableRowStyles];

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandStacksCardConfig): void {
    this._config = { sort_by: 'name', ...config };
  }

  /** A patch key set to `undefined` means "remove this key": see
   * common/config-utils.ts's stripUndefinedKeys. */
  private _updateConfig(patch: Partial<DockhandStacksCardConfig>): void {
    if (!this._config) return;
    this._config = stripUndefinedKeys({ ...this._config, ...patch }) as DockhandStacksCardConfig;
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
              { value: 'status', label: t(this._hass, 'group_by_status') },
              { value: 'type', label: t(this._hass, 'badge_type') }
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
              { value: 'status', label: t(this._hass, 'sort_by_status') },
              { value: 'containers', label: t(this._hass, 'sort_by_containers') }
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
          { name: 'show_controls', default: false, selector: { boolean: {} } },
          {
            name: 'visible_badges',
            type: 'multi_select',
            options: {
              container_count: t(this._hass, 'badge_container_count'),
              updates: t(this._hass, 'badge_updates'),
              type: t(this._hass, 'badge_type'),
              tags: t(this._hass, 'badge_tags'),
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

    const includedEnvDevices = resolveIncludedOrdered(devices, this._config.environments_order, this._config.exclude_device_ids);
    const representativeEntityId = includedEnvDevices[0] ? getRepresentativeEntityId(this._hass, includedEnvDevices[0].deviceId) : undefined;

    return html`
      <ha-form
        .hass=${this._hass}
        .data=${{ ...this._config, group_by: this._config.group_by ?? (this.cardIsEmbedded ? 'none' : 'environment') }}
        .schema=${this._rootSchema()}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>

      ${renderEnvironmentOrderSection({
        hass: this._hass,
        headingKey: 'label_environments',
        hintKey: 'order_list_hint',
        icon: 'mdi:web',
        hidden: this.cardIsEmbedded || this.scopeFixed,
        order: this._config.environments_order,
        excluded: this._config.exclude_device_ids,
        showExcludeToggle: true,
        // Drag order only actually affects anything when grouped by
        // environment (groupStackRows sorts *other* groupings by status
        // rank, type, or alphabetically, never by environmentOrder) — so
        // the handle stays visible but disabled otherwise, rather than
        // functional but silently inert.
        allowReorder: (this._config.group_by ?? (this.cardIsEmbedded ? 'none' : 'environment')) === 'environment',
        onMoved: (order) => this._updateConfig({ environments_order: order }),
        onToggleExcluded: (deviceId, nowExcluded) => {
          const current = this._config?.exclude_device_ids ?? [];
          const next = nowExcluded ? [...current, deviceId] : current.filter((id) => id !== deviceId);
          this._updateConfig({ exclude_device_ids: next });
        },
        onSolo: (deviceId) => {
          this._updateConfig({ exclude_device_ids: devices.filter((d) => d.deviceId !== deviceId).map((d) => d.deviceId) });
        },
        onSelectAll: () => this._updateConfig({ exclude_device_ids: [] }),
        onClearAll: () => this._updateConfig({ exclude_device_ids: devices.map((d) => d.deviceId) })
      })}

      ${renderFiltersForm(this._hass, STACKS_FILTER_FIELDS, this._config, (patch) => this._updateConfig(patch), 'always_show_problems_stacks')}

      <ha-form
        .hass=${this._hass}
        .data=${{ ...this._config, visible_badges: this._config.visible_badges ?? DEFAULT_STACKS_BADGES }}
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
      case 'show_controls':
        return t(this._hass, 'show_row_controls');
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

  private _valueChanged(ev: CustomEvent<{ value: DockhandStacksCardConfig }>): void {
    this._config = { ...ev.detail.value };
    fireEvent(this, 'config-changed', { config: this._config });
  }
}

customElements.define('dockhand-stacks-card-editor', DockhandStacksCardEditor);
