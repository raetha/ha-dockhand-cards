import { LitElement, html, type TemplateResult } from 'lit';
import { state, property } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';
import type { HaFormSchema } from '../common/ha-form-types';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices, getRepresentativeEntityId } from '../common/device-utils';
import { cardNameFieldSchema, migrateTitleToName } from '../common/card-name';
import { stripUndefinedKeys } from '../common/config-utils';
import { t } from '../common/i18n';
import { sortableRowStyles, editorFormStyles } from '../common/editor-styles';
import { renderEnvironmentOrderSection, resolveIncludedOrderedWithLegacy, effectiveExcludeDeviceIds } from '../common/environment-scope';
import { buildUpdatesVisibilityCondition } from '../common/updates-visibility';
import type { DockhandUpdatesCardConfig } from './types';

export class DockhandUpdatesCardEditor extends LitElement implements LovelaceCardEditor {
  static styles = [sortableRowStyles, editorFormStyles];

  @state() private _config?: DockhandUpdatesCardConfig;
  @state() private _hass?: HomeAssistant;
  @property({ type: Boolean }) cardIsEmbedded = false;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandUpdatesCardConfig): void {
    this._config = migrateTitleToName(config as Record<string, unknown>) as DockhandUpdatesCardConfig;
  }

  private _rootSchema(): HaFormSchema[] {
    if (this.cardIsEmbedded) return [];
    return [
      {
        name: 'group_by',
        default: 'environment',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'none', label: t(this._hass, 'group_by_none') },
              { value: 'environment', label: t(this._hass, 'group_by_environment') }
            ]
          }
        }
      }
    ];
  }

  private _contentSchema(): HaFormSchema[] {
    return [
      {
        name: 'content',
        type: 'expandable',
        flatten: true,
        icon: 'mdi:text-short',
        title: t(this._hass, 'content_section_heading'),
        schema: [cardNameFieldSchema(this._representativeEntityId(), [{ type: 'device' }]), { name: 'hide_when_no_updates', default: false, selector: { boolean: {} } }]
      }
    ];
  }

  private _representativeEntityId(): string | undefined {
    if (!this._hass || !this._config) return undefined;
    const devices = getEnvironmentDevices(this._hass);
    const included = resolveIncludedOrderedWithLegacy(devices, this._config.environments_order, this._config.exclude_device_ids, this._config.device_id, this._config.scope);
    return included[0] ? getRepresentativeEntityId(this._hass, included[0].deviceId) : undefined;
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;

    const devices = getEnvironmentDevices(this._hass);
    const rootSchema = this._rootSchema();

    return html`
      ${rootSchema.length > 0
        ? html`
            <ha-form
              .hass=${this._hass}
              .data=${{ ...this._config, group_by: this._config.group_by ?? 'environment' }}
              .schema=${rootSchema}
              .computeLabel=${this._computeLabel}
              @value-changed=${this._valueChanged}
            ></ha-form>
          `
        : html``}

      <!--
        Legacy scope/device_id (real, released since 1.1.0 —
        scope: 'selected' was added later in this same still-unreleased
        cycle and never shipped) is never rewritten here. See
        resolveIncludedOrderedWithLegacy's own comment in
        environment-scope.ts for the full reasoning, same approach as
        Stacks/Containers.
      -->
      ${renderEnvironmentOrderSection({
        hass: this._hass,
        headingKey: 'label_environments',
        hintKey: 'order_list_hint',
        icon: 'mdi:web',
        order: this._config.environments_order,
        excluded: effectiveExcludeDeviceIds(devices, this._config.exclude_device_ids, this._config.device_id, this._config.scope),
        showExcludeToggle: true,
        allowReorder: true,
        onMoved: (order) => this._updateConfig({ environments_order: order, scope: undefined, device_id: undefined }),
        onToggleExcluded: (deviceId, nowExcluded) => {
          const current = effectiveExcludeDeviceIds(devices, this._config?.exclude_device_ids, this._config?.device_id, this._config?.scope) ?? [];
          const next = nowExcluded ? [...current, deviceId] : current.filter((id) => id !== deviceId);
          this._updateConfig({ exclude_device_ids: next, scope: undefined, device_id: undefined });
        },
        onSolo: (deviceId) => {
          this._updateConfig({ exclude_device_ids: devices.filter((d) => d.deviceId !== deviceId).map((d) => d.deviceId), scope: undefined, device_id: undefined });
        },
        onSelectAll: () => this._updateConfig({ exclude_device_ids: [], scope: undefined, device_id: undefined }),
        onClearAll: () => this._updateConfig({ exclude_device_ids: devices.map((d) => d.deviceId), scope: undefined, device_id: undefined })
      })}

      <ha-form
        .hass=${this._hass}
        .data=${this._config}
        .schema=${this._contentSchema()}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  /** See DockhandStacksCardEditor's identical method for the full
   * reasoning — see common/config-utils.ts's stripUndefinedKeys. */
  private _updateConfig(patch: Partial<DockhandUpdatesCardConfig>): void {
    if (!this._config) return;
    this._applyValueChange(stripUndefinedKeys({ ...this._config, ...patch }) as DockhandUpdatesCardConfig);
  }

  private _computeLabel = (schema: HaFormSchema): string => {
    switch (schema.name) {
      case 'group_by':
        return t(this._hass, 'group_by_label');
      case 'name':
        return t(this._hass, 'title_override');
      case 'hide_when_no_updates':
        return t(this._hass, 'hide_when_no_updates_override');
      default:
        return schema.name;
    }
  };

  private _computeHelper = (schema: HaFormSchema): string => {
    // The card is fully removed when hidden (Home Assistant's own card
    // visibility condition), not just emptied — worth saying since it's
    // not obvious from the toggle's own label.
    if (schema.name === 'hide_when_no_updates') return t(this._hass, 'hide_when_no_updates_helper');
    return '';
  };

  /** Reconciles the card's own `visibility:` condition against its
   * current hide_when_no_updates/environments_order/exclude_device_ids
   * (or legacy scope/device_id), every time any of them changes — not
   * just when the toggle itself is flipped, since changing which
   * environments are included while the toggle is already on needs the
   * condition rebuilt too. Uses HA's own native card visibility feature
   * (hui-card.ts) rather than anything hand-rolled: a real display: none
   * on the card's own wrapper, correctly freeing its grid space for a
   * sibling to flow into — see docs/ARCHITECTURE.md for why an earlier
   * getGridOptions()-based approach couldn't achieve that. Removes
   * `visibility` entirely from the saved config when the toggle is off,
   * rather than leaving a stale condition behind.
   *
   * This is genuinely not expressible as a plain ha-form schema field —
   * it's a derived side effect across several fields, not a value one
   * field holds — so it stays hand-written here rather than in the
   * schema, even though the rest of this editor now goes through
   * <ha-form>. Shared between the actual <ha-form> value-changed handler
   * and _updateConfig's hand-rolled environment-order/exclude writes,
   * since either can change which environments the visibility condition
   * should cover. */
  private _applyValueChange(next: DockhandUpdatesCardConfig): void {
    if (next.hide_when_no_updates && this._hass) {
      const deviceIds = resolveIncludedOrderedWithLegacy(getEnvironmentDevices(this._hass), next.environments_order, next.exclude_device_ids, next.device_id, next.scope).map((d) => d.deviceId);
      const condition = buildUpdatesVisibilityCondition(this._hass, deviceIds);
      if (condition) {
        next.visibility = condition;
      } else {
        delete next.visibility;
      }
    } else {
      delete next.visibility;
    }

    this._config = next;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _valueChanged(ev: CustomEvent<{ value: DockhandUpdatesCardConfig }>): void {
    this._applyValueChange({ ...ev.detail.value });
  }
}

customElements.define('dockhand-updates-card-editor', DockhandUpdatesCardEditor);
